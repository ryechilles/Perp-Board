/**
 * OKX RSI — thin wrapper around the shared RSI pipeline
 * Only provides OKX-specific candle fetching; calculation logic is in rsi-core.ts
 */

import { RSIData } from '../types';
import { API } from '../constants';
import { CandleFetcher, calculateRSIForInstrument } from './rsi-core';
import { okxCandleMutex, okxFetch } from './okx-gateway';

const OKX_REST_BASE = API.OKX_REST_BASE;

/** OKX candle fetcher — GET request, response is newest-first string arrays */
const okxCandleFetcher: CandleFetcher = {
  async fetchCandles(instId: string, interval: string, limit: number): Promise<number[][] | null> {
    try {
      const response = await okxFetch(`${OKX_REST_BASE}/market/candles?instId=${instId}&bar=${interval}&limit=${limit}`);
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

  // Rate metering now happens inside okxFetch (shared OKX gateway), so the
  // pipeline's explicit waitForSlot is a no-op to avoid double-counting slots.
  async waitForSlot(): Promise<void> {
    // intentionally empty — see okxFetch
  },
};

/** Fetch RSI data for a single OKX instrument */
export async function fetchRSIForInstrument(instId: string): Promise<RSIData | null> {
  return calculateRSIForInstrument(
    instId,
    okxCandleFetcher,
    okxCandleMutex,
    '1D',   // daily
    '1W',   // weekly
    '1H',   // hourly
    '4H',   // 4H fallback
  );
}
