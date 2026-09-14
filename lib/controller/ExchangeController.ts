/**
 * ExchangeController
 *
 * Plain (non-React) owner of all market-data ACQUISITION and SCHEDULING for one
 * exchange. It holds the DataManager, the timers, the RSI fetch loop and the RSI
 * cache, and writes results into a `MarketStore`. The React layer
 * (`useExchangeStore`) only subscribes to the store for the derived view and
 * drives this controller's `initialize()` / `dispose()` from an effect.
 *
 * Why a class instead of a hook: the previous god-hook mixed long-lived mutable
 * handles (intervals, abort controllers, fetch-in-flight flags, a disposed flag
 * to survive StrictMode double-mount) with React's derived/render concerns.
 * Pulling the imperative half into an instance makes the lifecycle explicit and
 * removes the ref-soup. The store, cache and React state writes are injected so
 * this file stays free of React.
 */

import {
  ProcessedTicker,
  RSIData,
  ExchangeAdapter,
  DataManager,
} from '@/lib/types';
import { fetchMarketCapData } from '@/lib/api/marketcap';
import { selectUniverse, SpotUniverseContext } from '@/lib/filters';
import { TIMING, MA_FLOW } from '@/lib/constants';
import { sameSet } from '@/lib/utils';
import {
  getMarketCapCache,
  setMarketCapCache,
  spotSymbolsCache,
  checkVersionAndClearCache,
  getCacheForExchange,
} from '@/lib/cache';
import { MarketStore } from '@/lib/store/marketStore';

type ExchangeCache = ReturnType<typeof getCacheForExchange>;

export interface ExchangeControllerCallbacks {
  /** Connection status / last-update time → React state. */
  onStatus: (status: 'connecting' | 'live' | 'error', time?: Date) => void;
  /** RSI batch progress text → React state. */
  onRsiProgress: (text: string) => void;
  /** Delegate MA-Flow fetch (data lives in the useMAFlowData hook). */
  fetchMAFlow: (tickerMap: Map<string, ProcessedTicker>) => Promise<boolean>;
  /** Delegate MA-Flow prune for delisted instruments. */
  pruneMAFlow: (validKeys: Set<string>) => void;
  /** Delegate MA-Flow cleanup (clears its debounce timer). */
  cleanupMAFlow: () => void;
}

export class ExchangeController {
  private readonly adapter: ExchangeAdapter;
  private readonly store: MarketStore;
  private readonly cache: ExchangeCache;
  private readonly cb: ExchangeControllerCallbacks;

  private dataManager: DataManager | null = null;
  private intervals: NodeJS.Timeout[] = [];
  private timeouts: NodeJS.Timeout[] = [];
  private rsiAbort: AbortController | null = null;
  private isFetchingRsi = false;
  /** A full RSI pass was requested while one was in flight (universe grew). */
  private rsiRerunPending = false;

  /**
   * Active universe — the ONLY instruments that reach the store, the WS
   * subscription and the RSI / funding / MA-Flow fetches. `universeOrder` is
   * the same set by market-cap rank (24h volume breaks ties) for RSI tiering.
   * null until its inputs — market cap and, on OKX, spot symbols — are loaded
   * (or the fallback timer degrades them).
   */
  private universe: Set<string> | null = null;
  private universeOrder: string[] = [];
  /** Market cap failed / timed out with nothing cached → volume-ranked universe. */
  private marketCapFallback = false;
  /** Spot symbols timed out with nothing cached → skip the no-spot cut. */
  private spotFallback = false;
  /** Debounced RSI + funding pass after the universe appears or grows. */
  private universeFetchTimeout: NodeJS.Timeout | null = null;
  private fundingPending = false;
  /** Set true by dispose() so async initialize() steps and timers bail out. */
  private disposed = false;
  /** Set true by pause() while the page is hidden — acquisition is suspended
   *  but the store is preserved, so resume() can repaint + refresh. */
  private paused = false;

