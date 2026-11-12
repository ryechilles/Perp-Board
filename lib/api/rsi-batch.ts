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

/** Abortable delay — resolves immediately when the signal fires */
function abortableDelay(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    }, { once: true });
  });
}

/** Batch size for grouped store updates when instruments arrive concurrently */
const BATCH_SIZE = 10;
/** Paced (one-at-a-time) fetches take ~1s per instrument — waiting for 10
 *  would leave the top rows blank for ~10s, so flush in small groups. */
const BATCH_SIZE_PACED = 3;

/**
 * Generic RSI batch fetcher with tiered priority
 *
 * Processes instruments in 3 tiers based on market cap ranking:
 * - Top 50: fastest refresh (150ms delay)
 * - 51-100 (tier2): medium speed (300ms delay)
 * - 101+ (tier3): slower (500ms delay)
 *
 * Supports AbortSignal for cancellation (instant response on exchange switch)
 * and batched onUpdate calls to reduce setState pressure on the main thread.
 *
 * @param instruments - Array of instrument IDs to fetch (order matters: index determines tier)
 * @param existingData - Map of existing RSI data keyed by instrument ID
 * @param fetchSingle - Function to fetch RSI for a single instrument
 * @param onProgress - Callback for progress updates (e.g., "Loading Top 50: 5/10")
 * @param onUpdate - Callback when new data is fetched (called with instId and RSIData)
 * @param tier - Optional: fetch specific tier only ('top50', 'tier2', 'tier3', or 'all'/undefined)
 * @param signal - Optional AbortSignal to cancel the batch mid-flight
 * @param concurrency - Instruments fetched at once. 1 (default) is the paced,
 *   one-at-a-time path with the per-tier delay; above 1 the per-tier delay is
 *   skipped and the exchange's rate limiter is the only throttle.
 */
export async function fetchRSIBatchGeneric(
  instruments: string[],
  existingData: Map<string, RSIData>,
  fetchSingle: (id: string) => Promise<RSIData | null>,
  onProgress: (text: string) => void,
  onUpdate: (id: string, data: RSIData) => void,
  tier?: 'top50' | 'tier2' | 'tier3' | 'all',
  signal?: AbortSignal,
  concurrency: number = 1
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

  // Pending batch buffer — flushed every BATCH_SIZE items or at tier boundary
  let pendingBatch: Array<[string, RSIData]> = [];

  const flushBatch = () => {
    if (pendingBatch.length === 0) return;
    const batch = pendingBatch;
    pendingBatch = [];
    // Single onUpdate per batch → one setState instead of N
    for (const [id, data] of batch) {
      onUpdate(id, data);
    }
  };

  /** Process one tier's worth of instruments */
  async function processTier(
    items: string[],
    label: string,
    delayMs: number
  ): Promise<void> {
    const paced = concurrency <= 1;
    let next = 0;

    // Each worker pulls the next instrument in rank order, so the top of the
    // board still fills first when several run at once.
    const worker = async (): Promise<void> => {
      while (next < items.length) {
        // ── Abort check ──
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

        const i = next++;
        const id = items[i];
        onProgress(`Loading ${label}: ${i + 1}/${items.length}`);

        const rsiData = await fetchSingle(id);
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

        if (rsiData) {
          pendingBatch.push([id, rsiData]);
          if (pendingBatch.length >= (paced ? BATCH_SIZE_PACED : BATCH_SIZE)) {
            flushBatch();
          }
        }

        if (paced && next < items.length) {
          await abortableDelay(delayMs, signal);
        }
      }
    };

    const workers = Math.max(1, Math.min(concurrency, items.length));
    await Promise.all(Array.from({ length: workers }, worker));
    // Flush remaining at tier boundary
    flushBatch();
  }

  try {
    await processTier(top50, 'Top 50', TIMING.RSI_DELAY_TOP50);
    await processTier(tier2List, '51-100', TIMING.RSI_DELAY_TIER2);
    await processTier(tier3List, 'others', TIMING.RSI_DELAY_TIER3);
    onProgress('');
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      // Flush whatever we collected so far — no data loss
      flushBatch();
      onProgress('');
      return; // Silent exit, not an error
    }
    throw err; // Re-throw genuine errors
  }
}
