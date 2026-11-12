/**
 * OKX MA Flow (Three-Line Convergence) calculation
 * Fetches candle data and calculates MA7, MA30, MA200 convergence
 * across 4H, Daily, Weekly, Monthly timeframes
 */

import { MAFlowData, MAValues } from '../types';
import { API, MA_FLOW } from '../constants';
import { okxRateLimiter } from './okx-gateway';

const OKX_REST_BASE = API.OKX_REST_BASE;

// ===========================================
// SMA Calculation
// ===========================================

/**
 * Calculate Simple Moving Average for given period
 * Returns null if insufficient data
 */
export function calculateSMA(closes: number[], period: number): number | null {
  if (closes.length < period) return null;
  const slice = closes.slice(closes.length - period);
  const sum = slice.reduce((a, b) => a + b, 0);
  return sum / period;
}

/**
 * Calculate convergence spread percentage
 * spread % = (max(MA7, MA30, MA200) - min(MA7, MA30, MA200)) / avg(MAs) * 100
 * Uses the average of the MA values as denominator (not currentPrice) to avoid
 * distortion when price diverges significantly from the moving averages.
 * Requires all 3 MAs to be valid for true three-line convergence detection.
 */
export function calculateConvergence(
  ma7: number | null,
  ma30: number | null,
  ma200: number | null,
): number | null {
  // Require all 3 valid MAs for true three-line convergence (三线粘合)
  if (ma7 === null || ma30 === null || ma200 === null) return null;

  const avgMA = (ma7 + ma30 + ma200) / 3;
  if (avgMA <= 0) return null;

  const maxMA = Math.max(ma7, ma30, ma200);
  const minMA = Math.min(ma7, ma30, ma200);
  return ((maxMA - minMA) / avgMA) * 100;
}

// ===========================================
// Candle Fetching with Pagination
// ===========================================

// Fetch timeout in milliseconds
const FETCH_TIMEOUT_MS = 10000;
const MAX_RETRIES = 2;

/**
 * Rate-limited OKX fetch with an AbortController timeout. The timer starts
 * once the request is actually sent, not while it waits for a rate slot.
 */
