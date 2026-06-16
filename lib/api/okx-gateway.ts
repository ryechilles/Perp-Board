/**
 * OKX REST Gateway
 *
 * Single coordination point for ALL OKX REST traffic. OKX rate-limits per IP
 * across endpoints, so every OKX call (candles, tickers, funding, instruments)
 * must share ONE rate-limit window. Previously RSI and MA-Flow each owned a
 * SEPARATE 8 req/s limiter (combined 16/s, running concurrently) and the
 * funding-rate poll fired up to 20 unmetered requests at once via Promise.all —
 * both could trip OKX's limit and get the IP throttled.
 *
 * Funnel rule: never call `fetch` directly against OKX. Use `okxFetch` for
 * one-shot requests; the heavy paginated candle paths additionally take
 * `okxCandleMutex` so RSI and MA-Flow take turns instead of doubling load.
 */

import { Mutex, RateLimiter } from '../concurrency';
import { RATE_LIMIT } from '../constants';

/** Shared sliding-window limiter for every OKX REST request (per-IP budget). */
export const okxRateLimiter = new RateLimiter(
  RATE_LIMIT.MAX_REQUESTS_PER_SECOND,
  RATE_LIMIT.WINDOW_MS,
);

/**
 * Shared mutex for the heavy, paginated candle paths (RSI + MA Flow) so they
 * run sequentially instead of concurrently. Latency-sensitive one-shot calls
 * (tickers / funding / instruments) deliberately do NOT take this lock — they
 * only wait for a rate slot, so a long candle backfill can't starve them.
 */
export const okxCandleMutex = new Mutex();

/** Rate-limited OKX fetch. Use for ALL OKX REST calls. */
export async function okxFetch(input: string, init?: RequestInit): Promise<Response> {
  await okxRateLimiter.waitForSlot();
  return fetch(input, init);
}
