'use client';

import { useEffect, useCallback, useRef } from 'react';
import { Filters, ColumnVisibility, ColumnKey, RsiSignalType } from '@/lib/types';
import { DEFAULT_COLUMN_ORDER } from '@/lib/utils';
import { FIXED_COLUMNS } from '@/lib/constants';

// All columns visible - used as base for URL parsing
const ALL_COLUMNS_VISIBLE: ColumnVisibility = {
  favorite: true,
  rank: true,
  logo: true,
  symbol: true,
  price: true,
  fundingRate: true,
  fundingApr: true,
  fundingInterval: true,
  change4h: true,
  change: true,
  change7d: true,
  volume24h: true,
  marketCap: true,
  dRsiSignal: true,
  wRsiSignal: true,
  tdSeq: true,
  rsi7: true,
  rsi14: true,
  rsiW7: true,
  rsiW14: true,
  listDate: true
};

// Convert readonly array to regular array for includes check
const FIXED_COLS = [...FIXED_COLUMNS] as string[];

interface UrlState {
  favorites: string[];
  filters: Filters;
  columns: ColumnVisibility;
  columnOrder: ColumnKey[];
  view: 'market' | 'favorites';
}

// Serialize state to URL params
function stateToParams(state: Partial<UrlState>): URLSearchParams {
  const params = new URLSearchParams();

  // Favorites - comma-separated list
  if (state.favorites && state.favorites.length > 0) {
    params.set('fav', state.favorites.join(','));
  }

  // View
  if (state.view && state.view !== 'market') {
    params.set('view', state.view);
  }

  // Filters - only include non-empty values
  if (state.filters) {
    // String-type filters
    const stringFilterKeys = ['rank', 'rsi7', 'rsi14', 'rsiW7', 'rsiW14', 'fundingRate', 'marketCapMin', 'listAge'] as const;
    stringFilterKeys.forEach(key => {
      const value = state.filters?.[key];
      if (value) {
        params.set(`f_${key}`, value);
      }
    });
    // Array-type filters (RSI signals)
    if (state.filters.dRsiSignal && state.filters.dRsiSignal.length > 0) {
      params.set('f_dRsiSignal', state.filters.dRsiSignal.join(','));
    }
    if (state.filters.wRsiSignal && state.filters.wRsiSignal.length > 0) {
      params.set('f_wRsiSignal', state.filters.wRsiSignal.join(','));
    }
  }

  // Columns - only include hidden columns (default is all visible)
  if (state.columns) {
    const hiddenCols = Object.entries(state.columns)
      .filter(([key, visible]) => !visible && !FIXED_COLS.includes(key))
      .map(([key]) => key);
    if (hiddenCols.length > 0) {
      params.set('hide', hiddenCols.join(','));
    }
  }

  // Column order - only if different from default
  if (state.columnOrder) {
    const defaultOrder = DEFAULT_COLUMN_ORDER.join(',');
    const currentOrder = state.columnOrder.join(',');
    if (currentOrder !== defaultOrder) {
      // Only store non-fixed columns order
      const nonFixed = state.columnOrder.filter(col => !FIXED_COLS.includes(col));
      params.set('cols', nonFixed.join(','));
    }
  }

  return params;
}