  // RSI batch buffer — collects synchronous onUpdate calls and flushes once per
  // microtask into a single store write.
  private rsiBatchBuffer: Array<[string, RSIData]> = [];
  private rsiBatchScheduled = false;

  // RSI cache save (debounced).
  private saveRsiCacheTimeout: NodeJS.Timeout | null = null;

  constructor(
    adapter: ExchangeAdapter,
    store: MarketStore,
    cache: ExchangeCache,
    callbacks: ExchangeControllerCallbacks
  ) {
    this.adapter = adapter;
    this.store = store;
    this.cache = cache;
    this.cb = callbacks;
  }

  // ───────────────────────── RSI batching ────────────────────────────────
  private saveRsiCacheDebounced(rsiMap: Map<string, RSIData>) {
    if (this.saveRsiCacheTimeout) clearTimeout(this.saveRsiCacheTimeout);
    this.saveRsiCacheTimeout = setTimeout(() => {
      this.cache.rsi.set(rsiMap);
    }, TIMING.RSI_CACHE_SAVE_DEBOUNCE);
  }

  private flushRsiBatch = () => {
    this.rsiBatchScheduled = false;
    const batch = this.rsiBatchBuffer;
    if (batch.length === 0) return;
    this.rsiBatchBuffer = [];
    this.store.mergeRsi(batch);
    this.saveRsiCacheDebounced(this.store.getSnapshot().rsiData);
  };

  /** Single-instrument RSI update — buffered, flushed on next microtask. */
  private updateRsiData = (instId: string, data: RSIData) => {
    this.rsiBatchBuffer.push([instId, data]);
    if (!this.rsiBatchScheduled) {
      this.rsiBatchScheduled = true;
      Promise.resolve().then(this.flushRsiBatch);
    }
  };

  // ───────────────────────── universe ────────────────────────────────────
  /**
   * Recompute the active universe from the data manager's full instrument list
   * and push it down. Runs whenever an input changes: tickers first loaded,
   * market cap (initial / refresh / fallback) and spot symbols. Until every
   * input is known it waits (the table stays in skeleton) rather than showing —
   * and fetching for — instruments that are about to be cut; the fallback timer
   * bounds that wait.
   */
  private refreshUniverse(): void {
    const dm = this.dataManager;
    if (this.inactive || !dm) return;
    const all = dm.getTickers();
    if (all.size === 0) return;
    const { marketCapData, spotSymbols } = this.store.getSnapshot();
    if (marketCapData.size === 0 && !this.marketCapFallback) return;
    if (this.adapter.features.excludeNoSpotCrypto && spotSymbols.size === 0 && !this.spotFallback) return;

    const volUsd = (t: ProcessedTicker) => (parseFloat(t.volCcy24h) || 0) * t.priceNum;
    const order = selectUniverse(
      this.adapter.preFilterTickers(Array.from(all.values())),
      marketCapData,
      this.getSpotUniverseContext()
    )
      .sort((a, b) => {
        const rankA = marketCapData.get(a.baseSymbol)?.rank ?? Number.MAX_SAFE_INTEGER;
        const rankB = marketCapData.get(b.baseSymbol)?.rank ?? Number.MAX_SAFE_INTEGER;
        if (rankA !== rankB) return rankA - rankB;
        return volUsd(b) - volUsd(a);
      })
      .map((t) => t.instId);
    const next = new Set(order);
    const prev = this.universe;

    this.universeOrder = order;
    // Always push: after resume() the data manager is fresh and has no universe.
    dm.setUniverse(next);
    if (prev && sameSet(prev, next)) return;

    this.universe = next;
    // One line per actual universe change — the fastest way to tell a healthy
    // board from a collapsed one (and which input collapsed it) after the fact.
    console.log(
      `[Universe] ${next.size} instruments ` +
      `(from ${all.size} tickers, ${marketCapData.size} ranked coins, ${spotSymbols.size} spot symbols)`
    );
    // New members need RSI + funding now, not at the next refresh interval.
    const grew = !prev || order.some((id) => !prev.has(id));
    if (grew) this.scheduleUniverseFetches();
  }

