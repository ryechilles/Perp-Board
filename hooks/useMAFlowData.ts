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

  // Use ref to always access the latest getSortedInstIds
  // This avoids stale closure issues when called from setTimeout/setInterval in the store
  const getSortedInstIdsRef = useRef(getSortedInstIds);
  getSortedInstIdsRef.current = getSortedInstIds;

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

  // Fetch MA Flow data for top instruments by market cap
  // Uses ref for getSortedInstIds to always get the latest version (avoids stale closure)
  // Returns true if fetch was actually performed, false if skipped (no data / already fetching)
  const fetchMAFlowForVisible = useCallback(async (tickerMap: Map<string, ProcessedTicker>): Promise<boolean> => {
    if (isFetchingMAFlowRef.current) return false;

    const instIds = getSortedInstIdsRef.current(tickerMap);
    // Skip if no instruments available yet (e.g. marketCapData not loaded)
    if (instIds.length === 0) return false;

    isFetchingMAFlowRef.current = true;

    try {
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
      return true;
    } finally {
      isFetchingMAFlowRef.current = false;
    }
  }, [maFlowData, updateMAFlowData]);

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
