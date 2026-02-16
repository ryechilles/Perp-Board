'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  ProcessedTicker,
  RSIData,
  FundingRateData,
  ListingData,
  MarketCapData,
} from '@/lib/types';
import {
  OKXHybridDataManager,
  fetchSpotSymbols,
  fetchRSIBatch,
  fetchMarketCapData,
  fetchFundingRates,
  fetchListingDates,
} from '@/lib/api';
import { isMemeToken, getRsiSignal } from '@/lib/utils';
import { calculateRsiAverages, calculateTopMovers, calculateQuickFilterCounts } from '@/lib/store-utils';
import { TIMING, MA_FLOW } from '@/lib/constants';
import {
  getRsiCache,
  setRsiCache,
  getMarketCapCache,
  setMarketCapCache,
  checkVersionAndClearCache,
} from '@/lib/cache';

// Import composed hooks
import { useColumns } from './useColumns';
import { useFavorites } from './useFavorites';
import { useFilters } from './useFilters';
import { usePagination } from './usePagination';
import { useMAFlowData } from './useMAFlowData';

export function useMarketStore() {
  // Core data
  const [tickers, setTickers] = useState<Map<string, ProcessedTicker>>(new Map());
  const [rsiData, setRsiData] = useState<Map<string, RSIData>>(new Map());
  const [fundingRateData, setFundingRateData] = useState<Map<string, FundingRateData>>(new Map());
  const [listingData, setListingData] = useState<Map<string, ListingData>>(new Map());
  const [marketCapData, setMarketCapData] = useState<Map<string, MarketCapData>>(new Map());
  const [spotSymbols, setSpotSymbols] = useState<Set<string>>(new Set());

  // Composed hooks
  const columnsHook = useColumns();
  const favoritesHook = useFavorites();
  const paginationHook = usePagination();

  // Pass pagination reset callback to filters hook
  const filtersHook = useFilters(paginationHook.resetPage);

  // Status - Always show 'live' as requested
  const [status, setStatus] = useState<'connecting' | 'live' | 'error'>('live');
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [rsiProgress, setRsiProgress] = useState('');
  const [urlInitialized, setUrlInitialized] = useState(false);

  // Refs for WebSocket and intervals
  const dataManagerRef = useRef<OKXHybridDataManager | null>(null);
  const isFetchingRsiRef = useRef(false);
  const intervalsRef = useRef<NodeJS.Timeout[]>([]);
  const timeoutsRef = useRef<NodeJS.Timeout[]>([]);

  // Save RSI data to cache (debounced)
  const saveRsiCacheTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const saveRsiCacheDebounced = useCallback((rsiMap: Map<string, RSIData>) => {
    if (saveRsiCacheTimeoutRef.current) {
      clearTimeout(saveRsiCacheTimeoutRef.current);
    }
    saveRsiCacheTimeoutRef.current = setTimeout(() => {
      setRsiCache(rsiMap);
    }, TIMING.RSI_CACHE_SAVE_DEBOUNCE);
  }, []);

  // Load RSI cache on mount
  useEffect(() => {
    const cachedRsi = getRsiCache();
    if (cachedRsi && cachedRsi.size > 0) {
      setRsiData(cachedRsi);
    }
  }, []);

  // Update RSI data for single instrument
  const updateRsiData = useCallback((instId: string, data: RSIData) => {
    setRsiData(prev => {
      const newMap = new Map(prev);
      newMap.set(instId, data);
      saveRsiCacheDebounced(newMap);
      return newMap;
    });
  }, [saveRsiCacheDebounced]);

  // Get sorted instrument IDs by market cap rank
  const getSortedInstIds = useCallback((tickerMap: Map<string, ProcessedTicker>) => {
    return Array.from(tickerMap.values())
      .filter(t => t.instId.includes('-USDT-'))
      .sort((a, b) => {
        const rankA = marketCapData.get(a.baseSymbol)?.rank ?? 9999;
        const rankB = marketCapData.get(b.baseSymbol)?.rank ?? 9999;
        return rankA - rankB;
      })
      .map(t => t.instId);
  }, [marketCapData]);

  // Fetch RSI for all items (initial load)
  const fetchRsiForVisible = useCallback(async (tickerMap: Map<string, ProcessedTicker>) => {
    if (isFetchingRsiRef.current) return;
    isFetchingRsiRef.current = true;

    try {
      const instIds = getSortedInstIds(tickerMap);
      await fetchRSIBatch(
        instIds,
        rsiData,
        setRsiProgress,
        updateRsiData
      );
    } finally {
      isFetchingRsiRef.current = false;
    }
  }, [getSortedInstIds, rsiData, updateRsiData]);

  // Fetch RSI for specific tier only
  const fetchRsiForTier = useCallback(async (
    tickerMap: Map<string, ProcessedTicker>,
    tier: 'top50' | 'tier2' | 'tier3'
  ) => {
    if (isFetchingRsiRef.current) return;
    isFetchingRsiRef.current = true;

    try {
      const instIds = getSortedInstIds(tickerMap);
      await fetchRSIBatch(
        instIds,
        rsiData,
        setRsiProgress,
        updateRsiData,
        tier
      );
    } finally {
      isFetchingRsiRef.current = false;
    }
  }, [getSortedInstIds, rsiData, updateRsiData]);

  // Get instrument IDs filtered to only those WITH market cap data, sorted by market cap
  // Used by MA Flow to ensure only Top N by market cap are processed
  const getMAFlowInstIds = useCallback((tickerMap: Map<string, ProcessedTicker>) => {
    return Array.from(tickerMap.values())
      .filter(t => t.instId.includes('-USDT-') && marketCapData.has(t.baseSymbol))
      .sort((a, b) => {
        const rankA = marketCapData.get(a.baseSymbol)!.rank;
        const rankB = marketCapData.get(b.baseSymbol)!.rank;
        return rankA - rankB;
      })
      .map(t => t.instId);
  }, [marketCapData]);

  // MA Flow data hook (extracted for cleaner separation of concerns)
  const maFlowHook = useMAFlowData(getMAFlowInstIds);

  // Market cap cache helpers
  const saveMarketCapCacheLocal = useCallback((data: Map<string, MarketCapData>) => {
    setMarketCapCache(data);
  }, []);

  const loadMarketCapCacheLocal = useCallback((): Map<string, MarketCapData> | null => {
    return getMarketCapCache();
  }, []);

  // Initialize hybrid data manager (WebSocket for TOP 50 + REST for rest)
  const initialize = useCallback(async () => {
    // Check app version and clear data cache if version changed
    // This ensures users see fresh data after site updates
    checkVersionAndClearCache();

    // Try to load cached market cap first for instant display
    const cachedMarketCap = loadMarketCapCacheLocal();
    if (cachedMarketCap) {
      setMarketCapData(cachedMarketCap);
    }

    // Fetch OKX data first (fast, doesn't block)
    const [spotData, listings, fundingRates] = await Promise.all([
      fetchSpotSymbols(),
      fetchListingDates(),
      fetchFundingRates()
    ]);

    setSpotSymbols(spotData);
    setListingData(listings);
    setFundingRateData(fundingRates);

    // Fetch CoinGecko data separately (slower, shouldn't block OKX data)
    fetchMarketCapData().then((marketCap) => {
      console.log(`[MarketCap] Received ${marketCap.size} coins from CoinGecko`);
      setMarketCapData(marketCap);
      saveMarketCapCacheLocal(marketCap);
    }).catch((error) => {
      console.error('[MarketCap] Failed to fetch:', error);
    });

    // Initialize hybrid data manager
    const handleTickerUpdate = (newTickers: Map<string, ProcessedTicker>) => {
      setTickers(newTickers);
    };

    const handleStatusUpdate = (newStatus: 'connecting' | 'live' | 'error', time?: Date) => {
      setStatus(newStatus);
      if (time) setLastUpdate(time);
    };

    dataManagerRef.current = new OKXHybridDataManager(handleTickerUpdate, handleStatusUpdate);
    await dataManagerRef.current.start();

    // Fetch RSI for initial data after tickers are loaded
    const initialRsiTimeout = setTimeout(() => {
      const currentTickers = dataManagerRef.current?.getTickers();
      if (currentTickers && currentTickers.size > 0) {
        fetchRsiForVisible(currentTickers);
      }
    }, TIMING.INITIAL_RSI_FETCH_DELAY);
    timeoutsRef.current.push(initialRsiTimeout);

    // Setup tiered RSI refresh intervals
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

    // Fetch MA Flow data after RSI (delayed to avoid API contention)
    const initialMAFlowTimeout = setTimeout(() => {
      const currentTickers = dataManagerRef.current?.getTickers();
      if (currentTickers && currentTickers.size > 0) {
        maFlowHook.fetchMAFlowForVisible(currentTickers);
      }
    }, MA_FLOW.INITIAL_FETCH_DELAY);
    timeoutsRef.current.push(initialMAFlowTimeout);

    // Schedule MA Flow refresh (slower than RSI)
    const maFlowInterval = setInterval(() => {
      const currentTickers = dataManagerRef.current?.getTickers();
      if (currentTickers && currentTickers.size > 0) {
        maFlowHook.fetchMAFlowForVisible(currentTickers);
      }
    }, MA_FLOW.REFRESH_INTERVAL);
    intervalsRef.current.push(maFlowInterval);

    // Refresh market cap
    const marketCapInterval = setInterval(async () => {
      const newMarketCap = await fetchMarketCapData();
      setMarketCapData(newMarketCap);
      saveMarketCapCacheLocal(newMarketCap);
    }, TIMING.MARKET_CAP_REFRESH);
    intervalsRef.current.push(marketCapInterval);

    // Refresh funding rates
    const fundingRatesInterval = setInterval(async () => {
      const newFundingRates = await fetchFundingRates();
      setFundingRateData(newFundingRates);
    }, TIMING.FUNDING_RATES_REFRESH);
    intervalsRef.current.push(fundingRatesInterval);

  }, [fetchRsiForVisible, fetchRsiForTier, maFlowHook.fetchMAFlowForVisible, loadMarketCapCacheLocal, saveMarketCapCacheLocal]);

  // Cleanup - clear all intervals, timeouts, and stop data manager
  const cleanup = useCallback(() => {
    // Clear all intervals
    intervalsRef.current.forEach(clearInterval);
    intervalsRef.current = [];

    // Clear all timeouts
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];

    // Clear RSI cache save timeout
    if (saveRsiCacheTimeoutRef.current) {
      clearTimeout(saveRsiCacheTimeoutRef.current);
      saveRsiCacheTimeoutRef.current = null;
    }

    // Clear MA Flow cache save timeout
    maFlowHook.cleanup();

    // Stop data manager (WebSocket + REST polling)
    dataManagerRef.current?.stop();
    dataManagerRef.current = null;
  }, [maFlowHook]);

  // Get filtered and sorted data
  const getFilteredData = useCallback((): ProcessedTicker[] => {
    let filtered = Array.from(tickers.values());

    // Filter by USDT swap
    filtered = filtered.filter(t => t.instId.includes('-USDT-'));

    // Search filter - supports pipe-separated terms (e.g., "ETH|SOL|BTC")
    if (filtersHook.searchTerm) {
      const terms = filtersHook.searchTerm.toLowerCase().split('|').map(t => t.trim()).filter(t => t);
      if (terms.length === 1) {
        filtered = filtered.filter(t => t.instId.toLowerCase().includes(terms[0]));
      } else {
        filtered = filtered.filter(t => terms.some(term => t.baseSymbol.toLowerCase() === term));
      }
    }

    // Favorites view
    if (filtersHook.view === 'favorites') {
      filtered = filtered.filter(t => favoritesHook.favorites.includes(t.instId));
    }

    // Apply filters
    const { filters } = filtersHook;

    if (filters.rank) {
      const sortedByMarketCap = [...filtered].sort((a, b) => {
        const rankA = marketCapData.get(a.baseSymbol)?.rank ?? 9999;
        const rankB = marketCapData.get(b.baseSymbol)?.rank ?? 9999;
        return rankA - rankB;
      });

      const getTopN = (n: number) => new Set(sortedByMarketCap.slice(0, n).map(t => t.instId));
      const getRangeSet = (start: number, end: number) => new Set(sortedByMarketCap.slice(start - 1, end).map(t => t.instId));

      if (filters.rank === '1-25') {
        const top25Set = getTopN(25);
        filtered = filtered.filter(t => top25Set.has(t.instId));
      } else if (filters.rank === '1-20') {
        const top20Set = getTopN(20);
        filtered = filtered.filter(t => top20Set.has(t.instId));
      } else if (filters.rank === '21-50') {
        const rangeSet = getRangeSet(21, 50);
        filtered = filtered.filter(t => rangeSet.has(t.instId));
      } else if (filters.rank === '51-100') {
        const rangeSet = getRangeSet(51, 100);
        filtered = filtered.filter(t => rangeSet.has(t.instId));
      } else if (filters.rank === '101-500') {
        const rangeSet = getRangeSet(101, 500);
        filtered = filtered.filter(t => rangeSet.has(t.instId));
      } else if (filters.rank === '>500') {
        filtered = filtered.filter(t => !marketCapData.get(t.baseSymbol)?.rank);
      }
    }

    // RSI filter helper function
    const applyRsiFilter = (rsiValue: number | null | undefined, filterValue: string): boolean => {
      if (rsiValue === null || rsiValue === undefined) return false;
      if (filterValue.includes('~')) {
        const [minStr, maxStr] = filterValue.split('~');
        const min = minStr ? parseInt(minStr) : 0;
        const max = maxStr ? parseInt(maxStr) : 100;
        return rsiValue >= min && rsiValue <= max;
      } else if (filterValue.startsWith('<')) {
        const threshold = parseInt(filterValue.slice(1));
        return rsiValue < threshold;
      } else if (filterValue.startsWith('>')) {
        const threshold = parseInt(filterValue.slice(1));
        return rsiValue > threshold;
      }
      return true;
    };

    if (filters.rsi7) {
      const rsi7Filter = filters.rsi7;
      filtered = filtered.filter(t => applyRsiFilter(rsiData.get(t.instId)?.rsi7, rsi7Filter));
    }
    if (filters.rsi14) {
      const rsi14Filter = filters.rsi14;
      filtered = filtered.filter(t => applyRsiFilter(rsiData.get(t.instId)?.rsi14, rsi14Filter));
    }
    if (filters.rsiW7) {
      const rsiW7Filter = filters.rsiW7;
      filtered = filtered.filter(t => applyRsiFilter(rsiData.get(t.instId)?.rsiW7, rsiW7Filter));
    }
    if (filters.rsiW14) {
      const rsiW14Filter = filters.rsiW14;
      filtered = filtered.filter(t => applyRsiFilter(rsiData.get(t.instId)?.rsiW14, rsiW14Filter));
    }

    if (filters.hasSpot) {
      filtered = filtered.filter(t => {
        const baseQuote = `${t.baseSymbol}-USDT`;
        const hasSpot = spotSymbols.has(baseQuote);
        return filters.hasSpot === 'yes' ? hasSpot : !hasSpot;
      });
    }

    if (filters.fundingRate) {
      if (filters.fundingRate === 'positive') {
        filtered = filtered.filter(t => {
          const fr = fundingRateData.get(t.instId)?.fundingRate;
          return fr !== undefined && fr > 0;
        });
      } else if (filters.fundingRate === 'negative') {
        filtered = filtered.filter(t => {
          const fr = fundingRateData.get(t.instId)?.fundingRate;
          return fr !== undefined && fr < 0;
        });
      }
    }

    if (filters.marketCapMin) {
      filtered = filtered.filter(t => {
        const cap = marketCapData.get(t.baseSymbol)?.marketCap;
        if (cap === undefined) return false;

        const capInMillions = cap / 1000000;

        switch (filters.marketCapMin) {
          case '0-20':
            return capInMillions <= 20;
          case '20-100':
            return capInMillions > 20 && capInMillions <= 100;
          case '100-1000':
            return capInMillions > 100 && capInMillions <= 1000;
          case '1000+':
            return capInMillions > 1000;
          default:
            return true;
        }
      });
    }

    if (filters.listAge) {
      const now = Date.now();
      const oneDay = 24 * 60 * 60 * 1000;

      filtered = filtered.filter(t => {
        const listTime = listingData.get(t.instId)?.listTime;
        if (!listTime) return false;

        const age = now - listTime;

        switch (filters.listAge) {
          case '<30d':
            return age <= 30 * oneDay;
          case '<60d':
            return age <= 60 * oneDay;
          case '<90d':
            return age <= 90 * oneDay;
          case '<180d':
            return age <= 180 * oneDay;
          default:
            return true;
        }
      });
    }

    if (filters.isMeme) {
      filtered = filtered.filter(t => {
        const isMeme = isMemeToken(t.baseSymbol);
        return filters.isMeme === 'yes' ? isMeme : !isMeme;
      });
    }

    // D-RSI Avg Signal filter
    if (filters.dRsiSignal && filters.dRsiSignal.length > 0) {
      const dRsiSignalFilter = filters.dRsiSignal;
      filtered = filtered.filter(t => {
        const rsi = rsiData.get(t.instId);
        if (!rsi) return false;
        const signalInfo = getRsiSignal(rsi.rsi7, rsi.rsi14);
        return dRsiSignalFilter.includes(signalInfo.signal);
      });
    }

    // W-RSI Avg Signal filter
    if (filters.wRsiSignal && filters.wRsiSignal.length > 0) {
      const wRsiSignalFilter = filters.wRsiSignal;
      filtered = filtered.filter(t => {
        const rsi = rsiData.get(t.instId);
        if (!rsi) return false;
        const signalInfo = getRsiSignal(rsi.rsiW7, rsi.rsiW14);
        return wRsiSignalFilter.includes(signalInfo.signal);
      });
    }

    // Sort
    const { sort } = filtersHook;
    filtered.sort((a, b) => {
      let aVal: number | string;
      let bVal: number | string;

      switch (sort.column) {
        case 'symbol':
          aVal = a.instId;
          bVal = b.instId;
          break;
        case 'price':
          aVal = a.priceNum;
          bVal = b.priceNum;
          break;
        case 'change':
          aVal = a.changeNum;
          bVal = b.changeNum;
          break;
        case 'change4h':
          aVal = rsiData.get(a.instId)?.change4h ?? -9999;
          bVal = rsiData.get(b.instId)?.change4h ?? -9999;
          break;
        case 'change7d':
          aVal = rsiData.get(a.instId)?.change7d ?? -9999;
          bVal = rsiData.get(b.instId)?.change7d ?? -9999;
          break;
        case 'rank':
          aVal = marketCapData.get(a.baseSymbol)?.marketCap ?? 0;
          bVal = marketCapData.get(b.baseSymbol)?.marketCap ?? 0;
          if (sort.direction === 'asc') {
            return (bVal as number) - (aVal as number);
          } else {
            return (aVal as number) - (bVal as number);
          }
        case 'marketCap':
          aVal = marketCapData.get(a.baseSymbol)?.marketCap ?? 0;
          bVal = marketCapData.get(b.baseSymbol)?.marketCap ?? 0;
          break;
        case 'volume24h':
          aVal = (parseFloat(a.volCcy24h) || 0) * a.priceNum;
          bVal = (parseFloat(b.volCcy24h) || 0) * b.priceNum;
          break;
        case 'rsi7':
          aVal = rsiData.get(a.instId)?.rsi7 ?? 0;
          bVal = rsiData.get(b.instId)?.rsi7 ?? 0;
          break;
        case 'rsi14':
          aVal = rsiData.get(a.instId)?.rsi14 ?? 0;
          bVal = rsiData.get(b.instId)?.rsi14 ?? 0;
          break;
        case 'rsiW7':
          aVal = rsiData.get(a.instId)?.rsiW7 ?? 0;
          bVal = rsiData.get(b.instId)?.rsiW7 ?? 0;
          break;
        case 'rsiW14':
          aVal = rsiData.get(a.instId)?.rsiW14 ?? 0;
          bVal = rsiData.get(b.instId)?.rsiW14 ?? 0;
          break;
        case 'hasSpot':
          const aBase = `${a.baseSymbol}-USDT`;
          const bBase = `${b.baseSymbol}-USDT`;
          aVal = spotSymbols.has(aBase) ? 1 : 0;
          bVal = spotSymbols.has(bBase) ? 1 : 0;
          break;
        case 'fundingRate':
          aVal = fundingRateData.get(a.instId)?.fundingRate ?? 0;
          bVal = fundingRateData.get(b.instId)?.fundingRate ?? 0;
          break;
        case 'fundingApr':
          const frA = fundingRateData.get(a.instId);
          const frB = fundingRateData.get(b.instId);
          const aprA = frA ? frA.fundingRate * ((365 * 24) / (frA.settlementInterval || 8)) : 0;
          const aprB = frB ? frB.fundingRate * ((365 * 24) / (frB.settlementInterval || 8)) : 0;
          aVal = aprA;
          bVal = aprB;
          break;
        case 'fundingInterval':
          aVal = fundingRateData.get(a.instId)?.settlementInterval ?? 8;
          bVal = fundingRateData.get(b.instId)?.settlementInterval ?? 8;
          break;
        case 'listDate':
          aVal = listingData.get(a.instId)?.listTime ?? 0;
          bVal = listingData.get(b.instId)?.listTime ?? 0;
          break;
        default:
          aVal = marketCapData.get(a.baseSymbol)?.rank ?? 9999;
          bVal = marketCapData.get(b.baseSymbol)?.rank ?? 9999;
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sort.direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sort.direction === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });

    return filtered;
  }, [tickers, filtersHook, favoritesHook.favorites, marketCapData, rsiData, spotSymbols, fundingRateData, listingData]);

  // Delegate to store-utils (single source of truth)
  const getRsiAverages = useCallback(() => {
    return calculateRsiAverages(tickers, marketCapData, rsiData);
  }, [tickers, marketCapData, rsiData]);

  const getTopMovers = useCallback((timeframe: '4h' | '24h' | '7d', limit: number = 5) => {
    return calculateTopMovers(tickers, rsiData, timeframe, limit);
  }, [tickers, rsiData]);

  // Get paginated data
  const getPaginatedData = useCallback(() => {
    const filtered = getFilteredData();
    const { currentPage, pageSize } = paginationHook;
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;

    return {
      data: filtered.slice(startIndex, endIndex),
      totalPages: Math.ceil(filtered.length / pageSize),
      totalItems: filtered.length
    };
  }, [getFilteredData, paginationHook]);

  const getQuickFilterCounts = useCallback(() => {
    return calculateQuickFilterCounts(tickers, rsiData);
  }, [tickers, rsiData]);

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

    // UI state from composed hooks
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
    updateSort: filtersHook.updateSort,
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
    getQuickFilterCounts
  };
}