  /**
   * Cold-start escape hatch for a missing universe input (nothing cached, fetch
   * failed or slow): no market cap → rank by 24h volume; no spot symbols → skip
   * the no-spot cut (see selectUniverse). Real data takes over when it lands.
   */
  private enableUniverseFallback(which: { marketCap?: boolean; spot?: boolean }): void {
    if (this.inactive) return;
    const { marketCapData, spotSymbols } = this.store.getSnapshot();
    if (which.marketCap && !this.marketCapFallback && marketCapData.size === 0) {
      console.warn('[Universe] Market cap unavailable — ranking by 24h volume');
      this.marketCapFallback = true;
    }
    if (which.spot && !this.spotFallback && spotSymbols.size === 0) {
      console.warn('[Universe] Spot symbols unavailable — skipping the no-spot cut');
      this.spotFallback = true;
    }
    this.refreshUniverse();
  }

  /**
   * RSI + funding pass shortly after the universe appears / grows. The short
   * delay deduplicates bursts (market cap then spot landing back-to-back) and
   * lets the no-spot cut settle before the funding fan-out.
   */
  private scheduleUniverseFetches(): void {
    this.fundingPending = true;
    if (this.universeFetchTimeout) return;
    this.universeFetchTimeout = setTimeout(() => {
      this.universeFetchTimeout = null;
      void this.fetchRsi();
      if (this.fundingPending) {
        this.fundingPending = false;
        void this.refreshFunding();
      }
    }, TIMING.INITIAL_RSI_FETCH_DELAY);
  }

  /**
   * Spot context for the universe's no-spot crypto cut (OKX only). Null when
   * the adapter has no spot data — selectUniverse then skips the cut. Also
   * degrades gracefully while the spot set is still empty (not yet loaded).
   */
  private getSpotUniverseContext(): SpotUniverseContext | null {
    if (!this.adapter.features.excludeNoSpotCrypto) return null;
    return {
      spotSymbols: this.store.getSnapshot().spotSymbols,
      spotSymbolFormat: this.adapter.spotSymbolFormat,
    };
  }

  /**
   * Load spot symbols / listings. Each part is null when its fetch failed
   * (adapter contract) — previous store data is kept for that part and the load
   * retries with exponential backoff until every required part succeeds (or
   * retries are exhausted). This prevents the "transient OKX hiccup wipes spot
   * for the whole session" failure mode.
   */
  private loadInitialData(attempt = 0): void {
    const MAX_RETRIES = 3;
    this.adapter
      .fetchInitialData()
      .then((initialData) => {
        if (this.inactive) return; // ← Don't update store if disposed/paused
        if (initialData.spotSymbols) {
          this.store.setSpot(initialData.spotSymbols);
          spotSymbolsCache.set(Array.from(initialData.spotSymbols));
          this.refreshUniverse();
        }
        if (initialData.listingData) this.store.setListing(initialData.listingData);

        const incomplete =
          (this.adapter.features.excludeNoSpotCrypto && !initialData.spotSymbols) ||
          (this.adapter.features.listingDates && !initialData.listingData);
        if (incomplete && attempt < MAX_RETRIES) {
          this.scheduleInitialDataRetry(attempt);
        }
      })
      .catch((error) => {
        // fetchInitialData itself should not reject (parts fail as null), but
        // guard anyway so a bug here can't kill the retry chain silently.
        console.error('[InitialData] Failed to fetch:', error);
        if (!this.inactive && attempt < MAX_RETRIES) {
          this.scheduleInitialDataRetry(attempt);
        }
      });
  }

  private scheduleInitialDataRetry(attempt: number): void {
    const delay = TIMING.INITIAL_DATA_RETRY_BASE * Math.pow(2, attempt);
    console.warn(`[InitialData] Incomplete — retrying in ${delay / 1000}s (attempt ${attempt + 1})`);
    const retryTimeout = setTimeout(() => this.loadInitialData(attempt + 1), delay);
    this.timeouts.push(retryTimeout);
  }

