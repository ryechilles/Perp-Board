import { describe, expect, it } from 'vitest';
import { calculateRSI } from '@/lib/utils';
import { calculateConvergence, calculateSMA } from '@/lib/api/okx-ma-flow';
import { fetchRSIBatchGeneric } from '@/lib/api/rsi-batch';
import { RSIData } from '@/lib/types';

describe('calculateRSI', () => {
  it('needs period + 1 closes', () => {
    expect(calculateRSI([1, 2, 3], 14)).toBeNull();
  });

  it('is 100 for a pure uptrend, 0 for a pure downtrend, 50 when flat', () => {
    const up = Array.from({ length: 30 }, (_, i) => 100 + i);
    const down = Array.from({ length: 30 }, (_, i) => 100 - i);
    expect(calculateRSI(up, 14)).toBe(100);
    expect(calculateRSI(down, 14)).toBeCloseTo(0);
    expect(calculateRSI(new Array(30).fill(100), 14)).toBe(50);
  });

  it("matches Wilder's worked example (RSI 14 ≈ 70.46)", () => {
    const closes = [
      44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.1, 45.42, 45.84, 46.08,
      45.89, 46.03, 45.61, 46.28, 46.28,
    ];
    expect(calculateRSI(closes, 14)).toBeCloseTo(70.46, 1);
  });
});

describe('MA helpers', () => {
  it('averages the last `period` closes', () => {
    expect(calculateSMA([1, 2, 3, 4], 2)).toBe(3.5);
    expect(calculateSMA([1, 2], 3)).toBeNull();
  });

  it('measures the spread of the three MAs against their average', () => {
    expect(calculateConvergence(100, 100, 100)).toBe(0);
    expect(calculateConvergence(90, 100, 110)).toBeCloseTo(20);
    expect(calculateConvergence(100, null, 100)).toBeNull();
  });
});

describe('fetchRSIBatchGeneric concurrency', () => {
  const rsi = (): RSIData => ({ lastUpdated: Date.now() } as RSIData);

  it('fetches every instrument once and never exceeds the concurrency', async () => {
    const ids = Array.from({ length: 23 }, (_, i) => `I${i}`);
    const seen: string[] = [];
    const updated: string[] = [];
    let inFlight = 0;
    let peak = 0;

    await fetchRSIBatchGeneric(
      ids,
      new Map(),
      async (id) => {
        inFlight++;
        peak = Math.max(peak, inFlight);
        await new Promise((r) => setTimeout(r, 2));
        inFlight--;
        seen.push(id);
        return rsi();
      },
      () => {},
      (id) => updated.push(id),
      undefined,
      undefined,
      4
    );

    expect(peak).toBe(4);
    expect(seen.sort()).toEqual([...ids].sort());
    expect(updated.sort()).toEqual([...ids].sort());
  });

  it('stops on abort and keeps what it already fetched', async () => {
    const controller = new AbortController();
    const updated: string[] = [];
    let calls = 0;

    await fetchRSIBatchGeneric(
      Array.from({ length: 20 }, (_, i) => `I${i}`),
      new Map(),
      async () => {
        if (++calls === 6) controller.abort();
        return rsi();
      },
      () => {},
      (id) => updated.push(id),
      undefined,
      controller.signal,
      2
    );

    expect(calls).toBeLessThan(20);
    expect(updated.length).toBeGreaterThan(0);
  });
});
