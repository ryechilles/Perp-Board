'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  ProcessedTicker,
  RSIData,
  FundingRateData,
  ListingData,
  MarketCapData,
  MAFlowData,
  ExchangeAdapter,
  DataManager,
} from '@/lib/types';
import { fetchMarketCapData } from '@/lib/api/coingecko';
import { filterAndSort, FilterContext } from '@/lib/filters';
import { calculateRsiAverages, calculateTopMovers, calculateQuickFilterCounts } from '@/lib/store-utils';
import { TIMING, MA_FLOW } from '@/lib/constants';
import { getCacheForExchange, getMarketCapCache, setMarketCapCache, checkVersionAndClearCache } from '@/lib/cache';

// Import composed hooks
import { useColumns } from './useColumns';
import { useFavorites } from './useFavorites';
import { useFilters } from './useFilters';
import { usePagination } from './usePagination';
import { useMAFlowData } from './useMAFlowData';

/**
 * Unified exchange store hook
 * Parameterized by an ExchangeAdapter to handle OKX/Hyperliquid differences
 */
export function useExchangeStore(adapter: ExchangeAdapter) {
  const exchange = adapter.exchange;

  // Core data
  const [tickers, setTickers] = useState<Map<string, ProcessedTicker>>(new Map());
  const [rsiData, setRsiData] = useState<Map<string, RSIData>>(new Map());
  const [fundingRateData, setFundingRateData] = useState<Map<string, FundingRateData>>(new Map());
  const [listingData, setListingData] = useState<Map<string, ListingData>>(new Map());
  const [marketCapData, setMarketCapData] = useState<Map<string, MarketCapData>>(new Map());
  const [spotSymbols, setSpotSymbols] = useState<Set<string>>(new Set());

  // Composed hooks (exchange-aware)
  const columnsHook = useColumns(exchange);
  const favoritesHook = useFavorites(exchange);
  const paginationHook = usePagination();
  const filtersHook = useFilters(exchange, paginationHook.resetPage);

  // Status
  const [status, setStatus] = useState<'connecting' | 'live' | 'error'>('live');
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [rsiProgress, setRsiProgress] = useState('');
  const [urlInitialized, setUrlInitialized] = useState(false);

  // Refs
  const dataManagerRef = useRef<DataManager | null>(null);
  const isFetchingRsiRef = useRef(false);
  const intervalsRef = useRef<NodeJS.Timeout[]>([]);
  const timeoutsRef = useRef<NodeJS.Timeout[]>([]);
  const rsiAbortRef = useRef<AbortController | null>(null);
  const disposedRef = useRef(false);

  // RSI cache (exchange-specific)
  const cache = getCacheForExchange(exchange);
  const saveRsiCacheTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const saveRsiCacheDebounced = useCallback((rsiMap: Map<string, RSIData>) => {
    if (saveRsiCacheTimeoutRef.current) {
      clearTimeout(saveRsiCacheTimeoutRef.current);
    }
    saveRsiCacheTimeoutRef.current = setTimeout(() => {
      cache.rsi.set(rsiMap);
    }, TIMING.RSI_CACHE_SAVE_DEBOUNCE);
  }, [cache.rsi]);

  // Load RSI cache on mount
  useEffect(() => {
    const cachedRsi = cache.rsi.get();
    if (cachedRsi && cachedRsi.size > 0) {
      setRsiData(cachedRsi);
    }
  }, [cache.rsi]);

  // Batched RSI data updater — collects updates and flushes in a single setState via microtask
  const rsiBatchBufferRef = useRef<Array<[string, RSIData]>>([]);
  const rsiBatchScheduledRef = useRef(false);

  const flushRsiBatch = useCallback(() => {
    rsiBatchScheduledRef.current = false;
    const batch = rsiBatchBufferRef.current;
    if (batch.length === 0) return;
    rsiBatchBufferRef.current = [];
    setRsiData(prev => {
      const newMap = new Map(prev);
      for (const [id, data] of batch) {
        newMap.set(id, data);
      }
      saveRsiCacheDebounced(newMap);
      return newMap;
    });
  }, [saveRsiCacheDebounced]);

  const updateRsiData = useCallback((instId: string, data: RSIData) => {
    rsiBatchBufferRef.current.push([instId, data]);
    if (!rsiBatchScheduledRef.current) {
      rsiBatchScheduledRef.current = true;
      // Flush on next microtask — batches all synchronous onUpdate calls into one setState
      Promise.resolve().then(flushRsiBatch);
    }
  }, [flushRsiBatch]);

  // Get sorted instrument IDs by market cap rank
  const getSortedInstIds = useCallback((tickerMap: Map<string, ProcessedTicker>) => {
    return Array.from(tickerMap.values())
      .filter(t => {
        // OKX: filter to USDT swaps only
        if (exchange === 'okx') return t.instId.includes('-USDT-');
        return true;
      })
      .sort((a, b) => {
        const rankA = marketCapData.get(a.baseSymbol)?.rank ?? 9999;
        const rankB = marketCapData.get(b.baseSymbol)?.rank ?? 9999;
        return rankA - rankB;
      })
      .map(t => t.instId);
  }, [marketCapData, exchange]);

  // Fetch RSI (all tiers) — cancellable via AbortController
  const fetchRsiForVisible = useCallback(async (tickerMap: Map<string, ProcessedTicker>) => {
    if (isFetchingRsiRef.current) return;
    // Abort any previous RSI fetch before starting a new one
    rsiAbortRef.current?.abort();
    const controller = new AbortController();
    rsiAbortRef.current = controller;
    isFetchingRsiRef.current = true;
    try {
      const instIds = getSortedInstIds(tickerMap);
      await adapter.fetchRSIBatch(instIds, rsiData, setRsiProgress, updateRsiData, undefined, controller.signal);
    } finally {
      isFetchingRsiRef.current = false;
    }
  }, [getSortedInstIds, rsiData, updateRsiData, adapter]);

  // Fetch RSI for specific tier — cancellable via AbortController
  const fetchRsiForTier = useCallback(async (
    tickerMap: Map<string, ProcessedTicker>,
    tier: 'top50' | 'tier2' | 'tier3'
  ) => {
    if (isFetchingRsiRef.current) return;
    // Abort any previous RSI fetch before starting a new one
    rsiAbortRef.current?.abort();
    const controller = new AbortController();
    rsiAbortRef.current = controller;
    isFetchingRsiRef.current = true;
    try {
      const instIds = getSortedInstIds(tickerMap);
      await adapter.fetchRSIBatch(instIds, rsiData, setRsiProgress, updateRsiData, tier, controller.signal);
    } finally {
      isFetchingRsiRef.current = false;
    }
  }, [getSortedInstIds, rsiData, updateRsiData, adapter]);

  // MA Flow (OKX only)
  const getMAFlowInstIds = useCallback((tickerMap: Map<string, ProcessedTicker>) => {
    if (!adapter.features.maFlow) return [];
    return Array.from(tickerMap.values())
      .filter(t => t.instId.includes('-USDT-') && t.baseSymbol !== 'USDC' && marketCapData.has(t.baseSymbol))
      .sort((a, b) => {
        const rankA = marketCapData.get(a.baseSymbol)!.rank;
        const rankB = marketCapData.get(b.baseSymbol)!.rank;
        return rankA - rankB;
      })
      .map(t => t.instId);
  }, [marketCapData, adapter.features.maFlow]);

  const maFlowHook = useMAFlowData(getMAFlowInstIds);
  const fetchMAFlowRef = useRef(maFlowHook.fetchMAFlowForVisible);
  fetchMAFlowRef.current = maFlowHook.fetchMAFlowForVisible;
  const pruneMAFlowRef = useRef(maFlowHook.pruneEntries);
  pruneMAFlowRef.current = maFlowHook.pruneEntries;

  // Initialize
  const initialize = useCallback(async () => {
    disposedRef.current = false;
    checkVersionAndClearCache();

    // Load cached market cap
    const cachedMarketCap = getMarketCapCache();
    if (cachedMarketCap) {
      setMarketCapData(cachedMarketCap);
    }

    // Fetch exchange-specific initial data (spot symbols, listings, funding)
    const initialData = await adapter.fetchInitialData();
    if (disposedRef.current) return; // ← Bail if cleanup already ran

    setSpotSymbols(initialData.spotSymbols);
    if (initialData.listingData) setListingData(initialData.listingData);
    if (initialData.fundingRateData) setFundingRateData(initialData.fundingRateData);

    // Fetch CoinGecko data (non-blocking)
    fetchMarketCapData().then((marketCap) => {
      if (disposedRef.current) return; // ← Don't update state if disposed
      console.log(`[MarketCap] Received ${marketCap.size} coins from CoinGecko`);
      setMarketCapData(marketCap);
      setMarketCapCache(marketCap);
    }).catch((error) => {
      console.error('[MarketCap] Failed to fetch:', error);
    });

    // Create and start data manager
    const handleTickerUpdate = (newTickers: Map<string, ProcessedTicker>) => {
      if (disposedRef.current) return; // ← Don't update state if disposed

      setTickers(newTickers);
      // Extract funding from tickers for exchanges that embed it (Hyperliquid)
      if (adapter.extractFundingFromTickers) {
        const funding = adapter.extractFundingFromTickers(newTickers);
        setFundingRateData(funding);
      }

      // Prune orphaned entries from dependent maps when instruments are delisted.
      // Uses functional updaters to avoid stale closures; returns prev ref if
      // nothing changed (React bails out, no extra re-render).
      const validKeys = new Set(newTickers.keys());

      setRsiData(prev => {
        let hasOrphans = false;
        for (const key of prev.keys()) {
          if (!validKeys.has(key)) { hasOrphans = true; break; }
        }
        if (!hasOrphans) return prev;
        const pruned = new Map<string, RSIData>();
        for (const [k, v] of prev) {
          if (validKeys.has(k)) pruned.set(k, v);
        }
        return pruned;
      });

      setListingData(prev => {
        let hasOrphans = false;
        for (const key of prev.keys()) {
          if (!validKeys.has(key)) { hasOrphans = true; break; }
        }
        if (!hasOrphans) return prev;
        const pruned = new Map<string, ListingData>();
        for (const [k, v] of prev) {
          if (validKeys.has(k)) pruned.set(k, v);
        }
        return pruned;
      });

      // MA Flow data is managed by its own hook — prune via ref
      pruneMAFlowRef.current(validKeys);
    };

    const handleStatusUpdate = (newStatus: 'connecting' | 'live' | 'error', time?: Date) => {
      if (disposedRef.current) return; // ← Don't update state if disposed
      setStatus(newStatus);
      if (time) setLastUpdate(time);
    };

    dataManagerRef.current = adapter.createDataManager(handleTickerUpdate, handleStatusUpdate);
    await dataManagerRef.current.start();
    if (disposedRef.current) { // ← Bail if cleanup ran during start()
      dataManagerRef.current.stop();
      dataManagerRef.current = null;
      return;
    }

    // Initial RSI fetch
    const initialRsiTimeout = setTimeout(() => {
      const currentTickers = dataManagerRef.current?.getTickers();
      if (currentTickers && currentTickers.size > 0) {
        fetchRsiForVisible(currentTickers);
      }
    }, TIMING.INITIAL_RSI_FETCH_DELAY);
    timeoutsRef.current.push(initialRsiTimeout);

    // Tiered RSI refresh intervals
    const rsiTop50Interval = setInterval(() => {
      const currentTickers = dataManagerRef.current?.getTickers();
      if (currentTickers && currentTickers.size > 0) {
        fetchRsiForTier(currentTickers, 'top50');
      }
    }, TIMING.RSI_REFRESH_TOP50);
    intervalsRef.current.push(rsiTop50Interval);

    const rsiTier2Interval = setInterval(() => {
      const currentTickers = dataManagerRef.current?.getTickers();
      if (currentTickers && currentTickers.size > 0) {
        fetchRsiForTier(currentTickers, 'tier2');
      }
    }, TIMING.RSI_REFRESH_TIER2);
    intervalsRef.current.push(rsiTier2Interval);

    const rsiTier3Interval = setInterval(() => {
      const currentTickers = dataManagerRef.current?.getTickers();
      if (currentTickers && currentTickers.size > 0) {
        fetchRsiForTier(currentTickers, 'tier3');
      }
    }, TIMING.RSI_REFRESH_TIER3);
    intervalsRef.current.push(rsiTier3Interval);

    // MA Flow (OKX only)
    if (adapter.features.maFlow) {
      const tryFetchMAFlow = (retriesLeft: number) => {
        const currentTickers = dataManagerRef.current?.getTickers();
        if (currentTickers && currentTickers.size > 0) {
          fetchMAFlowRef.current(currentTickers).then((didFetch) => {
            if (!didFetch && retriesLeft > 0) {
              const retryTimeout = setTimeout(() => tryFetchMAFlow(retriesLeft - 1), 5000);
              timeoutsRef.current.push(retryTimeout);
            }
          });
        }
      };
      const initialMAFlowTimeout = setTimeout(() => tryFetchMAFlow(6), MA_FLOW.INITIAL_FETCH_DELAY);
      timeoutsRef.current.push(initialMAFlowTimeout);

      const maFlowInterval = setInterval(() => {
        const currentTickers = dataManagerRef.current?.getTickers();
        if (currentTickers && currentTickers.size > 0) {
          fetchMAFlowRef.current(currentTickers);
        }
      }, MA_FLOW.REFRESH_INTERVAL);
      intervalsRef.current.push(maFlowInterval);
    }

    // Refresh market cap
    const marketCapInterval = setInterval(async () => {
      const newMarketCap = await fetchMarketCapData();
      setMarketCapData(newMarketCap);
      setMarketCapCache(newMarketCap);
    }, TIMING.MARKET_CAP_REFRESH);
    intervalsRef.current.push(marketCapInterval);

    // Refresh funding rates (OKX only — Hyperliquid extracts from tickers)
    if (adapter.features.separateFundingFetch) {
      const { fetchFundingRates } = await import('@/lib/api/okx-rest');
      const fundingRatesInterval = setInterval(async () => {
        const newFundingRates = await fetchFundingRates();
        setFundingRateData(newFundingRates);
      }, TIMING.FUNDING_RATES_REFRESH);
      intervalsRef.current.push(fundingRatesInterval);
    }
  }, [adapter, fetchRsiForVisible, fetchRsiForTier, cache.rsi]);

  // Cleanup — aborts in-flight RSI fetches instantly
  const cleanup = useCallback(() => {
    // ── Mark as disposed so initialize() and callbacks bail out ──
    disposedRef.current = true;

    // ── Abort RSI fetch loop immediately ──
    rsiAbortRef.current?.abort();
    rsiAbortRef.current = null;
    isFetchingRsiRef.current = false;

    intervalsRef.current.forEach(clearInterval);
    intervalsRef.current = [];
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
    if (saveRsiCacheTimeoutRef.current) {
      clearTimeout(saveRsiCacheTimeoutRef.current);
      saveRsiCacheTimeoutRef.current = null;
    }
    // Flush any pending RSI batch buffer to avoid data loss
    rsiBatchBufferRef.current = [];
    rsiBatchScheduledRef.current = false;

    if (adapter.features.maFlow) {
      maFlowHook.cleanup();
    }
    dataManagerRef.current?.stop();
    dataManagerRef.current = null;
  }, [adapter.features.maFlow, maFlowHook]);

  // Filter context for the pipeline
  const filterCtx: FilterContext = useMemo(() => ({
    rsiData,
    marketCapData,
    fundingRateData,
    spotSymbols,
    listingData: adapter.features.listingDates ? listingData : undefined,
    spotSymbolFormat: adapter.spotSymbolFormat,
    defaultSettlementInterval: adapter.defaultSettlementInterval,
  }), [rsiData, marketCapData, fundingRateData, spotSymbols, listingData, adapter]);

  // Filtered + sorted data (memoized)
  const filteredData = useMemo(() => {
    return filterAndSort(
      tickers,
      filtersHook.searchTerm,
      filtersHook.view,
      favoritesHook.favorites,
      filtersHook.filters,
      filtersHook.sort,
      filterCtx,
      exchange === 'okx'
    );
  }, [tickers, filtersHook.searchTerm, filtersHook.view, favoritesHook.favorites, filtersHook.filters, filtersHook.sort, filterCtx, exchange]);

  const getFilteredData = useCallback(() => filteredData, [filteredData]);

  // RSI averages (memoized)
  const rsiAverages = useMemo(() => {
    return calculateRsiAverages(tickers, marketCapData, rsiData);
  }, [tickers, marketCapData, rsiData]);

  const getRsiAverages = useCallback(() => rsiAverages, [rsiAverages]);

  // Quick filter counts (memoized)
  const quickFilterCounts = useMemo(() => {
    return calculateQuickFilterCounts(tickers, rsiData);
  }, [tickers, rsiData]);

  const getQuickFilterCounts = useCallback(() => quickFilterCounts, [quickFilterCounts]);

  // Top movers
  const getTopMovers = useCallback((timeframe: '4h' | '24h' | '7d', limit: number = 5) => {
    return calculateTopMovers(tickers, rsiData, timeframe, limit);
  }, [tickers, rsiData]);

  // Paginated data
  const getPaginatedData = useCallback(() => {
    const { currentPage, pageSize } = paginationHook;
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return {
      data: filteredData.slice(startIndex, endIndex),
      totalPages: Math.ceil(filteredData.length / pageSize),
      totalItems: filteredData.length,
    };
  }, [filteredData, paginationHook]);

  return {
    // Data
    tickers,
    rsiData,
    fundingRateData,
    listingData,
    marketCapData,
    spotSymbols,
    maFlowData: maFlowHook.maFlowData,
    favorites: favoritesHook.favorites,

    // UI state
    columns: columnsHook.columns,
    columnOrder: columnsHook.columnOrder,
    filters: filtersHook.filters,
    sort: filtersHook.sort,
    view: filtersHook.view,
    searchTerm: filtersHook.searchTerm,
    status,
    lastUpdate,
    rsiProgress,
    currentPage: paginationHook.currentPage,
    pageSize: paginationHook.pageSize,
    urlInitialized,

    // Actions
    initialize,
    cleanup,
    toggleFavorite: favoritesHook.toggleFavorite,
    updateColumn: columnsHook.updateColumn,
    setColumnsPreset: columnsHook.setColumnsPreset,
    setFilters: filtersHook.setFilters,
    clearFilters: filtersHook.clearFilters,
    hasActiveFilters: filtersHook.hasActiveFilters,
    updateSort: filtersHook.updateSort,
    setSortDirectly: filtersHook.setSortDirectly,
    setView: filtersHook.setView,
    setSearchTerm: filtersHook.setSearchTerm,
    updateColumnOrder: columnsHook.updateColumnOrder,
    moveColumn: columnsHook.moveColumn,
    setCurrentPage: paginationHook.setCurrentPage,
    setUrlInitialized,

    // Direct setters for URL state sync
    setFavoritesDirectly: favoritesHook.setFavoritesDirectly,
    setColumnsDirectly: columnsHook.setColumnsDirectly,
    setColumnOrderDirectly: columnsHook.setColumnOrderDirectly,

    // Derived data
    getFilteredData,
    getRsiAverages,
    getTopMovers,
    getPaginatedData,
    getQuickFilterCounts,
  };
}