  /**
   * Funding for the universe (exchanges with a separate funding fetch — OKX;
   * Hyperliquid extracts it from tickers). A failure keeps the last good data;
   * while there is none yet, it retries with backoff.
   */
  private async refreshFunding(attempt = 0): Promise<void> {
    const universe = this.universe;
    if (!this.adapter.fetchFundingRates || this.inactive || !universe) return;
    const MAX_RETRIES = 3;
    try {
      const rates = await this.adapter.fetchFundingRates(universe);
      if (this.inactive) return;
      this.store.setFunding(rates);
    } catch (error) {
      console.error('[Funding] Fetch failed, keeping previous data:', error);
      if (!this.inactive && attempt < MAX_RETRIES && this.store.getSnapshot().fundingRateData.size === 0) {
        const delay = TIMING.INITIAL_DATA_RETRY_BASE * Math.pow(2, attempt);
        this.timeouts.push(setTimeout(() => void this.refreshFunding(attempt + 1), delay));
      }
    }
  }

  /** Fetch RSI for the universe — cancellable via AbortController, optional tier filtering. */
  private async fetchRsi(tier?: 'top50' | 'tier2' | 'tier3'): Promise<void> {
    if (this.inactive || this.universeOrder.length === 0) return;
    if (this.isFetchingRsi) {
      // A full pass requested mid-fetch (universe grew) runs right after.
      if (!tier) this.rsiRerunPending = true;
      return;
    }
    const controller = new AbortController();
    this.rsiAbort = controller;
    this.isFetchingRsi = true;
    try {
      await this.adapter.fetchRSIBatch(
        this.universeOrder,
        this.store.getSnapshot().rsiData,
        this.cb.onRsiProgress,
        this.updateRsiData,
        tier,
        controller.signal
      );
    } finally {
      // A run aborted by teardown() must not clobber the flags of a newer run.
      if (this.rsiAbort === controller) {
        this.rsiAbort = null;
        this.isFetchingRsi = false;
        if (this.rsiRerunPending && !this.inactive) {
          this.rsiRerunPending = false;
          void this.fetchRsi();
        }
      }
    }
  }

  // ───────────────────────── lifecycle ───────────────────────────────────

  /** Acquisition should neither run nor commit results when disposed (unmounted)
   *  or paused (page hidden). Async fetches and timers check this before writing. */
  private get inactive(): boolean {
    return this.disposed || this.paused;
  }

  async initialize(): Promise<void> {
    this.disposed = false;
    this.paused = false;
    checkVersionAndClearCache();

    // Load cached RSI (instant paint of indicators on revisit).
    const cachedRsi = this.cache.rsi.get();
    if (cachedRsi && cachedRsi.size > 0) {
      this.store.setRsi(cachedRsi);
    }

    // Load cached market cap + spot symbols — the universe inputs, so a revisit
    // shows its rows as soon as the ticker list lands.
    const cachedMarketCap = getMarketCapCache();
    if (cachedMarketCap) {
      this.store.setMarketCap(cachedMarketCap);
    }
    if (this.adapter.features.excludeNoSpotCrypto) {
      const cachedSpot = spotSymbolsCache.get();
      if (cachedSpot && cachedSpot.length > 0) this.store.setSpot(new Set(cachedSpot));
    }

    await this.startAcquisition();
  }

