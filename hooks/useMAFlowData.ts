'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { ProcessedTicker, MAFlowData } from '@/lib/types';
import { fetchMAFlowBatch } from '@/lib/api';
import { TIMING } from '@/lib/constants';
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
    }, TIMING.MA_FLOW_CACHE_SAVE_DEBOUNCE);
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

  // Use ref to always access the latest maFlowData (avoids stale closure during long batch fetches)
  const maFlowDataRef = useRef(maFlowData);
  maFlowDataRef.current = maFlowData;

  // Fetch MA Flow data for top instruments by market cap
  // Uses refs for getSortedInstIds and maFlowData to always get the latest version (avoids stale closure)
  // Returns true if fetch was actually performed, false if skipped (no data / already fetching)
  const fetchMAFlowForVisible = useCallback(async (tickerMap: Map<string, ProcessedTicker>): Promise<boolean> => {
    if (isFetchingMAFlowRef.current) return false;

    const instIds = getSortedInstIdsRef.current(tickerMap);
    // Skip if no instruments available yet (e.g. marketCapData not loaded)
    if (instIds.length === 0) return false;

    isFetchingMAFlowRef.current = true;

    try {
      await fetchMAFlowBatch(
        instIds,
        maFlowDataRef.current,
        () => {}, // silent progress for MA Flow
        updateMAFlowData,
      );
      return true;
    } finally {
      isFetchingMAFlowRef.current = false;
    }
  }, [updateMAFlowData]);

  // Remove orphaned entries for delisted instruments
  const pruneEntries = useCallback((validKeys: Set<string>) => {
    setMAFlowData(prev => {
      let hasOrphans = false;
      for (const key of prev.keys()) {
        if (!validKeys.has(key)) { hasOrphans = true; break; }
      }
      if (!hasOrphans) return prev; // No change, no re-render
      const pruned = new Map<string, MAFlowData>();
      for (const [key, value] of prev) {
        if (validKeys.has(key)) pruned.set(key, value);
      }
      saveMAFlowCacheDebounced(pruned);
      return pruned;
    });
  }, [saveMAFlowCacheDebounced]);

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
    pruneEntries,
    cleanup,
  };
}
