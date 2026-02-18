/**
 * Generic RSI batch fetcher with tiered priority
 * Shared between OKX and Hyperliquid - only the single-instrument fetch differs
 *
 * This module extracts the common batch fetching logic that's identical
 * between okx-rsi.ts and hyperliquid-rsi.ts, allowing both to reuse
 * the same tiered priority system without code duplication.
 */

import { RSIData } from '../types';
import { TIMING } from '../constants';

/**
 * Generic RSI batch fetcher with tiered priority
 *
 * Processes instruments in 3 tiers based on market cap ranking:
 * - Top 50: fastest refresh (150ms delay)
 * - 51-100 (tier2): medium speed (300ms delay)
 * - 101+ (tier3): slower (500ms delay)
 *
 * @param instruments - Array of instrument IDs to fetch (order matters: index determines tier)
 * @param existingData - Map of existing RSI data keyed by instrument ID
 * @param fetchSingle - Function to fetch RSI for a single instrument
 * @param onProgress - Callback for progress updates (e.g., "Loading Top 50: 5/10")
 * @param onUpdate - Callback when new data is fetched (called with instId and RSIData)
 * @param tier - Optional: fetch specific tier only ('top50', 'tier2', 'tier3', or 'all'/undefined)
 */
export async function fetchRSIBatchGeneric(
  instruments: string[],
  existingData: Map<string, RSIData>,
  fetchSingle: (id: string) => Promise<RSIData | null>,
  onProgress: (text: string) => void,
  onUpdate: (id: string, data: RSIData) => void,
  tier?: 'top50' | 'tier2' | 'tier3' | 'all'
): Promise<void> {
  const now = Date.now();

  // Different stale thresholds for different tiers
  const getStaleThreshold = (index: number): number => {
    if (index < 50) return TIMING.RSI_STALE_TOP50;
    if (index < 100) return TIMING.RSI_STALE_TIER2;
    return TIMING.RSI_STALE_TIER3;
  };

  // Filter based on tier-specific stale thresholds
  const toFetch = instruments.filter((id, index) => {
    const existing = existingData.get(id);
    if (!existing) return true;
    return now - existing.lastUpdated > getStaleThreshold(index);
  });

  if (toFetch.length === 0) {
    onProgress('');
    return;
  }

  // Split into 3 tiers: Top 50 (fastest), 51-100 (medium), 101+ (slower)
  const top50 = tier === 'all' || tier === 'top50' || !tier ? toFetch.slice(0, 50) : [];
  const tier2List = tier === 'all' || tier === 'tier2' || !tier ? toFetch.slice(50, 100) : [];
  const tier3List = tier === 'all' || tier === 'tier3' || !tier ? toFetch.slice(100) : [];

  // Tier 1: Top 50 - fastest loading
  for (let i = 0; i < top50.length; i++) {
    const id = top50[i];
    onProgress(`Loading Top 50: ${i + 1}/${top50.length}`);

    const rsiData = await fetchSingle(id);
    if (rsiData) {
      onUpdate(id, rsiData);
    }

    if (i < top50.length - 1) {
      await new Promise(r => setTimeout(r, TIMING.RSI_DELAY_TOP50));
    }
  }

  // Tier 2: 51-100 - medium speed
  for (let i = 0; i < tier2List.length; i++) {
    const id = tier2List[i];
    onProgress(`Loading 51-100: ${i + 1}/${tier2List.length}`);

    const rsiData = await fetchSingle(id);
    if (rsiData) {
      onUpdate(id, rsiData);
    }

    if (i < tier2List.length - 1) {
      await new Promise(r => setTimeout(r, TIMING.RSI_DELAY_TIER2));
    }
  }

  // Tier 3: 101+ - slower
  for (let i = 0; i < tier3List.length; i++) {
    const id = tier3List[i];
    onProgress(`Loading others: ${i + 1}/${tier3List.length}`);

    const rsiData = await fetchSingle(id);
    if (rsiData) {
      onUpdate(id, rsiData);
    }

    if (i < tier3List.length - 1) {
      await new Promise(r => setTimeout(r, TIMING.RSI_DELAY_TIER3));
    }
  }

  onProgress('');
}
