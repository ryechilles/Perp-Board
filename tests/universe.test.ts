import { describe, expect, it } from 'vitest';
import { selectUniverse } from '@/lib/filters';
import { MarketCapData, ProcessedTicker } from '@/lib/types';

const ticker = (base: string, vol = 1): ProcessedTicker => ({
  instId: `${base}-USDT-SWAP`,
  baseSymbol: base,
  priceNum: 1,
  changeNum: 0,
  volCcy24h: String(vol),
  rawData: {} as ProcessedTicker['rawData'],
});

const ranks = (symbols: string[]): Map<string, MarketCapData> =>
  new Map(symbols.map((s, i) => [s, { marketCap: 1000 - i, rank: i + 1 }]));

const bases = (list: ProcessedTicker[]) => list.map((t) => t.baseSymbol);

describe('selectUniverse', () => {
  it('keeps the top-N crypto by rank and drops unranked crypto', () => {
    const data = [ticker('CCC'), ticker('AAA'), ticker('UNRANKED'), ticker('BBB')];
    const result = selectUniverse(data, ranks(['AAA', 'BBB', 'CCC']), null, 2);
    expect(bases(result).sort()).toEqual(['AAA', 'BBB']);
  });

  it('always keeps stock perps and never counts them against the cap', () => {
    const data = [ticker('AAA'), ticker('BBB'), ticker('TSLA'), ticker('NVDA')];
    const result = selectUniverse(data, ranks(['AAA', 'BBB']), null, 1);
    expect(bases(result).sort()).toEqual(['AAA', 'NVDA', 'TSLA']);
  });

  it('removes stablecoins before the rank cut', () => {
    const data = [ticker('USDC'), ticker('AAA'), ticker('BBB')];
    const result = selectUniverse(data, ranks(['USDC', 'AAA', 'BBB']), null, 2);
    expect(bases(result).sort()).toEqual(['AAA', 'BBB']);
  });

  it('falls back to 24h volume when the rank source cannot fill the cap', () => {
    // The CoinLore failure mode: only one coin still carries a rank. Trusting
    // that would collapse the board to a single row.
    const data = [ticker('BTC', 5), ticker('AAA', 30), ticker('BBB', 20), ticker('CCC', 10)];
    const result = selectUniverse(data, ranks(['BTC']), null, 3);
    expect(bases(result).sort()).toEqual(['AAA', 'BBB', 'CCC']);
  });

  it('cuts crypto without a spot listing, without backfilling the slot', () => {
    const data = [ticker('AAA'), ticker('BBB'), ticker('CCC')];
    const spot = { spotSymbols: new Set(['AAA-USDT', 'CCC-USDT']), spotSymbolFormat: 'base-usdt' as const };
    const result = selectUniverse(data, ranks(['AAA', 'BBB', 'CCC']), spot, 2);
    expect(bases(result)).toEqual(['AAA']);
  });

  it('skips the no-spot cut while spot symbols are not loaded yet', () => {
    const data = [ticker('AAA'), ticker('BBB')];
    const spot = { spotSymbols: new Set<string>(), spotSymbolFormat: 'base-usdt' as const };
    const result = selectUniverse(data, ranks(['AAA', 'BBB']), spot, 2);
    expect(bases(result).sort()).toEqual(['AAA', 'BBB']);
  });
});
