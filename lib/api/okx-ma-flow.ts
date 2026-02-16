/**
 * OKX MA Flow (Three-Line Convergence) calculation
 * Fetches candle data and calculates MA7, MA30, MA200 convergence
 * across 4H, Daily, Weekly, Monthly timeframes
 */

import { MAFlowData, MAValues } from '../types';
import { Mutex, RateLimiter } from '../concurrency';
import { API, RATE_LIMIT, MA_FLOW } from '../constants';

const OKX_REST_BASE = API.OKX_REST_BASE;

// Share mutex and rate limiter with RSI module to prevent conflicts
// Using new instances since RSI module uses its own (they don't export them)
const maMutex = new Mutex();
const maRateLimiter = new RateLimiter(RATE_LIMIT.MAX_REQUESTS_PER_SECOND, RATE_LIMIT.WINDOW_MS);

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
 * spread % = (max(MA7, MA30, MA200) - min(MA7, MA30, MA200)) / currentPrice * 100
 */
export function calculateConvergence(
  ma7: number | null,
  ma30: number | null,
  ma200: number | null,
  currentPrice: number
): number | null {
  // Need at least 2 valid MAs for convergence
  const validMAs = [ma7, ma30, ma200].filter((v): v is number => v !== null);
  if (validMAs.length < 2 || currentPrice <= 0) return null;

  const maxMA = Math.max(...validMAs);
  const minMA = Math.min(...validMAs);
  return ((maxMA - minMA) / currentPrice) * 100;
}

// ===========================================
// Candle Fetching with Pagination
// ===========================================

// Fetch timeout in milliseconds
const FETCH_TIMEOUT_MS = 10000;
const MAX_RETRIES = 2;

/**
 * Fetch with AbortController timeout
 */
async function fetchWithTimeout(url: string, timeoutMs: number = FETCH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Fetch candles from OKX with pagination support, retry logic, and timeout
 * OKX returns max 100 candles per request, newest first
 * Uses `after` param to fetch older data
 */
async function fetchCandlesWithPagination(
  instId: string,
  bar: string,
  needed: number
): Promise<number[] | null> {
  const allCandles: string[][] = [];
  let after: string | undefined;
  const maxPerRequest = 100;
  let pageAttempts = 0;
  const maxPageAttempts = Math.ceil(needed / maxPerRequest) + 1;

  while (allCandles.length < needed && pageAttempts < maxPageAttempts) {
    pageAttempts++;

    let success = false;
    for (let retry = 0; retry <= MAX_RETRIES; retry++) {
      if (retry > 0) {
        // Back-off delay before retry
        await new Promise(r => setTimeout(r, 500 * retry));
      }

      await maMutex.acquire();
      try {
        await maRateLimiter.waitForSlot();

        let url = `${OKX_REST_BASE}/market/candles?instId=${instId}&bar=${bar}&limit=${maxPerRequest}`;
        if (after) {
          url += `&after=${after}`;
        }

        const response = await fetchWithTimeout(url);
        if (!response.ok) {
          console.warn(`[MA Flow] HTTP ${response.status} for ${instId} ${bar} (attempt ${retry + 1})`);
          continue; // Will retry after mutex release in finally
        }

        const data = await response.json();
        if (data.code !== '0' || !data.data || data.data.length === 0) {
          success = true; // Not an error, just no more data
          break;
        }

        const candles = data.data as string[][];
        allCandles.push(...candles);
        success = true;

        // If we got fewer than requested, there's no more data
        if (candles.length < maxPerRequest) break;

        // Set `after` to the oldest timestamp for next page
        after = candles[candles.length - 1][0];
        break;
      } catch (error) {
        const isTimeout = error instanceof DOMException && error.name === 'AbortError';
        console.warn(`[MA Flow] ${isTimeout ? 'Timeout' : 'Fetch failed'} for ${instId} ${bar} (attempt ${retry + 1}):`, error);
        // Will retry after mutex release in finally
      } finally {
        maMutex.release();
      }
    }

    if (!success) break;

    // Small delay between pagination requests
    if (allCandles.length < needed) {
      await new Promise(r => setTimeout(r, 50));
    }
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
 * Fetch MA data for a single instrument across all 4 timeframes
 * @param instId - The instrument ID (e.g., "BTC-USDT-SWAP")
 * @param currentPrice - The current ticker price from live data (more accurate than MA proxy)
 */
export async function fetchMAForInstrument(instId: string, currentPrice: number): Promise<MAFlowData | null> {
  try {
    // Fetch all 4 timeframes sequentially (to respect rate limits)
    const ma4h = await fetchMAsForTimeframe(instId, TIMEFRAME_BARS['4h']);

    await new Promise(r => setTimeout(r, 50));
    const maDaily = await fetchMAsForTimeframe(instId, TIMEFRAME_BARS['daily']);

    await new Promise(r => setTimeout(r, 50));
    const maWeekly = await fetchMAsForTimeframe(instId, TIMEFRAME_BARS['weekly']);

    await new Promise(r => setTimeout(r, 50));
    const maMonthly = await fetchMAsForTimeframe(instId, TIMEFRAME_BARS['monthly']);

    // Use ticker price for convergence calculation; fallback to MA7 only if ticker price unavailable
    const price = currentPrice > 0 ? currentPrice : (ma4h?.ma7 ?? maDaily?.ma7 ?? 0);

    return {
      ma4h,
      maDaily,
      maWeekly,
      maMonthly,
      convergence4h: ma4h ? calculateConvergence(ma4h.ma7, ma4h.ma30, ma4h.ma200, price) : null,
      convergenceDaily: maDaily ? calculateConvergence(maDaily.ma7, maDaily.ma30, maDaily.ma200, price) : null,
      convergenceWeekly: maWeekly ? calculateConvergence(maWeekly.ma7, maWeekly.ma30, maWeekly.ma200, price) : null,
      convergenceMonthly: maMonthly ? calculateConvergence(maMonthly.ma7, maMonthly.ma30, maMonthly.ma200, price) : null,
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
 * Batch fetch MA data for multiple instruments (Top 50 only)
 * @param tickerPrices - Map of instId to current price from live ticker data
 */
export async function fetchMAFlowBatch(
  instIds: string[],
  existingData: Map<string, MAFlowData>,
  onProgress: (text: string) => void,
  onUpdate: (instId: string, data: MAFlowData) => void,
  tickerPrices?: Map<string, number>
): Promise<void> {
  const now = Date.now();

  // Only process Top 50
  const top50 = instIds.slice(0, 50);

  // Filter out instruments that still have fresh data
  const toFetch = top50.filter(id => {
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

    const currentPrice = tickerPrices?.get(instId) ?? 0;
    const maData = await fetchMAForInstrument(instId, currentPrice);
    if (maData) {
      onUpdate(instId, maData);
    }

    // Delay between instruments
    if (i < toFetch.length - 1) {
      await new Promise(r => setTimeout(r, MA_FLOW.FETCH_DELAY));
    }
  }

  onProgress('');
}