// Parse URL params to state
function paramsToState(params: URLSearchParams): Partial<UrlState> {
  const state: Partial<UrlState> = {};

  // Favorites
  const fav = params.get('fav');
  if (fav) {
    state.favorites = fav.split(',').filter(Boolean);
  }

  // View
  const view = params.get('view');
  if (view === 'favorites') {
    state.view = 'favorites';
  }

  // Filters
  const filters: Filters = {};
  // String-type filters
  const stringFilterKeys = ['rank', 'rsi7', 'rsi14', 'rsiW7', 'rsiW14', 'fundingRate', 'marketCapMin', 'listAge'] as const;
  stringFilterKeys.forEach(key => {
    const value = params.get(`f_${key}`);
    if (value) {
      (filters as Record<string, string>)[key] = value;
    }
  });
  // Array-type filters (RSI signals)
  const dRsiSignal = params.get('f_dRsiSignal');
  if (dRsiSignal) {
    filters.dRsiSignal = dRsiSignal.split(',').filter(Boolean) as RsiSignalType[];
  }
  const wRsiSignal = params.get('f_wRsiSignal');
  if (wRsiSignal) {
    filters.wRsiSignal = wRsiSignal.split(',').filter(Boolean) as RsiSignalType[];
  }
  if (Object.keys(filters).length > 0) {
    state.filters = filters;
  }

  // Hidden columns
  const hide = params.get('hide');
  if (hide) {
    const hiddenCols = new Set(hide.split(',').filter(Boolean));
    const columns = { ...ALL_COLUMNS_VISIBLE };
    hiddenCols.forEach(col => {
      if (col in columns) {
        columns[col as keyof ColumnVisibility] = false;
      }
    });
    state.columns = columns;
  }

  // Column order
  const cols = params.get('cols');
  if (cols) {
    const nonFixedOrder = cols.split(',').filter(Boolean) as ColumnKey[];
    state.columnOrder = [...FIXED_COLUMNS as unknown as ColumnKey[], ...nonFixedOrder];
  }

  return state;
}

/**
 * useUrlState — synchronises store state ↔ URL query params.
 *
 * `enabled` (default true) controls whether the hook does anything.
 * When disabled the hook still runs (satisfying the Rules of Hooks)
 * but all side-effects are skipped.
 */
export function useUrlState(
  currentState: {
    favorites: string[];
    filters: Filters;
    columns: ColumnVisibility;
    columnOrder: ColumnKey[];
    view: 'market' | 'favorites';
  },
  setters: {
    setFavorites: (favorites: string[]) => void;
    setFilters: (filters: Filters) => void;
    setColumns: (columns: ColumnVisibility) => void;
    setColumnOrder: (order: ColumnKey[]) => void;
    setView: (view: 'market' | 'favorites') => void;
  },
  enabled: boolean = true
) {
  const initializedRef = useRef(false);
  const isUpdatingFromUrlRef = useRef(false);

  // Initialize state from URL on mount
  useEffect(() => {
    if (!enabled) return;
    if (initializedRef.current) return;
    initializedRef.current = true;

    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const urlState = paramsToState(params);

    isUpdatingFromUrlRef.current = true;

    if (urlState.favorites) {
      setters.setFavorites(urlState.favorites);
    }
    if (urlState.filters) {
      setters.setFilters(urlState.filters);
    }
    if (urlState.columns) {
      setters.setColumns(urlState.columns);
    }
    if (urlState.columnOrder) {
      setters.setColumnOrder(urlState.columnOrder);
    }
    if (urlState.view) {
      setters.setView(urlState.view);
    }

    // Allow state updates after a small delay
    setTimeout(() => {
      isUpdatingFromUrlRef.current = false;
    }, 100);
  }, [setters, enabled]);

  // Update URL when state changes
  const updateUrl = useCallback(() => {
    if (!enabled) return;
    if (typeof window === 'undefined') return;
    if (isUpdatingFromUrlRef.current) return;

    const params = stateToParams(currentState);
    const queryString = params.toString();
    const newUrl = queryString
      ? `${window.location.pathname}?${queryString}`
      : window.location.pathname;

    // Use replaceState to avoid polluting browser history
    window.history.replaceState(null, '', newUrl);
  }, [currentState, enabled]);

  // Debounced URL update
  useEffect(() => {
    if (!enabled) return;
    if (!initializedRef.current) return;

    const timeoutId = setTimeout(updateUrl, 300);
    return () => clearTimeout(timeoutId);
  }, [updateUrl, enabled]);

  // Generate shareable URL
  const getShareableUrl = useCallback(() => {
    if (!enabled) return '';
    if (typeof window === 'undefined') return '';

    const params = stateToParams(currentState);
    const queryString = params.toString();
    return queryString
      ? `${window.location.origin}${window.location.pathname}?${queryString}`
      : `${window.location.origin}${window.location.pathname}`;
  }, [currentState, enabled]);

  return { getShareableUrl };
}
