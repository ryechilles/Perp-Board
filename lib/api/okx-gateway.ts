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
 * Funnel rule: never call `fetch` directly against OKX — use `okxFetch`. The
 * limiter is the ONLY throttle: callers are free to run requests concurrently
 * (RSI fetches several instruments and all three timeframes at once) because
 * every request still has to take a slot from this one shared window.
 */

import { RateLimiter } from '../concurrency';
import { RATE_LIMIT } from '../constants';

/** Shared sliding-window limiter for every OKX REST request (per-IP budget). */
export const okxRateLimiter = new RateLimiter(
  RATE_LIMIT.MAX_REQUESTS_PER_SECOND,
  RATE_LIMIT.WINDOW_MS,
);

/** Rate-limited OKX fetch. Use for ALL OKX REST calls. */
export async function okxFetch(input: string, init?: RequestInit): Promise<Response> {
  await okxRateLimiter.waitForSlot();
  return fetch(input, init);
}
