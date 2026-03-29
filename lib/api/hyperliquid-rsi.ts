/**
 * Hyperliquid RSI — thin wrapper around the shared RSI pipeline
 * Only provides Hyperliquid-specific candle fetching; calculation logic is in rsi-core.ts
 */

import { RSIData, HyperliquidCandle } from '../types';
import { Mutex, RateLimiter } from '../utils';
import { API, RATE_LIMIT } from '../constants';
import { CandleFetcher, calculateRSIForInstrument } from './rsi-core';

const HL_REST = API.HYPERLIQUID_REST;

// Mutex and rate limiter for Hyperliquid RSI fetching
const hlRsiMutex = new Mutex();
// Hyperliquid rate limit: 1200 weight per minute, each request = ~20 weight
// That's ~60 requests/minute = ~1 request/second to be safe
const hlRateLimiter = new RateLimiter(4, RATE_LIMIT.WINDOW_MS);

// Convert interval string to milliseconds (for calculating time range)
function getIntervalMs(interval: string): number {
  const map: Record<string, number> = {
    '1m': 60_000,
    '3m': 3 * 60_000,
    '5m': 5 * 60_000,
    '15m': 15 * 60_000,
    '30m': 30 * 60_000,
    '1h': 3_600_000,
    '2h': 2 * 3_600_000,
    '4h': 4 * 3_600_000,
    '8h': 8 * 3_600_000,
    '12h': 12 * 3_600_000,
    '1d': 86_400_000,
    '3d': 3 * 86_400_000,
    '1w': 7 * 86_400_000,
    '1M': 30 * 86_400_000,
  };
  return map[interval] || 86_400_000;
}

/** Hyperliquid candle fetcher — POST request, response is chronological objects */
const hlCandleFetcher: CandleFetcher = {
  async fetchCandles(coin: string, interval: string, limit: number): Promise<number[][] | null> {
    try {
      const intervalMs = getIntervalMs(interval);
      const endTime = Date.now();
      const startTime = endTime - (limit * intervalMs);

      const response = await fetch(HL_REST, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'candleSnapshot',
          req: { coin, interval, startTime, endTime },
        }),
      });

      if (!response.ok) {
        console.warn(`[Hyperliquid] Candles HTTP error for ${coin} ${interval}: ${response.status}`);
        return null;
      }

      const data: HyperliquidCandle[] = await response.json();
      if (!Array.isArray(data) || data.length === 0) return null;

      // Already in chronological order — convert to number arrays
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
  },

  async waitForSlot(): Promise<void> {
    await hlRateLimiter.waitForSlot();
  },
};

/** Fetch RSI data for a single Hyperliquid instrument */
export async function fetchHyperliquidRSIForInstrument(coin: string): Promise<RSIData | null> {
  return calculateRSIForInstrument(
    coin,
    hlCandleFetcher,
    hlRsiMutex,
    '1d',   // daily
    '1w',   // weekly
    '1h',   // hourly
    '4h',   // 4H fallback
  );
}