  /**
   * Stand up all live data ACQUISITION: the data manager (WebSocket + REST
   * polling), the one-shot initial fetches, and every refresh interval. Split
   * out of initialize() so resume() can re-establish acquisition after pause()
   * WITHOUT re-running the version check / cache seeding — the store already
   * holds the last data. Bails if disposed or paused mid-async-start.
   */
  private async startAcquisition(): Promise<void> {
    // Create and start the data manager.
    const handleTickerUpdate = (newTickers: Map<string, ProcessedTicker>) => {
      if (this.inactive) return; // ← Don't update store if disposed/paused

      // newTickers is the universe slice only (see BaseDataManager.emitTickers).
      this.store.setTickers(newTickers);
      // Extract funding from tickers for exchanges that embed it (Hyperliquid).
      if (this.adapter.extractFundingFromTickers) {
        const funding = this.adapter.extractFundingFromTickers(newTickers);
        this.store.setFunding(funding);
      }

      // Prune RSI for instruments that were delisted or left the universe.
      // The store no-ops (no commit) when there is nothing to prune.
      const validKeys = new Set(newTickers.keys());
      this.store.prune(validKeys);

      // MA Flow data is managed by its own hook — prune via callback.
      this.cb.pruneMAFlow(validKeys);
    };

    const handleStatusUpdate = (
      newStatus: 'connecting' | 'live' | 'error',
      time?: Date
    ) => {
      if (this.inactive) return; // ← Don't update state if disposed/paused
      this.cb.onStatus(newStatus, time);
    };

    this.dataManager = this.adapter.createDataManager(handleTickerUpdate, handleStatusUpdate);

    // Universe inputs, fetched in parallel with the ticker list (non-blocking).
    // Market cap defines the ranking; spot symbols (OKX) drive the no-spot cut.
    // Each landing re-runs refreshUniverse (a no-op until tickers are in).
    fetchMarketCapData()
      .then((marketCap) => {
        if (this.inactive) return; // ← Don't update store if disposed/paused
        console.log(`[MarketCap] Received ${marketCap.size} coins`);
        this.store.setMarketCap(marketCap);
        setMarketCapCache(marketCap);
        this.refreshUniverse();
      })
      .catch((error) => {
        // Fetch rejected — keep whatever (cached) market-cap data is already in
        // the store rather than clobbering it. See fetchMarketCapData contract.
        console.error('[MarketCap] Initial fetch failed, keeping cached data:', error);
        this.enableUniverseFallback({ marketCap: true });
      });
    // Spot symbols + listing dates (universe-independent, one request each).
    // Funding is universe-dependent and runs from scheduleUniverseFetches.
    this.loadInitialData();
    // Cold start: don't hold the table in skeleton if an input is slow/failing.
    if (!this.universe) {
      this.timeouts.push(
        setTimeout(
          () => this.enableUniverseFallback({ marketCap: true, spot: true }),
          TIMING.UNIVERSE_FALLBACK_DELAY
        )
      );
    }

    // Start the ticker feed. Rows paint as soon as the universe is known — right
    // after this on a revisit (cached inputs), else when the inputs land.
    await this.dataManager.start();
    if (this.inactive) {
      // ← Bail if cleanup/pause ran during start(). teardown() may already have
      //    stopped+nulled the manager, so guard with ?. before stopping again.
      this.dataManager?.stop();
      this.dataManager = null;
      return;
    }
    this.refreshUniverse();

    // Initial RSI + funding pass. On resume the universe is unchanged, so
    // refreshUniverse() won't schedule it; on a cold start this no-ops until
    // the universe appears (which schedules its own pass).
    this.scheduleUniverseFetches();

    // Tiered RSI refresh intervals.
    this.intervals.push(
      setInterval(() => void this.fetchRsi('top50'), TIMING.RSI_REFRESH_TOP50)
    );
    this.intervals.push(
      setInterval(() => void this.fetchRsi('tier2'), TIMING.RSI_REFRESH_TIER2)
    );
    this.intervals.push(
      setInterval(() => void this.fetchRsi('tier3'), TIMING.RSI_REFRESH_TIER3)
    );

    // MA Flow (OKX only).
    if (this.adapter.features.maFlow) {
      // The store holds only the universe slice, so MA Flow is capped to it too.
      const tryFetchMAFlow = (retriesLeft: number) => {
        const retry = () => {
          if (retriesLeft > 0) {
            this.timeouts.push(setTimeout(() => tryFetchMAFlow(retriesLeft - 1), 5000));
          }
        };
        // Empty until the universe is known (cold start) — retry rather than give up.
        const currentTickers = this.store.getSnapshot().tickers;
        if (currentTickers.size === 0) {
          retry();
          return;
        }
        this.cb.fetchMAFlow(currentTickers).then((didFetch) => {
          if (!didFetch) retry();
        });
      };
      const initialMAFlowTimeout = setTimeout(
        () => tryFetchMAFlow(6),
        MA_FLOW.INITIAL_FETCH_DELAY
      );
      this.timeouts.push(initialMAFlowTimeout);

      this.intervals.push(
        setInterval(() => {
          const currentTickers = this.store.getSnapshot().tickers;
          if (currentTickers.size > 0) {
            this.cb.fetchMAFlow(currentTickers);
          }
        }, MA_FLOW.REFRESH_INTERVAL)
      );
    }

    // Refresh market cap.
    this.intervals.push(
      setInterval(async () => {
        try {
          const newMarketCap = await fetchMarketCapData();
          if (this.inactive) return;
          this.store.setMarketCap(newMarketCap);
          setMarketCapCache(newMarketCap);
          this.refreshUniverse(); // rank changes at the cut move instruments in/out
        } catch (error) {
          // Transient upstream failure — keep the last good market-cap data
          // rather than overwriting it with nothing (which would collapse the
          // default market-cap sort and uncap the universe).
          console.error('[MarketCap] Refresh failed, keeping previous data:', error);
        }
      }, TIMING.MARKET_CAP_REFRESH)
    );

    // Refresh funding rates (OKX only — Hyperliquid extracts from tickers).
    if (this.adapter.fetchFundingRates) {
      this.intervals.push(
        setInterval(() => void this.refreshFunding(), TIMING.FUNDING_RATES_REFRESH)
      );
    }
  }

