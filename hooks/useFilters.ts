'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { Filters, SortConfig } from '@/lib/types';
import { getCacheForExchange } from '@/lib/cache';

/**
 * Hook for managing filters, sorting, search, and view mode
 */
export function useFilters(exchange: 'okx' | 'hyperliquid' = 'okx', onFilterChange?: () => void) {
  const cache = useMemo(() => getCacheForExchange(exchange), [exchange]);
  const [filters, setFiltersState] = useState<Filters>({});
  const [sort, setSort] = useState<SortConfig>({ column: 'rank', direction: 'asc' });
  const [view, setViewState] = useState<'market' | 'favorites'>('market');
  const [searchTerm, setSearchTermInternal] = useState('');

  // Load filters from cache on mount
  useEffect(() => {
    const savedFilters = cache.filters.get() as Filters | null;
    if (savedFilters) {
      setFiltersState(savedFilters);
    }
  }, [cache]);

  // Update filters with cache persistence
  const setFilters = useCallback((newFilters: Filters | ((prev: Filters) => Filters)) => {
    setFiltersState(prev => {
      const resolved = typeof newFilters === 'function' ? newFilters(prev) : newFilters;
      cache.filters.set(resolved);
      return resolved;
    });
    onFilterChange?.();
  }, [cache, onFilterChange]);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setFiltersState({});
    cache.filters.set({});
    onFilterChange?.();
  }, [cache, onFilterChange]);

  // Check if any filters are active
  const hasActiveFilters = useCallback(() => {
    return Object.values(filters).some(v => v !== undefined && v !== '');
  }, [filters]);

  // Update sort configuration
  const updateSort = useCallback((column: string) => {
    setSort(prev => ({
      column,
      direction: prev.column === column
        ? (prev.direction === 'asc' ? 'desc' : 'asc')
        : (column === 'rank' ? 'asc' : 'desc')
    }));
  }, []);

  // Set sort directly
  const setSortDirectly = useCallback((config: SortConfig) => {
    setSort(config);
  }, []);

  // Set view mode
  const setView = useCallback((newView: 'market' | 'favorites') => {
    setViewState(newView);
  }, []);

  // Set search term (triggers filter change callback)
  const setSearchTerm = useCallback((term: string) => {
    setSearchTermInternal(term);
    onFilterChange?.();
  }, [onFilterChange]);

  return {
    filters,
    sort,
    view,
    searchTerm,
    setFilters,
    clearFilters,
    hasActiveFilters,
    updateSort,
    setSortDirectly,
    setView,
    setSearchTerm,
  };
}
