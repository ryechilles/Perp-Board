import { describe, expect, it } from 'vitest';
import { CoinLoreCoin, isWellFormed, payloadProblem } from '@/lib/api/marketcap-validate';
import { MARKET_CAP } from '@/lib/constants';

const healthy = (n: number): CoinLoreCoin[] =>
  Array.from({ length: n }, (_, i) => ({
    symbol: `C${i}`,
    rank: i + 1,
    market_cap_usd: String(1_000_000 - i),
  }));

describe('isWellFormed', () => {
  it('accepts a normal row, including a genuine zero cap', () => {
    expect(isWellFormed({ symbol: 'BTC', rank: 1, market_cap_usd: '123.4' })).toBe(true);
    expect(isWellFormed({ symbol: 'DEAD', rank: '900', market_cap_usd: '0' })).toBe(true);
  });

  it("rejects CoinLore's corrupt '0?' market cap", () => {
    expect(isWellFormed({ symbol: 'ETH', rank: 2, market_cap_usd: '0?' })).toBe(false);
  });

  it('rejects rows without a symbol or a numeric rank', () => {
    expect(isWellFormed({ rank: 1, market_cap_usd: '1' })).toBe(false);
    expect(isWellFormed({ symbol: 'X', rank: 'n/a', market_cap_usd: '1' })).toBe(false);
  });
});

describe('payloadProblem', () => {
  it('passes a full, healthy payload', () => {
    expect(payloadProblem(healthy(500))).toBeNull();
  });

  it('rejects a thin payload', () => {
    expect(payloadProblem(healthy(MARKET_CAP.MIN_VALID_TOTAL - 1))).toMatch(/too thin/);
  });

  it('rejects a payload whose top ranks carry no market cap', () => {
    const coins = healthy(500);
    coins[1].market_cap_usd = '0';
    expect(payloadProblem(coins)).toMatch(/rank 2/);
  });

  it('rejects a payload missing some of the top ranks', () => {
    const coins = healthy(500).filter((c) => c.rank !== 3);
    expect(payloadProblem(coins)).toMatch(/top/);
  });
});
