/**
 * Shared Store Utilities
 * Pure functions extracted from exchange-specific stores (OKX / Hyperliquid)
 * These are stateless and can be used by any store without risk.
 */

import { ProcessedTicker, RSIData, MarketCapData, AssetCategory } from './types';
import { STOCK_SYMBOLS } from './constants';

// ===========================================
// Generic Map Pruning
// ===========================================

/**
 * Prune orphaned entries from a Map by removing keys not in the validKeys set.
 * Returns the original Map reference if nothing changed (React bail-out friendly).
 */
export function pruneMapByKeys<T>(map: Map<string, T>, validKeys: Set<string>): Map<string, T> {
  let hasOrphans = false;
  for (const key of map.keys()) {
    if (!validKeys.has(key)) { hasOrphans = true; break; }
  }
  if (!hasOrphans) return map;
  const pruned = new Map<string, T>();
  for (const [k, v] of map) {
    if (validKeys.has(k)) pruned.set(k, v);
  }
  return pruned;
}

// ===========================================
// RSI Averages (Top 100 by Market Cap)
// ===========================================

export interface RsiAverages {
  avgRsi7: number | null;
  avgRsi14: number | null;
  avgRsiW7: number | null;
  avgRsiW14: number | null;
}

/**
 * Calculate RSI averages for Top 100 tokens by market cap
 */
export function calculateRsiAverages(
  tickers: Map<string, ProcessedTicker>,
  marketCapData: Map<string, MarketCapData>,
  rsiData: Map<string, RSIData>
): RsiAverages {
  const allTickers = Array.from(tickers.values());

  const top100 = allTickers
    .filter(t => marketCapData.get(t.baseSymbol)?.marketCap)
    .sort((a, b) => {
      const mcA = marketCapData.get(a.baseSymbol)?.marketCap ?? 0;
      const mcB = marketCapData.get(b.baseSymbol)?.marketCap ?? 0;
      return mcB - mcA;
    })
    .slice(0, 100);

  let rsi7Sum = 0, rsi7Count = 0;
  let rsi14Sum = 0, rsi14Count = 0;
  let rsiW7Sum = 0, rsiW7Count = 0;
  let rsiW14Sum = 0, rsiW14Count = 0;

  top100.forEach(t => {
    const rsi = rsiData.get(t.instId);
    if (rsi?.rsi7 !== undefined && rsi.rsi7 !== null) {
      rsi7Sum += rsi.rsi7;
      rsi7Count++;
    }
    if (rsi?.rsi14 !== undefined && rsi.rsi14 !== null) {
      rsi14Sum += rsi.rsi14;
      rsi14Count++;
    }
    if (rsi?.rsiW7 !== undefined && rsi.rsiW7 !== null) {
      rsiW7Sum += rsi.rsiW7;
      rsiW7Count++;
    }
    if (rsi?.rsiW14 !== undefined && rsi.rsiW14 !== null) {
      rsiW14Sum += rsi.rsiW14;
      rsiW14Count++;
    }
  });

  return {
    avgRsi7: rsi7Count > 0 ? rsi7Sum / rsi7Count : null,
    avgRsi14: rsi14Count > 0 ? rsi14Sum / rsi14Count : null,
    avgRsiW7: rsiW7Count > 0 ? rsiW7Sum / rsiW7Count : null,
    avgRsiW14: rsiW14Count > 0 ? rsiW14Sum / rsiW14Count : null,
  };
}

// ===========================================
// Top Movers (Gainers / Losers)
// ===========================================

export interface TopMoversResult {
  gainers: (ProcessedTicker & { change: number | null })[];
  losers: (ProcessedTicker & { change: number | null })[];
}

/**
 * Get top gainers and losers by timeframe
 */
export function calculateTopMovers(
  tickers: Map<string, ProcessedTicker>,
  rsiData: Map<string, RSIData>,
  timeframe: '4h' | '24h' | '7d',
  limit: number = 5
): TopMoversResult {
  const allTickers = Array.from(tickers.values());

  const tickersWithChange = allTickers.map(t => {
    const rsi = rsiData.get(t.instId);
    let change: number | null = null;

    if (timeframe === '4h') {
      change = rsi?.change4h ?? null;
    } else if (timeframe === '24h') {
      change = t.changeNum;
    } else if (timeframe === '7d') {
      change = rsi?.change7d ?? null;
    }

    return { ...t, change };
  }).filter(t => t.change !== null);

  const sorted = [...tickersWithChange].sort((a, b) => (b.change ?? 0) - (a.change ?? 0));

  return {
    gainers: sorted.slice(0, limit),
    losers: sorted.slice(-limit).reverse(),
  };
}

// ===========================================
// Quick Filter Counts
// ===========================================

export interface QuickFilterCounts {
  overbought: number;
  oversold: number;
}

/**
 * Count tokens in overbought/oversold states (D-RSI7 & D-RSI14 both > 75 or < 25)
 * Filtered by asset category when specified
 */
export function calculateQuickFilterCounts(
  tickers: Map<string, ProcessedTicker>,
  rsiData: Map<string, RSIData>,
  assetCategory?: AssetCategory
): QuickFilterCounts {
  let allTickers = Array.from(tickers.values());

  // Filter by asset category if specified
  if (assetCategory) {
    allTickers = allTickers.filter(t => {
      const isStock = STOCK_SYMBOLS.has(t.baseSymbol);
      return assetCategory === 'stock' ? isStock : !isStock;
    });
  }

  const overbought = allTickers.filter(t => {
    const rsi = rsiData.get(t.instId);
    return rsi && rsi.rsi7 !== null && rsi.rsi14 !== null && rsi.rsi7 > 75 && rsi.rsi14 > 75;
  }).length;

  const oversold = allTickers.filter(t => {
    const rsi = rsiData.get(t.instId);
    return rsi && rsi.rsi7 !== null && rsi.rsi14 !== null && rsi.rsi7 < 25 && rsi.rsi14 < 25;
  }).length;

  return { overbought, oversold };
}
