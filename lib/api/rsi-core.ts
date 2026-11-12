/**
 * Shared RSI Calculation Pipeline
 * Extracts the common RSI/sparkline calculation logic that's identical
 * between OKX and Hyperliquid. Each exchange only needs to implement
 * a CandleFetcher to provide candle data in normalized format.
 *
 * Candle format (number[][]): [timestamp, open, high, low, close, volume?]
 * Candles must be in chronological order (oldest first).
 */

import { RSIData, TDState } from '../types';
import { calculateRSI, calculate7DChange, calculateTDState, Mutex } from '../utils';
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
  /**
   * Fetch the three timeframes concurrently instead of one after another. Only
   * for exchanges whose rate limiter alone is enough protection (OKX); a tight
   * weight budget (Hyperliquid) keeps the sequential, paced path.
   */
  parallel?: boolean;
}

const pause = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

/**
 * Calculate full RSI data for a single instrument using the provided candle fetcher.
 * This is the shared pipeline that handles:
 * - Daily RSI (7, 14) + 7D change + sparkline
 * - Weekly RSI (7, 14)
 * - Hourly: 1H/4H change + 24H sparkline (with 4H fallback)
 *
 * `mutex` serializes whole instruments (pass null to rely on the rate limiter
 * and let the caller choose the concurrency).
 */
export async function calculateRSIForInstrument(
  symbol: string,
  fetcher: CandleFetcher,
  mutex: Mutex | null,
  /** Interval string for daily candles (e.g., "1D" for OKX, "1d" for Hyperliquid) */
  dailyInterval: string,
  /** Interval string for weekly candles */
  weeklyInterval: string,
  /** Interval string for hourly candles */
  hourlyInterval: string,
  /** Interval string for 4H candles (fallback) */
  fourHourInterval: string,
): Promise<RSIData | null> {
  await mutex?.acquire();

  try {
    /** One rate-limited candle request; a failure is null, never a throw. */
    const fetchTimeframe = async (interval: string, limit: number): Promise<number[][] | null> => {
      await fetcher.waitForSlot();
      try {
        return await fetcher.fetchCandles(symbol, interval, limit);
      } catch {
        console.warn(`Candles failed for ${symbol} ${interval}`);
        return null;
      }
    };

    let dailyCandles: number[][] | null;
    let weeklyCandles: number[][] | null;
    let hourlyCandles: number[][] | null;

    if (fetcher.parallel) {
      [dailyCandles, weeklyCandles, hourlyCandles] = await Promise.all([
        fetchTimeframe(dailyInterval, 100),
        fetchTimeframe(weeklyInterval, 100),
        fetchTimeframe(hourlyInterval, 24),
      ]);
    } else {
      dailyCandles = await fetchTimeframe(dailyInterval, 100);
      await pause(TIMING.API_BATCH_DELAY);
      weeklyCandles = await fetchTimeframe(weeklyInterval, 100);
      await pause(TIMING.API_BATCH_DELAY);
      hourlyCandles = await fetchTimeframe(hourlyInterval, 24);
    }

    let rsi7: number | null = null;
    let rsi14: number | null = null;
    let rsiW7: number | null = null;
    let rsiW14: number | null = null;
    let change1h: number | null = null;
    let change4h: number | null = null;
    let change7d: number | null = null;
    let sparkline7d: number[] | undefined;
    let sparkline24h: number[] | undefined;
    let td: TDState | null = null;

    // ===== Daily candles for RSI + 7D change =====
    if (dailyCandles && dailyCandles.length >= 15) {
      const closes = dailyCandles.map(c => c[4]);
      rsi7 = calculateRSI(closes, 7);
      rsi14 = calculateRSI(closes, 14);
      change7d = calculate7DChange(dailyCandles);
      sparkline7d = closes.slice(-7);
      td = calculateTDState(dailyCandles);
    }

    // ===== Weekly candles for weekly RSI =====
    if (weeklyCandles && weeklyCandles.length >= 15) {
      const closesW = weeklyCandles.map(c => c[4]);
      rsiW7 = calculateRSI(closesW, 7);
      rsiW14 = calculateRSI(closesW, 14);
    }

    // ===== Hourly candles for 1H/4H change + 24H sparkline =====
    if (hourlyCandles && hourlyCandles.length >= 2) {
      sparkline24h = hourlyCandles.map(c => c[4]);
      const currentClose = hourlyCandles[hourlyCandles.length - 1][4];

      const prev1hClose = hourlyCandles[hourlyCandles.length - 2][4];
      if (prev1hClose > 0) {
        change1h = ((currentClose - prev1hClose) / prev1hClose) * 100;
      }

      if (hourlyCandles.length >= 5) {
        const prev4hClose = hourlyCandles[hourlyCandles.length - 5][4];
        if (prev4hClose > 0) {
          change4h = ((currentClose - prev4hClose) / prev4hClose) * 100;
        }
      }
    } else if (!hourlyCandles) {
      // Hourly request failed — fall back to 4H candles for change4h only.
      const candles4h = await fetchTimeframe(fourHourInterval, 2);
      if (candles4h && candles4h.length >= 2) {
        const currentClose = candles4h[candles4h.length - 1][4];
        const prevClose = candles4h[candles4h.length - 2][4];
        if (prevClose > 0) {
          change4h = ((currentClose - prevClose) / prevClose) * 100;
        }
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
      td,
      lastUpdated: Date.now(),
    };
  } catch (error) {
    console.error(`Failed to fetch RSI for ${symbol}:`, error);
    return null;
  } finally {
    mutex?.release();
  }
}
