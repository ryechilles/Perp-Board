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
import { selectUniverse, selectUniverseInstIds } from '@/lib/filters';
import { TIMING, MA_FLOW } from '@/lib/constants';
import {
  getMarketCapCache,
  setMarketCapCache,
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

  // ───────────────────────── RSI fetch ───────────────────────────────────
  /**
   * Instrument IDs sorted by market-cap rank (uses adapter pre-filter).
   *
   * Rank is primary; when it's missing (and especially if the market-cap source
   * is fully down), entries fall back to 24h USD volume descending instead of an
   * arbitrary input order — so RSI tier ordering degrades gracefully rather than
   * going random when CoinLore is unavailable.
   */
  private getSortedInstIds(tickerMap: Map<string, ProcessedTicker>): string[] {
    const marketCapData = this.store.getSnapshot().marketCapData;
    const volUsd = (t: ProcessedTicker) => (parseFloat(t.volCcy24h) || 0) * t.priceNum;
    // Cap to the active universe (top-N crypto by rank + stock perps) so RSI is
    // only fetched for that set — the 100+ tier3 work disappears entirely.
    const universe = selectUniverse(
      this.adapter.preFilterTickers(Array.from(tickerMap.values())),
      marketCapData
    );
    return universe
      .sort((a, b) => {
        const rankA = marketCapData.get(a.baseSymbol)?.rank ?? Number.MAX_SAFE_INTEGER;
        const rankB = marketCapData.get(b.baseSymbol)?.rank ?? Number.MAX_SAFE_INTEGER;
        if (rankA !== rankB) return rankA - rankB;
        return volUsd(b) - volUsd(a);
      })
      .map((t) => t.instId);
  }

  /**
   * Build the capped-universe instId set for gating the OKX funding fan-out.
   * Returns undefined when tickers or market-cap data aren't ready yet — callers
   * then fetch the full set (graceful cold-start fallback).
   */
  private getUniverseInstIds(): Set<string> | undefined {
    const tickers = this.dataManager?.getTickers();
    if (!tickers || tickers.size === 0) return undefined;
    const marketCapData = this.store.getSnapshot().marketCapData;
    if (marketCapData.size === 0) return undefined;
    return selectUniverseInstIds(
      this.adapter.preFilterTickers(Array.from(tickers.values())),
      marketCapData
    );
  }

  /**
   * Load spot symbols / listings / funding. Each part is null when its fetch
   * failed (adapter contract) — previous store data is kept for that part and
   * the load retries with exponential backoff until every required part
   * succeeds (or retries are exhausted). This prevents the "transient OKX
   * hiccup wipes funding + spot for the whole session" failure mode.
   */
  private loadInitialData(attempt = 0): void {
    const MAX_RETRIES = 3;
    this.adapter
      .fetchInitialData(this.getUniverseInstIds())
      .then((initialData) => {
        if (this.inactive) return; // ← Don't update store if disposed/paused
        if (initialData.spotSymbols) this.store.setSpot(initialData.spotSymbols);
        if (initialData.listingData) this.store.setListing(initialData.listingData);
        if (initialData.fundingRateData) this.store.setFunding(initialData.fundingRateData);

        const incomplete =
          !initialData.spotSymbols ||
          (this.adapter.features.listingDates && !initialData.listingData) ||
          (this.adapter.features.separateFundingFetch && !initialData.fundingRateData);
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

  /** Fetch RSI — cancellable via AbortController, optional tier filtering. */
  private async fetchRsi(
    tickerMap: Map<string, ProcessedTicker>,
    tier?: 'top50' | 'tier2' | 'tier3'
  ): Promise<void> {
    if (this.isFetchingRsi) return;
    // Abort any previous RSI fetch before starting a new one.
    this.rsiAbort?.abort();
    const controller = new AbortController();
    this.rsiAbort = controller;
    this.isFetchingRsi = true;
    try {
      const instIds = this.getSortedInstIds(tickerMap);
      const rsiData = this.store.getSnapshot().rsiData;
      await this.adapter.fetchRSIBatch(
        instIds,
        rsiData,
        this.cb.onRsiProgress,
        this.updateRsiData,
        tier,
        controller.signal
      );
    } finally {
      this.isFetchingRsi = false;
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

    // Load cached market cap.
    const cachedMarketCap = getMarketCapCache();
    if (cachedMarketCap) {
      this.store.setMarketCap(cachedMarketCap);
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

      this.store.setTickers(newTickers);
      // Extract funding from tickers for exchanges that embed it (Hyperliquid).
      if (this.adapter.extractFundingFromTickers) {
        const funding = this.adapter.extractFundingFromTickers(newTickers);
        this.store.setFunding(funding);
      }

      // Prune orphaned rsi/listing entries when instruments are delisted.
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
    // Start the ticker feed FIRST so the row list paints immediately — it depends
    // on nothing from fetchInitialData (spot/listing/funding only feed columns &
    // filters). Awaiting fetchInitialData here previously blocked first paint
    // behind ~250 throttled funding-rate requests (the funding fan-out shares the
    // 8 req/s OKX limiter), so the table sat in skeleton state for ~30s.
    await this.dataManager.start();
    if (this.inactive) {
      // ← Bail if cleanup/pause ran during start(). teardown() may already have
      //    stopped+nulled the manager, so guard with ?. before stopping again.
      this.dataManager?.stop();
      this.dataManager = null;
      return;
    }

    // Fetch market-cap data (non-blocking — feeds ranks/sorting, not the row list).
    fetchMarketCapData()
      .then((marketCap) => {
        if (this.inactive) return; // ← Don't update store if disposed/paused
        console.log(`[MarketCap] Received ${marketCap.size} coins`);
        this.store.setMarketCap(marketCap);
        setMarketCapCache(marketCap);
      })
      .catch((error) => {
        // Fetch rejected — keep whatever (cached) market-cap data is already in
        // the store rather than clobbering it. See fetchMarketCapData contract.
        console.error('[MarketCap] Initial fetch failed, keeping cached data:', error);
      });

    // Fetch exchange-specific initial data in the BACKGROUND (spot symbols,
    // listings, funding). The OKX funding fetch fans out ~250 throttled requests,
    // so it must not block first paint; columns/filters that need it fill in
    // progressively once it resolves. Failed parts come back as null (previous
    // data is kept) and the whole load retries with backoff until complete.
    this.loadInitialData();

    // Initial RSI fetch (all tiers).
    const initialRsiTimeout = setTimeout(() => {
      const currentTickers = this.dataManager?.getTickers();
      if (currentTickers && currentTickers.size > 0) {
        this.fetchRsi(currentTickers);
      }
    }, TIMING.INITIAL_RSI_FETCH_DELAY);
    this.timeouts.push(initialRsiTimeout);

    // Tiered RSI refresh intervals.
    this.intervals.push(
      setInterval(() => {
        const currentTickers = this.dataManager?.getTickers();
        if (currentTickers && currentTickers.size > 0) {
          this.fetchRsi(currentTickers, 'top50');
        }
      }, TIMING.RSI_REFRESH_TOP50)
    );
    this.intervals.push(
      setInterval(() => {
        const currentTickers = this.dataManager?.getTickers();
        if (currentTickers && currentTickers.size > 0) {
          this.fetchRsi(currentTickers, 'tier2');
        }
      }, TIMING.RSI_REFRESH_TIER2)
    );
    this.intervals.push(
      setInterval(() => {
        const currentTickers = this.dataManager?.getTickers();
        if (currentTickers && currentTickers.size > 0) {
          this.fetchRsi(currentTickers, 'tier3');
        }
      }, TIMING.RSI_REFRESH_TIER3)
    );

    // MA Flow (OKX only).
    if (this.adapter.features.maFlow) {
      const tryFetchMAFlow = (retriesLeft: number) => {
        const currentTickers = this.dataManager?.getTickers();
        if (currentTickers && currentTickers.size > 0) {
          this.cb.fetchMAFlow(currentTickers).then((didFetch) => {
            if (!didFetch && retriesLeft > 0) {
              const retryTimeout = setTimeout(
                () => tryFetchMAFlow(retriesLeft - 1),
                5000
              );
              this.timeouts.push(retryTimeout);
            }
          });
        }
      };
      const initialMAFlowTimeout = setTimeout(
        () => tryFetchMAFlow(6),
        MA_FLOW.INITIAL_FETCH_DELAY
      );
      this.timeouts.push(initialMAFlowTimeout);

      this.intervals.push(
        setInterval(() => {
          const currentTickers = this.dataManager?.getTickers();
          if (currentTickers && currentTickers.size > 0) {
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
        } catch (error) {
          // Transient upstream failure — keep the last good market-cap data
          // rather than overwriting it with nothing (which would collapse the
          // default market-cap sort and uncap the universe).
          console.error('[MarketCap] Refresh failed, keeping previous data:', error);
        }
      }, TIMING.MARKET_CAP_REFRESH)
    );

    // Refresh funding rates (OKX only — Hyperliquid extracts from tickers).
    if (this.adapter.features.separateFundingFetch) {
      const { fetchFundingRates } = await import('@/lib/api/okx-rest');
      this.intervals.push(
        setInterval(async () => {
          try {
            // Cap the funding fan-out to the active universe (~100 instead of ~250).
            const newFundingRates = await fetchFundingRates(this.getUniverseInstIds());
            if (this.inactive) return;
            this.store.setFunding(newFundingRates);
          } catch (error) {
            // Transient upstream failure — keep the last good funding data
            // rather than wiping the column until the next refresh.
            console.error('[Funding] Refresh failed, keeping previous data:', error);
          }
        }, TIMING.FUNDING_RATES_REFRESH)
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
