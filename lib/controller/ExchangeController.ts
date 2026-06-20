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
    return this.adapter
      .preFilterTickers(Array.from(tickerMap.values()))
      .sort((a, b) => {
        const rankA = marketCapData.get(a.baseSymbol)?.rank ?? Number.MAX_SAFE_INTEGER;
        const rankB = marketCapData.get(b.baseSymbol)?.rank ?? Number.MAX_SAFE_INTEGER;
        if (rankA !== rankB) return rankA - rankB;
        return volUsd(b) - volUsd(a);
      })
      .map((t) => t.instId);
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
  async initialize(): Promise<void> {
    this.disposed = false;
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

    // Create and start the data manager.
    const handleTickerUpdate = (newTickers: Map<string, ProcessedTicker>) => {
      if (this.disposed) return; // ← Don't update store if disposed

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
      if (this.disposed) return; // ← Don't update state if disposed
      this.cb.onStatus(newStatus, time);
    };

    this.dataManager = this.adapter.createDataManager(handleTickerUpdate, handleStatusUpdate);
    // Start the ticker feed FIRST so the row list paints immediately — it depends
    // on nothing from fetchInitialData (spot/listing/funding only feed columns &
    // filters). Awaiting fetchInitialData here previously blocked first paint
    // behind ~250 throttled funding-rate requests (the funding fan-out shares the
    // 8 req/s OKX limiter), so the table sat in skeleton state for ~30s.
    await this.dataManager.start();
    if (this.disposed) {
      // ← Bail if cleanup ran during start()
      this.dataManager.stop();
      this.dataManager = null;
      return;
    }

    // Fetch market-cap data (non-blocking — feeds ranks/sorting, not the row list).
    fetchMarketCapData()
      .then((marketCap) => {
        if (this.disposed) return; // ← Don't update store if disposed
        console.log(`[MarketCap] Received ${marketCap.size} coins`);
        this.store.setMarketCap(marketCap);
        setMarketCapCache(marketCap);
      })
      .catch((error) => {
        console.error('[MarketCap] Failed to fetch:', error);
      });

    // Fetch exchange-specific initial data in the BACKGROUND (spot symbols,
    // listings, funding). The OKX funding fetch fans out ~250 throttled requests,
    // so it must not block first paint; columns/filters that need it fill in
    // progressively once it resolves.
    this.adapter
      .fetchInitialData()
      .then((initialData) => {
        if (this.disposed) return; // ← Don't update store if disposed
        this.store.setSpot(initialData.spotSymbols);
        if (initialData.listingData) this.store.setListing(initialData.listingData);
        if (initialData.fundingRateData) this.store.setFunding(initialData.fundingRateData);
      })
      .catch((error) => {
        console.error('[InitialData] Failed to fetch:', error);
      });

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
        const newMarketCap = await fetchMarketCapData();
        if (this.disposed) return;
        this.store.setMarketCap(newMarketCap);
        setMarketCapCache(newMarketCap);
      }, TIMING.MARKET_CAP_REFRESH)
    );

    // Refresh funding rates (OKX only — Hyperliquid extracts from tickers).
    if (this.adapter.features.separateFundingFetch) {
      const { fetchFundingRates } = await import('@/lib/api/okx-rest');
      this.intervals.push(
        setInterval(async () => {
          const newFundingRates = await fetchFundingRates();
          if (this.disposed) return;
          this.store.setFunding(newFundingRates);
        }, TIMING.FUNDING_RATES_REFRESH)
      );
    }
  }

  /** Tear down — aborts in-flight RSI fetches instantly and clears all timers. */
  dispose(): void {
    // Mark disposed so initialize() and callbacks bail out.
    this.disposed = true;

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
}
