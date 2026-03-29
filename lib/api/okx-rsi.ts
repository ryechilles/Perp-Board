/**
 * OKX RSI — thin wrapper around the shared RSI pipeline
 * Only provides OKX-specific candle fetching; calculation logic is in rsi-core.ts
 */

import { RSIData } from '../types';
import { Mutex, RateLimiter } from '../utils';
import { API, RATE_LIMIT } from '../constants';
import { CandleFetcher, calculateRSIForInstrument } from './rsi-core';

const OKX_REST_BASE = API.OKX_REST_BASE;

// Global mutex and rate limiter for OKX RSI fetching
const rsiMutex = new Mutex();
const rateLimiter = new RateLimiter(RATE_LIMIT.MAX_REQUESTS_PER_SECOND, RATE_LIMIT.WINDOW_MS);

/** OKX candle fetcher — GET request, response is newest-first string arrays */
const okxCandleFetcher: CandleFetcher = {
  async fetchCandles(instId: string, interval: string, limit: number): Promise<number[][] | null> {
    try {
      const response = await fetch(`${OKX_REST_BASE}/market/candles?instId=${instId}&bar=${interval}&limit=${limit}`);
      if (!response.ok) {
        console.warn(`[OKX] Candles HTTP error for ${instId} ${interval}: ${response.status}`);
        return null;
      }
      const data = await response.json();

      if (data.code !== '0' || !data.data || data.data.length === 0) {
        return null;
      }

      // OKX returns newest first — reverse to chronological, convert strings to numbers
      // OKX candle format: [ts, open, high, low, close, vol, volCcy, volCcyQuote, confirm]
      return [...data.data].reverse().map((c: string[]) => c.map(parseFloat));
    } catch (error) {
      console.warn(`[OKX] Failed to fetch candles for ${instId} ${interval}:`, error);
      return null;
    }
  },

  async waitForSlot(): Promise<void> {
    await rateLimiter.waitForSlot();
  },
};

/** Fetch RSI data for a single OKX instrument */
export async function fetchRSIForInstrument(instId: string): Promise<RSIData | null> {
  return calculateRSIForInstrument(
    instId,
    okxCandleFetcher,
    rsiMutex,
    '1D',   // daily
    '1W',   // weekly
    '1H',   // hourly
    '4H',   // 4H fallback
  );
}
