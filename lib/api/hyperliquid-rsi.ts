/**
 * Hyperliquid RSI calculation functions
 * Handles fetching candle data from Hyperliquid and calculating RSI
 *
 * Reuses the same calculateRSI / calculate7DChange functions from utils.ts
 * Only the data fetching is Hyperliquid-specific:
 * - POST to /info with { type: "candleSnapshot", coin, interval, startTime, endTime }
 * - Candles returned in chronological order (oldest first)
 * - Supported intervals: "1m","3m","5m","15m","30m","1h","2h","4h","8h","12h","1d","3d","1w","1M"
 */

import { RSIData, HyperliquidCandle } from '../types';
import { calculateRSI, calculateADX, calculate7DChange, Mutex, RateLimiter } from '../utils';
import { API, TIMING, RATE_LIMIT } from '../constants';

const HL_REST = API.HYPERLIQUID_REST;

// Mutex and rate limiter for Hyperliquid RSI fetching
const hlRsiMutex = new Mutex();
// Hyperliquid rate limit: 1200 weight per minute, each request = ~20 weight
// That's ~60 requests/minute = 1 request/second to be safe
const hlRateLimiter = new RateLimiter(4, RATE_LIMIT.WINDOW_MS);

// Fetch candle data from Hyperliquid
async function fetchCandles(
  coin: string,
  interval: string,
  limit: number
): Promise<number[][] | null> {
  try {
    // Calculate time range
    // Multiply limit by interval duration to get enough historical data
    const intervalMs = getIntervalMs(interval);
    const endTime = Date.now();
    const startTime = endTime - (limit * intervalMs);

    const response = await fetch(HL_REST, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'candleSnapshot',
        req: {
          coin,
          interval,
          startTime,
          endTime,
        },
      }),
    });

    if (!response.ok) {
      console.warn(`[Hyperliquid] Candles HTTP error for ${coin} ${interval}: ${response.status}`);
      return null;
    }

    const data: HyperliquidCandle[] = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      return null;
    }

    // Convert to number arrays [timestamp, open, high, low, close, volume]
    // Candles are already in chronological order (oldest first)
    return data.map(c => [
      c.t,
      parseFloat(c.o),
      parseFloat(c.h),
      parseFloat(c.l),
      parseFloat(c.c),
      parseFloat(c.v),
    ]);
  } catch (error) {
    console.warn(`[Hyperliquid] Failed to fetch candles for ${coin} ${interval}:`, error);
    return null;
  }
}

// Convert interval string to milliseconds
function getIntervalMs(interval: string): number {
  const map: Record<string, number> = {
    '1m': 60 * 1000,
    '3m': 3 * 60 * 1000,
    '5m': 5 * 60 * 1000,
    '15m': 15 * 60 * 1000,
    '30m': 30 * 60 * 1000,
    '1h': 60 * 60 * 1000,
    '2h': 2 * 60 * 60 * 1000,
    '4h': 4 * 60 * 60 * 1000,
    '8h': 8 * 60 * 60 * 1000,
    '12h': 12 * 60 * 60 * 1000,
    '1d': 24 * 60 * 60 * 1000,
    '3d': 3 * 24 * 60 * 60 * 1000,
    '1w': 7 * 24 * 60 * 60 * 1000,
    '1M': 30 * 24 * 60 * 60 * 1000,
  };
  return map[interval] || 24 * 60 * 60 * 1000;
}

// Fetch RSI data for a single Hyperliquid instrument
export async function fetchHyperliquidRSIForInstrument(coin: string): Promise<RSIData | null> {
  await hlRsiMutex.acquire();

  try {
    await hlRateLimiter.waitForSlot();

    // ===== Daily candles for RSI + 7D change =====
    const dailyCandles = await fetchCandles(coin, '1d', 100);

    let rsi7: number | null = null;
    let rsi14: number | null = null;
    let rsiW7: number | null = null;
    let rsiW14: number | null = null;
    let adx14: number | null = null;
    let change1h: number | null = null;
    let change4h: number | null = null;
    let change7d: number | null = null;
    let sparkline7d: number[] | undefined;
    let sparkline24h: number[] | undefined;

    if (dailyCandles && dailyCandles.length >= 15) {
      const closes = dailyCandles.map(c => c[4]); // close price at index 4
      rsi7 = calculateRSI(closes, 7);
      rsi14 = calculateRSI(closes, 14);
      change7d = calculate7DChange(dailyCandles);

      // Calculate ADX from daily OHLC candles
      // Hyperliquid candle format: [timestamp, open, high, low, close, volume]
      adx14 = calculateADX(dailyCandles);

      // Save last 7 days of closes for sparkline
      sparkline7d = closes.slice(-7);
    }

    // Small delay before weekly request
    await new Promise(r => setTimeout(r, TIMING.API_BATCH_DELAY));
    await hlRateLimiter.waitForSlot();

    // ===== Weekly candles for weekly RSI =====
    try {
      const weeklyCandles = await fetchCandles(coin, '1w', 100);

      if (weeklyCandles && weeklyCandles.length >= 15) {
        const closesW = weeklyCandles.map(c => c[4]);
        rsiW7 = calculateRSI(closesW, 7);
        rsiW14 = calculateRSI(closesW, 14);
      }
    } catch (e) {
      console.warn(`[Hyperliquid] Weekly RSI failed for ${coin}`);
    }

    // Small delay before hourly request
    await new Promise(r => setTimeout(r, TIMING.API_BATCH_DELAY));
    await hlRateLimiter.waitForSlot();

    // ===== Hourly candles for 1h/4h change + 24h sparkline =====
    try {
      const hourlyCandles = await fetchCandles(coin, '1h', 24);

      if (hourlyCandles && hourlyCandles.length >= 2) {
        sparkline24h = hourlyCandles.map(c => c[4]);
        const currentClose = hourlyCandles[hourlyCandles.length - 1][4];

        // 1h change
        if (hourlyCandles.length >= 2) {
          const prev1hClose = hourlyCandles[hourlyCandles.length - 2][4];
          if (prev1hClose > 0) {
            change1h = ((currentClose - prev1hClose) / prev1hClose) * 100;
          }
        }

        // 4h change
        if (hourlyCandles.length >= 5) {
          const prev4hClose = hourlyCandles[hourlyCandles.length - 5][4];
          if (prev4hClose > 0) {
            change4h = ((currentClose - prev4hClose) / prev4hClose) * 100;
          }
        }
      }
    } catch (e) {
      console.warn(`[Hyperliquid] 1H data failed for ${coin}`);

      // Fallback: fetch 4H candles for change4h only
      try {
        await hlRateLimiter.waitForSlot();
        const candles4h = await fetchCandles(coin, '4h', 2);

        if (candles4h && candles4h.length >= 2) {
          const currentClose = candles4h[candles4h.length - 1][4];
          const prevClose = candles4h[candles4h.length - 2][4];
          if (prevClose > 0) {
            change4h = ((currentClose - prevClose) / prevClose) * 100;
          }
        }
      } catch (e2) {
        console.warn(`[Hyperliquid] 4H fallback failed for ${coin}`);
      }
    }

    return {
      rsi7,
      rsi14,
      rsiW7,
      rsiW14,
      adx14,
      change1h,
      change4h,
      change7d,
      sparkline7d,
      sparkline24h,
      lastUpdated: Date.now(),
    };
  } catch (error) {
    console.error(`[Hyperliquid] Failed to fetch RSI for ${coin}:`, error);
    return null;
  } finally {
    hlRsiMutex.release();
  }
}

