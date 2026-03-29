'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { ColumnVisibility, ColumnKey } from '@/lib/types';
import { isMobile } from '@/lib/utils';
import { DEFAULT_COLUMN_ORDER, getDefaultColumns } from '@/lib/defaults';
import { FIXED_COLUMNS } from '@/lib/constants';
import { getCacheForExchange } from '@/lib/cache';

// Get default columns based on device
const DEFAULT_COLUMNS: ColumnVisibility = getDefaultColumns(isMobile());

/**
 * Hook for managing column visibility and order
 */
export function useColumns(exchange: 'okx' | 'hyperliquid' = 'okx') {
  const cache = useMemo(() => getCacheForExchange(exchange), [exchange]);
  const [columns, setColumns] = useState<ColumnVisibility>(DEFAULT_COLUMNS);
  const [columnOrder, setColumnOrder] = useState<ColumnKey[]>(DEFAULT_COLUMN_ORDER);

  // Load saved column settings from cache on mount
  useEffect(() => {
    // Load saved column order
    const savedColumnOrder = cache.columnOrder.get();
    if (savedColumnOrder && savedColumnOrder.length > 0) {
      const savedSet = new Set(savedColumnOrder);
      const defaultSet = new Set(DEFAULT_COLUMN_ORDER);

      // Start with saved order, but only include columns that still exist
      const mergedOrder = savedColumnOrder.filter((col) => defaultSet.has(col as ColumnKey));

      // Add any new columns that weren't in saved order
      const fixedCols = FIXED_COLUMNS as readonly ColumnKey[];
      const newColumns = DEFAULT_COLUMN_ORDER.filter(col =>
        !savedSet.has(col) && !fixedCols.includes(col)
      );

      const nonFixedPart = mergedOrder.filter((col) => !fixedCols.includes(col as ColumnKey));
      const finalOrder: ColumnKey[] = [...fixedCols, ...nonFixedPart as ColumnKey[], ...newColumns];

      setColumnOrder(finalOrder);
      cache.columnOrder.set(finalOrder);
    }

    // Load saved columns visibility
    const savedColumns = cache.columns.get();
    if (savedColumns) {
      setColumns(savedColumns);
    } else {
      const defaultCols = getDefaultColumns(isMobile());
      setColumns(defaultCols);
    }
  }, [cache]);

  // Update single column visibility
  const updateColumn = useCallback((col: keyof ColumnVisibility, visible: boolean) => {
    setColumns(prev => {
      const updated = { ...prev, [col]: visible };
      cache.columns.set(updated);
      return updated;
    });

    // If enabling logo and it's not in columnOrder, add it in the correct position
    if (col === 'logo' && visible) {
      setColumnOrder(prev => {
        if (!prev.includes('logo')) {
          const rankIndex = prev.indexOf('rank');
          const newOrder = [...prev];
          newOrder.splice(rankIndex + 1, 0, 'logo');
          cache.columnOrder.set(newOrder);
          return newOrder;
        }
        return prev;
      });
    }
  }, [cache]);

  // Update column order (for drag and drop)
  const updateColumnOrder = useCallback((newOrder: ColumnKey[]) => {
    const fixedCols = FIXED_COLUMNS as readonly ColumnKey[];
    const nonFixedOrder = newOrder.filter(col => !fixedCols.includes(col));
    const finalOrder: ColumnKey[] = [...fixedCols, ...nonFixedOrder];

    setColumnOrder(finalOrder);
    cache.columnOrder.set(finalOrder);
  }, [cache]);

  // Move a column to a new position
  const moveColumn = useCallback((dragKey: ColumnKey, hoverKey: ColumnKey) => {
    const fixedCols = FIXED_COLUMNS as readonly ColumnKey[];
    if (fixedCols.includes(dragKey) || fixedCols.includes(hoverKey)) {
      return;
    }

    setColumnOrder(prev => {
      const dragIndex = prev.indexOf(dragKey);
      const hoverIndex = prev.indexOf(hoverKey);

      if (dragIndex === -1 || hoverIndex === -1) return prev;

      const newOrder = [...prev];
      newOrder.splice(dragIndex, 1);
      newOrder.splice(hoverIndex, 0, dragKey);

      cache.columnOrder.set(newOrder);
      return newOrder;
    });
  }, [cache]);

  // Set columns to preset configuration
  const setColumnsPreset = useCallback((preset: 'all' | 'none' | 'default') => {
    let newColumns: ColumnVisibility;

    if (preset === 'all') {
      newColumns = {
        favorite: true, rank: true, logo: true, symbol: true, price: true,
        fundingRate: true, fundingApr: true, fundingInterval: true,
        change4h: true, change: true, change7d: true,
        volume24h: true, marketCap: true,
        dRsiSignal: true, wRsiSignal: true,
        rsi7: true, rsi14: true, rsiW7: true, rsiW14: true,
        adx: true,
        listDate: true, hasSpot: false
      };
    } else if (preset === 'none') {
      newColumns = {
        favorite: true, rank: true, logo: false, symbol: true, price: false,
        fundingRate: false, fundingApr: false, fundingInterval: false,
        change4h: false, change: false, change7d: false,
        volume24h: false, marketCap: false,
        dRsiSignal: false, wRsiSignal: false,
        rsi7: false, rsi14: false, rsiW7: false, rsiW14: false,
        adx: false,
        listDate: false, hasSpot: false
      };
    } else {
      newColumns = DEFAULT_COLUMNS;
    }

    setColumns(newColumns);
    cache.columns.set(newColumns);
  }, [cache]);

  // Direct setter for URL state sync
  const setColumnsDirectly = useCallback((newColumns: ColumnVisibility) => {
    setColumns(newColumns);
    cache.columns.set(newColumns);
  }, [cache]);

  const setColumnOrderDirectly = useCallback((newOrder: ColumnKey[]) => {
    setColumnOrder(newOrder);
    cache.columnOrder.set(newOrder);
  }, [cache]);

  return {
    columns,
    columnOrder,
    updateColumn,
    updateColumnOrder,
    moveColumn,
    setColumnsPreset,
    setColumnsDirectly,
    setColumnOrderDirectly,
  };
}
