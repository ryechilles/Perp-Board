/**
 * Shared RSI Calculation Pipeline
 * Extracts the common RSI/sparkline calculation logic that's identical
 * between OKX and Hyperliquid. Each exchange only needs to implement
 * a CandleFetcher to provide candle data in normalized format.
 *
 * Candle format (number[][]): [timestamp, open, high, low, close, volume?]
 * Candles must be in chronological order (oldest first).
 */

import { RSIData } from '../types';
import { calculateRSI, calculate7DChange, Mutex, RateLimiter } from '../utils';
import { TIMING } from '../constants';

/**
 * Interface for exchange-specific candle fetching.
 * Each exchange implements this to provide candles in normalized format.
 */
export interface CandleFetcher {
  /** Fetch candles for a single instrument. Returns null on failure. */
  fetchCandles(symbol: string, interval: string, limit: number): Promise<number[][] | null>;
  /** Wait for rate limit slot */
  waitForSlot(): Promise<void>;
}

/**
 * Calculate full RSI data for a single instrument using the provided candle fetcher.
 * This is the shared pipeline that handles:
 * - Daily RSI (7, 14) + 7D change + sparkline
 * - Weekly RSI (7, 14)
 * - Hourly: 1H/4H change + 24H sparkline (with 4H fallback)
 */
export async function calculateRSIForInstrument(
  symbol: string,
  fetcher: CandleFetcher,
  mutex: Mutex,
  /** Interval string for daily candles (e.g., "1D" for OKX, "1d" for Hyperliquid) */
  dailyInterval: string,
  /** Interval string for weekly candles */
  weeklyInterval: string,
  /** Interval string for hourly candles */
  hourlyInterval: string,
  /** Interval string for 4H candles (fallback) */
  fourHourInterval: string,
): Promise<RSIData | null> {
  await mutex.acquire();

  try {
    await fetcher.waitForSlot();

    let rsi7: number | null = null;
    let rsi14: number | null = null;
    let rsiW7: number | null = null;
    let rsiW14: number | null = null;
    let change1h: number | null = null;
    let change4h: number | null = null;
    let change7d: number | null = null;
    let sparkline7d: number[] | undefined;
    let sparkline24h: number[] | undefined;

    // ===== Daily candles for RSI + 7D change =====
    const dailyCandles = await fetcher.fetchCandles(symbol, dailyInterval, 100);

    if (dailyCandles && dailyCandles.length >= 15) {
      const closes = dailyCandles.map(c => c[4]);
      rsi7 = calculateRSI(closes, 7);
      rsi14 = calculateRSI(closes, 14);
      change7d = calculate7DChange(dailyCandles);
      sparkline7d = closes.slice(-7);
    }

    // Small delay before weekly request
    await new Promise(r => setTimeout(r, TIMING.API_BATCH_DELAY));
    await fetcher.waitForSlot();

    // ===== Weekly candles for weekly RSI =====
    try {
      const weeklyCandles = await fetcher.fetchCandles(symbol, weeklyInterval, 100);

      if (weeklyCandles && weeklyCandles.length >= 15) {
        const closesW = weeklyCandles.map(c => c[4]);
        rsiW7 = calculateRSI(closesW, 7);
        rsiW14 = calculateRSI(closesW, 14);
      }
    } catch (e) {
      console.warn(`Weekly RSI failed for ${symbol}`);
    }

    // Small delay before hourly request
    await new Promise(r => setTimeout(r, TIMING.API_BATCH_DELAY));
    await fetcher.waitForSlot();

    // ===== Hourly candles for 1H/4H change + 24H sparkline =====
    try {
      const hourlyCandles = await fetcher.fetchCandles(symbol, hourlyInterval, 24);

      if (hourlyCandles && hourlyCandles.length >= 2) {
        sparkline24h = hourlyCandles.map(c => c[4]);
        const currentClose = hourlyCandles[hourlyCandles.length - 1][4];

        // 1H change
        if (hourlyCandles.length >= 2) {
          const prev1hClose = hourlyCandles[hourlyCandles.length - 2][4];
          if (prev1hClose > 0) {
            change1h = ((currentClose - prev1hClose) / prev1hClose) * 100;
          }
        }

        // 4H change
        if (hourlyCandles.length >= 5) {
          const prev4hClose = hourlyCandles[hourlyCandles.length - 5][4];
          if (prev4hClose > 0) {
            change4h = ((currentClose - prev4hClose) / prev4hClose) * 100;
          }
        }
      }
    } catch (e) {
      console.warn(`1H data failed for ${symbol}`);

      // Fallback: fetch 4H candles for change4h only
      try {
        await fetcher.waitForSlot();
        const candles4h = await fetcher.fetchCandles(symbol, fourHourInterval, 2);

        if (candles4h && candles4h.length >= 2) {
          const currentClose = candles4h[candles4h.length - 1][4];
          const prevClose = candles4h[candles4h.length - 2][4];
          if (prevClose > 0) {
            change4h = ((currentClose - prevClose) / prevClose) * 100;
          }
        }
      } catch (e2) {
        console.warn(`4H fallback failed for ${symbol}`);
      }
    }

    return {
      rsi7,
      rsi14,
      rsiW7,
      rsiW14,
      change1h,
      change4h,
      change7d,
      sparkline7d,
      sparkline24h,
      lastUpdated: Date.now(),
    };
  } catch (error) {
    console.error(`Failed to fetch RSI for ${symbol}:`, error);
    return null;
  } finally {
    mutex.release();
  }
}
