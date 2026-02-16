'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { ProcessedTicker, MAFlowData } from '@/lib/types';
import { fetchMAFlowBatch } from '@/lib/api';
import { MA_FLOW, TIMING } from '@/lib/constants';
import { getMAFlowCache, setMAFlowCache } from '@/lib/cache';

/**
 * Hook to manage MA Flow data fetching, caching, and state
 * Extracted from useMarketStore to reduce complexity
 */
export function useMAFlowData(getSortedInstIds: (tickerMap: Map<string, ProcessedTicker>) => string[]) {
  const [maFlowData, setMAFlowData] = useState<Map<string, MAFlowData>>(new Map());
  const isFetchingMAFlowRef = useRef(false);

  // Save MA Flow data to cache (debounced)
  const saveMAFlowCacheTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const saveMAFlowCacheDebounced = useCallback((maMap: Map<string, MAFlowData>) => {
    if (saveMAFlowCacheTimeoutRef.current) {
      clearTimeout(saveMAFlowCacheTimeoutRef.current);
    }
    saveMAFlowCacheTimeoutRef.current = setTimeout(() => {
      setMAFlowCache(maMap);
    }, TIMING.RSI_CACHE_SAVE_DEBOUNCE);
  }, []);

  // Load MA Flow cache on mount
  useEffect(() => {
    const cachedMAFlow = getMAFlowCache();
    if (cachedMAFlow && cachedMAFlow.size > 0) {
      setMAFlowData(cachedMAFlow);
    }
  }, []);

  // Update MA Flow data for single instrument
  const updateMAFlowData = useCallback((instId: string, data: MAFlowData) => {
    setMAFlowData(prev => {
      const newMap = new Map(prev);
      newMap.set(instId, data);
      saveMAFlowCacheDebounced(newMap);
      return newMap;
    });
  }, [saveMAFlowCacheDebounced]);

  // Fetch MA Flow data for visible instruments (Top 50 only)
  const fetchMAFlowForVisible = useCallback(async (tickerMap: Map<string, ProcessedTicker>) => {
    if (isFetchingMAFlowRef.current) return;
    isFetchingMAFlowRef.current = true;

    try {
      const instIds = getSortedInstIds(tickerMap);
      // Build a price map from live ticker data for accurate convergence calculation
      const tickerPrices = new Map<string, number>();
      tickerMap.forEach((ticker, instId) => {
        if (ticker.priceNum > 0) {
          tickerPrices.set(instId, ticker.priceNum);
        }
      });
      await fetchMAFlowBatch(
        instIds,
        maFlowData,
        () => {}, // silent progress for MA Flow
        updateMAFlowData,
        tickerPrices
      );
    } finally {
      isFetchingMAFlowRef.current = false;
    }
  }, [getSortedInstIds, maFlowData, updateMAFlowData]);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (saveMAFlowCacheTimeoutRef.current) {
      clearTimeout(saveMAFlowCacheTimeoutRef.current);
      saveMAFlowCacheTimeoutRef.current = null;
    }
  }, []);

  return {
    maFlowData,
    fetchMAFlowForVisible,
    cleanup,
  };
}
