'use client';

import { useCallback, useRef, useMemo, useState, useSyncExternalStore } from 'react';
import { ProcessedTicker, ExchangeAdapter } from '@/lib/types';
import { filterAndSort, FilterContext } from '@/lib/filters';
import { calculateRsiAverages, calculateTopMovers, calculateQuickFilterCounts } from '@/lib/store-utils';
import { getCacheForExchange } from '@/lib/cache';
import { MarketStore } from '@/lib/store/marketStore';
import { ExchangeController } from '@/lib/controller/ExchangeController';

// Import composed hooks
import { useColumns } from './useColumns';
import { useFavorites } from './useFavorites';
import { useFilters } from './useFilters';
import { usePagination } from './usePagination';
import { useMAFlowData } from './useMAFlowData';

/**
 * Unified exchange store hook
 * Parameterized by an ExchangeAdapter to handle OKX/Hyperliquid differences.
 *
 * Responsibilities are split:
 *  - data ACQUISITION + scheduling lives in a plain `ExchangeController`
 *    (timers, WS/REST manager, RSI loop) that writes into the `MarketStore`.
 *  - this hook SUBSCRIBES to the store for the derived view (filterAndSort /
 *    averages / counts) and exposes UI state + actions. Individual table rows
 *    subscribe to their own instrument slice via the selector hooks.
 */
export function useExchangeStore(adapter: ExchangeAdapter) {
  const exchange = adapter.exchange;

  // Core data lives in an external store (outside React) so individual table
  // rows can subscribe to their own instrument slice instead of the whole table.
  const marketStoreRef = useRef<MarketStore | null>(null);
  if (marketStoreRef.current === null) {
    marketStoreRef.current = new MarketStore();
  }
  const marketStore = marketStoreRef.current;
  const snapshot = useSyncExternalStore(
    marketStore.subscribe,
    marketStore.getSnapshot,
    marketStore.getSnapshot
  );
  const { tickers, rsiData, fundingRateData, listingData, marketCapData, spotSymbols } = snapshot;

  // Composed hooks (exchange-aware)
  const columnsHook = useColumns(exchange);
  const favoritesHook = useFavorites(exchange);
  const paginationHook = usePagination();
  const filtersHook = useFilters(exchange, paginationHook.resetPage);

  // Status (written by the controller via injected callbacks)
  const [status, setStatus] = useState<'connecting' | 'live' | 'error'>('live');
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [rsiProgress, setRsiProgress] = useState('');
  const [urlInitialized, setUrlInitialized] = useState(false);

  // Exchange-specific cache bundle (RSI cache used by the controller).
  const cache = useMemo(() => getCacheForExchange(exchange), [exchange]);

  // MA Flow (OKX only) — data lives in its own hook; the controller triggers
  // fetch/prune/cleanup via the stable refs below.
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
  const cleanupMAFlowRef = useRef(maFlowHook.cleanup);
  cleanupMAFlowRef.current = maFlowHook.cleanup;

  // Controller — created once. Owns dataManager + scheduling + RSI loop/cache,
  // writes into marketStore. Callbacks bridge back to React state / MA-Flow hook.
  const controllerRef = useRef<ExchangeController | null>(null);
  if (controllerRef.current === null) {
    controllerRef.current = new ExchangeController(adapter, marketStore, cache, {
      onStatus: (newStatus, time) => {
        setStatus(newStatus);
        if (time) setLastUpdate(time);
      },
      onRsiProgress: setRsiProgress,
      fetchMAFlow: (tickerMap) => fetchMAFlowRef.current(tickerMap),
      pruneMAFlow: (validKeys) => pruneMAFlowRef.current(validKeys),
      cleanupMAFlow: () => cleanupMAFlowRef.current(),
    });
  }
  const controller = controllerRef.current;

  const initialize = useCallback(() => controller.initialize(), [controller]);
  const cleanup = useCallback(() => controller.dispose(), [controller]);

  // Exchange-specific pre-filter (stable reference via adapter)
  const preFilter = adapter.preFilterTickers;

  // P3 decouple: does the current sort/filter actually depend on RSI data?
  // If not (e.g. the default rank sort with no RSI filter), an RSI update does
  // NOT change the row list — each row pulls its own RSI via a selector — so we
  // skip re-running filterAndSort over every ticker on each RSI flush.
  const rsiAffectsList = useMemo(() => {
    const f = filtersHook.filters;
    const rsiFilterActive = !!(
      f.rsi7 || f.rsi14 || f.rsiW7 || f.rsiW14 ||
      (f.dRsiSignal && f.dRsiSignal.length) ||
      (f.wRsiSignal && f.wRsiSignal.length)
    );
    const rsiSortActive = ['change4h', 'change7d', 'rsi7', 'rsi14', 'rsiW7', 'rsiW14']
      .includes(filtersHook.sort.column);
    return rsiFilterActive || rsiSortActive;
  }, [filtersHook.filters, filtersHook.sort.column]);

  // Always read the freshest rsiData inside the memo, but only treat it as a
  // dependency when it actually affects the list (see rsiAffectsList).
  const rsiDataRef = useRef(rsiData);
  rsiDataRef.current = rsiData;

  // Filtered + sorted data (memoized)
  const filteredData = useMemo(() => {
    const ctx: FilterContext = {
      rsiData: rsiDataRef.current,
      marketCapData,
      fundingRateData,
      spotSymbols,
      listingData: adapter.features.listingDates ? listingData : undefined,
      spotSymbolFormat: adapter.spotSymbolFormat,
      defaultSettlementInterval: adapter.defaultSettlementInterval,
    };
    return filterAndSort(
      tickers,
      filtersHook.searchTerm,
      filtersHook.view,
      favoritesHook.favorites,
      filtersHook.filters,
      filtersHook.sort,
      ctx,
      preFilter
    );
    // rsiData is intentionally a dependency only when it affects the list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    tickers,
    filtersHook.searchTerm,
    filtersHook.view,
    favoritesHook.favorites,
    filtersHook.filters,
    filtersHook.sort,
    marketCapData,
    fundingRateData,
    spotSymbols,
    listingData,
    adapter,
    preFilter,
    rsiAffectsList ? rsiData : null,
  ]);

  const getFilteredData = useCallback(() => filteredData, [filteredData]);

  // RSI averages (memoized)
  const rsiAverages = useMemo(() => {
    return calculateRsiAverages(tickers, marketCapData, rsiData);
  }, [tickers, marketCapData, rsiData]);

  const getRsiAverages = useCallback(() => rsiAverages, [rsiAverages]);

  // Quick filter counts (memoized, filtered by current asset category)
  const quickFilterCounts = useMemo(() => {
    return calculateQuickFilterCounts(tickers, rsiData, filtersHook.filters.assetCategory);
  }, [tickers, rsiData, filtersHook.filters.assetCategory]);

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
    // External store instance — table rows subscribe to per-instrument slices
    marketStore,

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
