/**
 * Concurrency Utilities
 * Mutex, RateLimiter, and retry helpers for managing API call sequencing
 */

import { RATE_LIMIT } from './constants';

// ===========================================
// Retry with Exponential Backoff
// ===========================================

export interface RetryOptions {
  /** Maximum number of attempts (including the first). Default: 3 */
  maxAttempts?: number;
  /** Base delay in ms before the first retry. Default: 1000 */
  baseDelay?: number;
  /** Maximum delay cap in ms. Default: 10000 */
  maxDelay?: number;
  /** Optional label for log messages */
  label?: string;
}

/**
 * Retry a promise-returning function with exponential backoff.
 * The first attempt runs immediately; retries use `baseDelay * 2^(attempt-1)`.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { maxAttempts = 3, baseDelay = 1000, maxDelay = 10000, label = 'operation' } = options;

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === maxAttempts) break;

      const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
      console.warn(`[Retry] ${label} failed (attempt ${attempt}/${maxAttempts}), retrying in ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }

  throw lastError;
}

/**
 * Mutex class for preventing concurrent API calls
 * Ensures only one caller holds the lock at a time
 */
export class Mutex {
  private locked = false;
  private queue: (() => void)[] = [];

  async acquire(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.locked) {
        this.locked = true;
        resolve();
      } else {
        this.queue.push(resolve);
      }
    });
  }

  release(): void {
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      // Defer next() to avoid synchronous lock state inconsistency
      // Without this, the next acquirer runs before release() completes its stack frame
      if (next) Promise.resolve().then(next);
    } else {
      this.locked = false;
    }
  }
}

/**
 * API rate limiter using sliding window
 * Tracks timestamps and waits when the window is full
 */
export class RateLimiter {
  private timestamps: number[] = [];
  private maxRequests: number;
  private windowMs: number;

  constructor(maxRequests: number = RATE_LIMIT.MAX_REQUESTS_PER_SECOND, windowMs: number = RATE_LIMIT.WINDOW_MS) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  async waitForSlot(): Promise<void> {
    const now = Date.now();
    this.timestamps = this.timestamps.filter(t => now - t < this.windowMs);

    if (this.timestamps.length >= this.maxRequests) {
      const oldestTimestamp = this.timestamps[0];
      const waitTime = this.windowMs - (now - oldestTimestamp) + 50;
      await new Promise(r => setTimeout(r, waitTime));
      return this.waitForSlot();
    }

    this.timestamps.push(now);
  }
}