  /**
   * Stop all acquisition: abort in-flight RSI, clear every timer, stop the data
   * manager (closes the WebSocket + REST polling). Does NOT set any flag and does
   * NOT touch the store, so the last-seen data stays on screen. Shared by pause()
   * and dispose().
   */
  private teardown(): void {
    // Abort RSI fetch loop immediately.
    this.rsiAbort?.abort();
    this.rsiAbort = null;
    this.isFetchingRsi = false;
    this.rsiRerunPending = false;
    if (this.universeFetchTimeout) {
      clearTimeout(this.universeFetchTimeout);
      this.universeFetchTimeout = null;
    }
    this.fundingPending = false;

    this.intervals.forEach(clearInterval);
    this.intervals = [];
    this.timeouts.forEach(clearTimeout);
    this.timeouts = [];
    if (this.saveRsiCacheTimeout) {
      clearTimeout(this.saveRsiCacheTimeout);
      this.saveRsiCacheTimeout = null;
    }
    // Drop any pending RSI batch buffer.
    this.rsiBatchBuffer = [];
    this.rsiBatchScheduled = false;

    if (this.adapter.features.maFlow) {
      this.cb.cleanupMAFlow();
    }
    this.dataManager?.stop();
    this.dataManager = null;
  }

  /**
   * Pause acquisition when the page is hidden (tab switch / app backgrounded /
   * screen lock). Closes the WebSocket, clears all refresh timers and aborts the
   * RSI loop, so a backgrounded tab consumes zero network/CPU — and can no longer
   * clobber good data with a failed background refresh. The store is left intact,
   * so resume() repaints instantly from the last data before refreshing.
   */
  pause(): void {
    if (this.disposed || this.paused) return;
    this.paused = true;
    this.teardown();
  }

  /**
   * Resume acquisition when the page becomes visible again: reconnect the data
   * manager, re-run the one-shot fetches and restart every refresh interval.
   * No-op unless currently paused (and not disposed).
   */
  resume(): void {
    if (this.disposed || !this.paused) return;
    this.paused = false;
    void this.startAcquisition();
  }

  /** Tear down for unmount — like pause() but permanent (initialize() bails). */
  dispose(): void {
    // Mark disposed so initialize() and callbacks bail out.
    this.disposed = true;
    this.teardown();
  }
}