async function fetchWithTimeout(url: string, timeoutMs: number = FETCH_TIMEOUT_MS): Promise<Response> {
  await okxRateLimiter.waitForSlot();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Fetch candles from OKX with pagination support, retry logic, and timeout.
 * OKX returns up to MA_FLOW.CANDLES_PER_REQUEST candles per request, newest
 * first, so the usual 200-candle need is a single request; `after` pages back
 * to older data only if more is ever needed.
 */
async function fetchCandlesWithPagination(
  instId: string,
  bar: string,
  needed: number
): Promise<number[] | null> {
  const allCandles: string[][] = [];
  let after: string | undefined;
  const maxPerRequest = MA_FLOW.CANDLES_PER_REQUEST;
  let pageAttempts = 0;
  const maxPageAttempts = Math.ceil(needed / maxPerRequest) + 1;

  while (allCandles.length < needed && pageAttempts < maxPageAttempts) {
    pageAttempts++;
    const pageSize = Math.min(maxPerRequest, needed - allCandles.length);

    let success = false;
    let exhausted = false;
    for (let retry = 0; retry <= MAX_RETRIES; retry++) {
      if (retry > 0) {
        // Back-off delay before retry
        await new Promise(r => setTimeout(r, 500 * retry));
      }

      try {
        let url = `${OKX_REST_BASE}/market/candles?instId=${instId}&bar=${bar}&limit=${pageSize}`;
        if (after) {
          url += `&after=${after}`;
        }

        const response = await fetchWithTimeout(url);
        if (!response.ok) {
          console.warn(`[MA Flow] HTTP ${response.status} for ${instId} ${bar} (attempt ${retry + 1})`);
          continue;
        }

        const data = await response.json();
        success = true;
        if (data.code !== '0' || !data.data || data.data.length === 0) {
          exhausted = true; // Not an error, just no more data
          break;
        }

        const candles = data.data as string[][];
        allCandles.push(...candles);

        // Fewer than requested means there is no older data
        if (candles.length < pageSize) exhausted = true;

        // Set `after` to the oldest timestamp for next page
        after = candles[candles.length - 1][0];
        break;
      } catch (error) {
        const isTimeout = error instanceof DOMException && error.name === 'AbortError';
        console.warn(`[MA Flow] ${isTimeout ? 'Timeout' : 'Fetch failed'} for ${instId} ${bar} (attempt ${retry + 1}):`, error);
      }
    }

    if (!success || exhausted) break;
  }

  if (allCandles.length === 0) return null;

  // Reverse to chronological order (oldest first) and extract close prices
  const closes = allCandles.reverse().map((c: string[]) => parseFloat(c[4]));
  return closes;
}

// ===========================================
// Per-Timeframe MA Calculation
// ===========================================

/**
 * Fetch candles and calculate MAs for a single timeframe
 */
async function fetchMAsForTimeframe(
  instId: string,
  bar: string
): Promise<MAValues | null> {
  const closes = await fetchCandlesWithPagination(instId, bar, MA_FLOW.CANDLES_NEEDED);
  if (!closes || closes.length < MA_FLOW.MIN_CANDLES_MA7) return null;

  return {
    ma7: calculateSMA(closes, 7),
    ma30: calculateSMA(closes, 30),
    ma200: calculateSMA(closes, 200),
  };
}

// ===========================================
// Per-Instrument Full MA Fetch
// ===========================================

// OKX bar strings for each timeframe
const TIMEFRAME_BARS: Record<string, string> = {
  '4h': '4H',
  'daily': '1D',
  'weekly': '1W',
  'monthly': '1M',
};

/**
 * Fetch MA data for a single instrument across 3 timeframes (4H, Daily, Weekly)
 * @param instId - The instrument ID (e.g., "BTC-USDT-SWAP")
 */
export async function fetchMAForInstrument(instId: string): Promise<MAFlowData | null> {
  try {
    // The three timeframes go out together — the shared OKX rate limiter
    // (inside fetchWithTimeout) is what keeps this within the per-IP budget.
    const [ma4h, maDaily, maWeekly] = await Promise.all([
      fetchMAsForTimeframe(instId, TIMEFRAME_BARS['4h']),
      fetchMAsForTimeframe(instId, TIMEFRAME_BARS['daily']),
      fetchMAsForTimeframe(instId, TIMEFRAME_BARS['weekly']),
    ]);

    return {
      ma4h,
      maDaily,
      maWeekly,
      maMonthly: null,
      convergence4h: ma4h ? calculateConvergence(ma4h.ma7, ma4h.ma30, ma4h.ma200) : null,
      convergenceDaily: maDaily ? calculateConvergence(maDaily.ma7, maDaily.ma30, maDaily.ma200) : null,
      convergenceWeekly: maWeekly ? calculateConvergence(maWeekly.ma7, maWeekly.ma30, maWeekly.ma200) : null,
      convergenceMonthly: null,
      lastUpdated: Date.now(),
    };
  } catch (error) {
    console.error(`[MA Flow] Failed for ${instId}:`, error);
    return null;
  }
}

// ===========================================
// Batch Fetch
// ===========================================

/**
 * Batch fetch MA data for multiple instruments (Top N by market cap)
 */
export async function fetchMAFlowBatch(
  instIds: string[],
  existingData: Map<string, MAFlowData>,
  onProgress: (text: string) => void,
  onUpdate: (instId: string, data: MAFlowData) => void,
): Promise<void> {
  const now = Date.now();

  // Only process Top N by market cap (instIds are pre-sorted by market cap rank)
  const topN = instIds.slice(0, MA_FLOW.TOKEN_COUNT);

  // Filter out instruments that still have fresh data
  const toFetch = topN.filter(id => {
    const existing = existingData.get(id);
    if (!existing) return true;
    return now - existing.lastUpdated > MA_FLOW.STALE_THRESHOLD;
  });

  if (toFetch.length === 0) {
    onProgress('');
    return;
  }

  for (let i = 0; i < toFetch.length; i++) {
    const instId = toFetch[i];
    onProgress(`MA Flow: ${i + 1}/${toFetch.length}`);

    const maData = await fetchMAForInstrument(instId);
    if (maData) {
      onUpdate(instId, maData);
    }

  }

  onProgress('');
}
