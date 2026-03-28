/**
 * OKX RSI calculation functions
 * Handles fetching and calculating RSI data
 */

import { RSIData } from '../types';
import { calculateRSI, calculateADX, calculate7DChange, Mutex, RateLimiter } from '../utils';
import { API, TIMING, RATE_LIMIT } from '../constants';

const OKX_REST_BASE = API.OKX_REST_BASE;

// Global mutex for RSI fetching to prevent concurrent API calls
const rsiMutex = new Mutex();
const rateLimiter = new RateLimiter(RATE_LIMIT.MAX_REQUESTS_PER_SECOND, RATE_LIMIT.WINDOW_MS);

// Fetch RSI data for a single instrument with mutex protection
export async function fetchRSIForInstrument(instId: string): Promise<RSIData | null> {
  await rsiMutex.acquire();

  try {
    await rateLimiter.waitForSlot();

    // Fetch daily candles for RSI and 7D change
    // Need more candles for RSI to converge properly (TradingView uses ~100+ bars)
    const response = await fetch(`${OKX_REST_BASE}/market/candles?instId=${instId}&bar=1D&limit=100`);
    if (!response.ok) {
      console.warn(`Daily candles HTTP error for ${instId}: ${response.status}`);
      return null;
    }
    const data = await response.json();

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

    if (data.code === '0' && data.data && data.data.length >= 15) {
      // OKX returns newest first, include current candle to match OKX's own RSI display
      const candles = [...data.data].reverse();
      const closes = candles.map((c: string[]) => parseFloat(c[4]));

      rsi7 = calculateRSI(closes, 7);
      rsi14 = calculateRSI(closes, 14);
      change7d = calculate7DChange(candles.map((c: string[]) => c.map(parseFloat)));

      // Calculate ADX from daily OHLC candles
      // OKX candle format: [ts, open, high, low, close, vol, volCcy, volCcyQuote, confirm]
      const ohlcCandles = candles.map((c: string[]) => c.map(parseFloat));
      adx14 = calculateADX(ohlcCandles);

      // Save last 7 days of closes for sparkline (from daily candles)
      sparkline7d = closes.slice(-7);
    }

    // Small delay before weekly request
    await new Promise(r => setTimeout(r, TIMING.API_BATCH_DELAY));
    await rateLimiter.waitForSlot();

    // Fetch weekly candles for weekly RSI
    // Need more candles for RSI to converge properly
    try {
      const responseW = await fetch(`${OKX_REST_BASE}/market/candles?instId=${instId}&bar=1W&limit=100`);
      const dataW = await responseW.json();

      if (dataW.code === '0' && dataW.data && dataW.data.length >= 15) {
        // Include current candle to match OKX's own RSI display
        const candlesW = [...dataW.data].reverse();
        const closesW = candlesW.map((c: string[]) => parseFloat(c[4]));

        rsiW7 = calculateRSI(closesW, 7);
        rsiW14 = calculateRSI(closesW, 14);
      }
    } catch (e) {
      console.warn(`Weekly RSI data failed for ${instId}`);
    }

    // Small delay before 1H request
    await new Promise(r => setTimeout(r, TIMING.API_BATCH_DELAY));
    await rateLimiter.waitForSlot();

    // Fetch 1H candles for 24h sparkline (24 data points)
    try {
      const response1h = await fetch(`${OKX_REST_BASE}/market/candles?instId=${instId}&bar=1H&limit=24`);
      const data1h = await response1h.json();

      if (data1h.code === '0' && data1h.data && data1h.data.length >= 2) {
        // Reverse to chronological order and extract closes
        const candles1h = [...data1h.data].reverse();
        sparkline24h = candles1h.map((c: string[]) => parseFloat(c[4]));

        const currentClose = parseFloat(candles1h[candles1h.length - 1][4]);

        // Calculate 1h change from the last 1 hour
        if (candles1h.length >= 2) {
          const prev1hClose = parseFloat(candles1h[candles1h.length - 2][4]);
          if (prev1hClose > 0) {
            change1h = ((currentClose - prev1hClose) / prev1hClose) * 100;
          }
        }

        // Calculate 4h change from the last 4 hours
        if (candles1h.length >= 5) {
          const prev4hClose = parseFloat(candles1h[candles1h.length - 5][4]);
          if (prev4hClose > 0) {
            change4h = ((currentClose - prev4hClose) / prev4hClose) * 100;
          }
        }
      }
    } catch (e) {
      console.warn(`1H data failed for ${instId}`);

      // Fallback: fetch 4H candles for change4h only
      try {
        await rateLimiter.waitForSlot();
        const response4h = await fetch(`${OKX_REST_BASE}/market/candles?instId=${instId}&bar=4H&limit=2`);
        const data4h = await response4h.json();

        if (data4h.code === '0' && data4h.data && data4h.data.length >= 2) {
          const currentClose = parseFloat(data4h.data[0][4]);
          const prevClose = parseFloat(data4h.data[1][4]);
          if (prevClose > 0) {
            change4h = ((currentClose - prevClose) / prevClose) * 100;
          }
        }
      } catch (e2) {
        console.warn(`4H fallback failed for ${instId}`);
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
      lastUpdated: Date.now()
    };
  } catch (error) {
    console.error(`Failed to fetch RSI for ${instId}:`, error);
    return null;
  } finally {
    rsiMutex.release();
  }
}

