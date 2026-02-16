/**
 * Concurrency Utilities
 * Mutex and RateLimiter for managing API call sequencing
 */

import { RATE_LIMIT } from './constants';

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
