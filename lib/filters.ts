/**
 * Filtering and Sorting Logic
 * Pure functions extracted from store hooks - stateless and reusable
 */

import {
  ProcessedTicker,
  RSIData,
  MarketCapData,
  FundingRateData,
  ListingData,
  Filters,
  SortConfig,
  RsiSignalType,
} from './types';
import { MEME_TOKENS, RSI } from './constants';

// ===========================================
// Filter Context
// ===========================================

/**
 * Context containing all lookup tables needed for filtering and sorting
 */
export interface FilterContext {
  rsiData: Map<string, RSIData>;
  marketCapData: Map<string, MarketCapData>;
  fundingRateData: Map<string, FundingRateData>;
  spotSymbols: Set<string>;
  listingData?: Map<string, ListingData>; // OKX only
  spotSymbolFormat: 'base-usdt' | 'base'; // OKX: 'BTC-USDT', HL: 'BTC'
  defaultSettlementInterval: number; // OKX: 8, HL: 1
}

/**
 * Context for sorting functions
 */
export type SortExtractorContext = {
  rsiData: Map<string, RSIData>;
  marketCapData: Map<string, MarketCapData>;
  fundingRateData: Map<string, FundingRateData>;
  spotSymbols: Set<string>;
  listingData?: Map<string, ListingData>;
  spotSymbolFormat: 'base-usdt' | 'base';
  defaultSettlementInterval: number;
};

// ===========================================
// RSI Filter Helper
// ===========================================

/**
 * Apply RSI filter with support for range (~), less-than (<), and greater-than (>)
 * Examples: "30~70", "<30", ">70"
 */
export function applyRsiFilter(
  rsiValue: number | null | undefined,
  filterValue: string
): boolean {
  if (rsiValue === null || rsiValue === undefined) return false;
  if (filterValue.includes('~')) {
    const [minStr, maxStr] = filterValue.split('~');
    const min = minStr ? parseInt(minStr) : 0;
    const max = maxStr ? parseInt(maxStr) : 100;
    return rsiValue >= min && rsiValue <= max;
  } else if (filterValue.startsWith('<')) {
    const threshold = parseInt(filterValue.slice(1));
    return rsiValue < threshold;
  } else if (filterValue.startsWith('>')) {
    const threshold = parseInt(filterValue.slice(1));
    return rsiValue > threshold;
  }
  return true;
}

// ===========================================
// RSI Signal Helper
// ===========================================

/**
 * Determine RSI signal based on rsi7 and rsi14 values
 * Returns a 9-state system matching pill colors
 */
export function getRsiSignal(rsi7: number | null, rsi14: number | null): { signal: RsiSignalType; level: number } {
  if (rsi7 === null || rsi7 === undefined || rsi14 === null || rsi14 === undefined) {
    return { signal: 'neutral', level: 5 };
  }

  const avgRsi = (rsi7 + rsi14) / 2;

  if (avgRsi < RSI.EXTREME_OVERSOLD) {
    return { signal: 'extreme-oversold', level: 1 };
  } else if (avgRsi < RSI.OVERSOLD) {
    return { signal: 'oversold', level: 2 };
  } else if (avgRsi < RSI.VERY_WEAK) {
    return { signal: 'very-weak', level: 3 };
  } else if (avgRsi < RSI.WEAK) {
    return { signal: 'weak', level: 4 };
  } else if (avgRsi < RSI.NEUTRAL_HIGH) {
    return { signal: 'neutral', level: 5 };
  } else if (avgRsi < RSI.STRONG) {
    return { signal: 'strong', level: 6 };
  } else if (avgRsi < RSI.VERY_STRONG) {
    return { signal: 'very-strong', level: 7 };
  } else if (avgRsi < RSI.OVERBOUGHT) {
    return { signal: 'overbought', level: 8 };
  } else {
    return { signal: 'extreme-overbought', level: 9 };
  }
}

// ===========================================
// Individual Filter Functions
// ===========================================

/**
 * Filter by search term
 * Supports pipe-separated search terms (e.g., "BTC|ETH")
 */
export function applySearchFilter(data: ProcessedTicker[], searchTerm: string): ProcessedTicker[] {
  if (!searchTerm) return data;

  const terms = searchTerm.toLowerCase().split('|').map(t => t.trim()).filter(t => t);
  if (terms.length === 0) return data;

  if (terms.length === 1) {
    return data.filter(t => t.instId.toLowerCase().includes(terms[0]));
  } else {
    return data.filter(t => terms.some(term => t.baseSymbol.toLowerCase() === term));
  }
}

/**
 * Filter by favorites view
 */
export function applyViewFilter(
  data: ProcessedTicker[],
  view: 'market' | 'favorites',
  favorites: string[]
): ProcessedTicker[] {
  if (view === 'favorites') {
    return data.filter(t => favorites.includes(t.instId));
  }
  return data;
}

/**
 * Filter by market cap rank
 * Rank ranges: '1-20', '1-25', '21-50', '51-100', '101-500', '>500'
 */
export function applyRankFilter(
  data: ProcessedTicker[],
  rankFilter: string | undefined,
  marketCapData: Map<string, MarketCapData>
): ProcessedTicker[] {
  if (!rankFilter) return data;

  const sortedByMarketCap = [...data].sort((a, b) => {
    const rankA = marketCapData.get(a.baseSymbol)?.rank ?? 9999;
    const rankB = marketCapData.get(b.baseSymbol)?.rank ?? 9999;
    return rankA - rankB;
  });

  const getTopN = (n: number) => new Set(sortedByMarketCap.slice(0, n).map(t => t.instId));
  const getRangeSet = (start: number, end: number) => new Set(sortedByMarketCap.slice(start - 1, end).map(t => t.instId));

  let rangeSet: Set<string>;

  switch (rankFilter) {
    case '1-20':
      rangeSet = getTopN(20);
      break;
    case '1-25':
      rangeSet = getTopN(25);
      break;
    case '21-50':
      rangeSet = getRangeSet(21, 50);
      break;
    case '51-100':
      rangeSet = getRangeSet(51, 100);
      break;
    case '101-500':
      rangeSet = getRangeSet(101, 500);
      break;
    case '>500':
      return data.filter(t => !marketCapData.get(t.baseSymbol)?.rank);
    default:
      return data;
  }

  return data.filter(t => rangeSet.has(t.instId));
}

/**
 * Apply RSI filters (rsi7, rsi14, rsiW7, rsiW14)
 */
export function applyRsiFilters(
  data: ProcessedTicker[],
  filters: Filters,
  rsiData: Map<string, RSIData>
): ProcessedTicker[] {
  let filtered = data;

  if (filters.rsi7) {
    filtered = filtered.filter(t => applyRsiFilter(rsiData.get(t.instId)?.rsi7, filters.rsi7!));
  }
  if (filters.rsi14) {
    filtered = filtered.filter(t => applyRsiFilter(rsiData.get(t.instId)?.rsi14, filters.rsi14!));
  }
  if (filters.rsiW7) {
    filtered = filtered.filter(t => applyRsiFilter(rsiData.get(t.instId)?.rsiW7, filters.rsiW7!));
  }
  if (filters.rsiW14) {
    filtered = filtered.filter(t => applyRsiFilter(rsiData.get(t.instId)?.rsiW14, filters.rsiW14!));
  }

  return filtered;
}

/**
 * Apply funding rate filter
 */
export function applyFundingFilter(
  data: ProcessedTicker[],
  fundingRateFilter: string | undefined,
  fundingRateData: Map<string, FundingRateData>
): ProcessedTicker[] {
  if (!fundingRateFilter) return data;

  if (fundingRateFilter === 'positive') {
    return data.filter(t => {
      const fr = fundingRateData.get(t.instId)?.fundingRate;
      return fr !== undefined && fr > 0;
    });
  } else if (fundingRateFilter === 'negative') {
    return data.filter(t => {
      const fr = fundingRateData.get(t.instId)?.fundingRate;
      return fr !== undefined && fr < 0;
    });
  }

  return data;
}

/**
 * Apply market cap filter
 * Bins: '0-20', '20-100', '100-1000', '1000+'
 */
export function applyMarketCapFilter(
  data: ProcessedTicker[],
  marketCapFilter: string | undefined,
  marketCapData: Map<string, MarketCapData>
): ProcessedTicker[] {
  if (!marketCapFilter) return data;

  return data.filter(t => {
    const cap = marketCapData.get(t.baseSymbol)?.marketCap;
    if (cap === undefined) return false;

    const capInMillions = cap / 1000000;

    switch (marketCapFilter) {
      case '0-20':
        return capInMillions <= 20;
      case '20-100':
        return capInMillions > 20 && capInMillions <= 100;
      case '100-1000':
        return capInMillions > 100 && capInMillions <= 1000;
      case '1000+':
        return capInMillions > 1000;
      default:
        return true;
    }
  });
}

/**
 * Apply listing age filter
 * Ages: '<30d', '<60d', '<90d', '<180d'
 * Skipped if listingData is not provided
 */
export function applyListAgeFilter(
  data: ProcessedTicker[],
  listAgeFilter: string | undefined,
  listingData?: Map<string, ListingData>
): ProcessedTicker[] {
  if (!listAgeFilter || !listingData) return data;

  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;

  return data.filter(t => {
    const listTime = listingData.get(t.instId)?.listTime;
    if (!listTime) return false;

    const age = now - listTime;

    switch (listAgeFilter) {
      case '<30d':
        return age <= 30 * oneDay;
      case '<60d':
        return age <= 60 * oneDay;
      case '<90d':
        return age <= 90 * oneDay;
      case '<180d':
        return age <= 180 * oneDay;
      default:
        return true;
    }
  });
}

/**
 * Apply meme token filter
 */
export function applyMemeFilter(
  data: ProcessedTicker[],
  isMemeFilter: string | undefined,
  marketCapData: Map<string, MarketCapData>
): ProcessedTicker[] {
  if (!isMemeFilter) return data;

  return data.filter(t => {
    const isMeme = MEME_TOKENS.has(t.baseSymbol);
    return isMemeFilter === 'yes' ? isMeme : !isMeme;
  });
}

/**
 * Apply spot trading availability filter
 */
export function applyHasSpotFilter(
  data: ProcessedTicker[],
  hasSpotFilter: string | undefined,
  spotSymbols: Set<string>,
  spotSymbolFormat: 'base-usdt' | 'base'
): ProcessedTicker[] {
  if (!hasSpotFilter) return data;

  return data.filter(t => {
    const spotKey = spotSymbolFormat === 'base-usdt' ? `${t.baseSymbol}-USDT` : t.baseSymbol;
    const hasSpot = spotSymbols.has(spotKey);
    return hasSpotFilter === 'yes' ? hasSpot : !hasSpot;
  });
}

/**
 * Apply RSI signal filter for daily RSI
 */
export function applyDRsiSignalFilter(
  data: ProcessedTicker[],
  dRsiSignal: RsiSignalType[] | undefined,
  rsiData: Map<string, RSIData>
): ProcessedTicker[] {
  if (!dRsiSignal || dRsiSignal.length === 0) return data;

  return data.filter(t => {
    const rsi = rsiData.get(t.instId);
    if (!rsi) return false;
    const signalInfo = getRsiSignal(rsi.rsi7, rsi.rsi14);
    return dRsiSignal.includes(signalInfo.signal);
  });
}

/**
 * Apply RSI signal filter for weekly RSI
 */
export function applyWRsiSignalFilter(
  data: ProcessedTicker[],
  wRsiSignal: RsiSignalType[] | undefined,
  rsiData: Map<string, RSIData>
): ProcessedTicker[] {
  if (!wRsiSignal || wRsiSignal.length === 0) return data;

  return data.filter(t => {
    const rsi = rsiData.get(t.instId);
    if (!rsi) return false;
    const signalInfo = getRsiSignal(rsi.rsiW7, rsi.rsiW14);
    return wRsiSignal.includes(signalInfo.signal);
  });
}

/**
 * Filter to only USDT pairs
 * For OKX: instId.includes('-USDT-')
 */
export function applyUsdtFilter(data: ProcessedTicker[]): ProcessedTicker[] {
  return data.filter(t => t.instId.includes('-USDT-'));
}

// ===========================================
// Sorting
// ===========================================

/**
 * Sort extractor functions - each returns a numeric value for comparison
 */
const SORT_EXTRACTORS: Record<string, (t: ProcessedTicker, ctx: SortExtractorContext) => number | string> = {
  symbol: (t) => t.instId,
  price: (t) => t.priceNum,
  change: (t) => t.changeNum,
  change4h: (t, ctx) => ctx.rsiData.get(t.instId)?.change4h ?? -9999,
  change7d: (t, ctx) => ctx.rsiData.get(t.instId)?.change7d ?? -9999,
  rank: (t, ctx) => ctx.marketCapData.get(t.baseSymbol)?.marketCap ?? 0,
  marketCap: (t, ctx) => ctx.marketCapData.get(t.baseSymbol)?.marketCap ?? 0,
  volume24h: (t) => (parseFloat(t.volCcy24h) || 0) * t.priceNum,
  rsi7: (t, ctx) => ctx.rsiData.get(t.instId)?.rsi7 ?? 0,
  rsi14: (t, ctx) => ctx.rsiData.get(t.instId)?.rsi14 ?? 0,
  rsiW7: (t, ctx) => ctx.rsiData.get(t.instId)?.rsiW7 ?? 0,
  rsiW14: (t, ctx) => ctx.rsiData.get(t.instId)?.rsiW14 ?? 0,
  adx: (t, ctx) => ctx.rsiData.get(t.instId)?.adx14 ?? 0,
  hasSpot: (t, ctx) => {
    const spotKey = ctx.spotSymbolFormat === 'base-usdt' ? `${t.baseSymbol}-USDT` : t.baseSymbol;
    return ctx.spotSymbols.has(spotKey) ? 1 : 0;
  },
  fundingRate: (t, ctx) => ctx.fundingRateData.get(t.instId)?.fundingRate ?? 0,
  fundingApr: (t, ctx) => {
    const fr = ctx.fundingRateData.get(t.instId);
    return fr ? fr.fundingRate * ((365 * 24) / (fr.settlementInterval || ctx.defaultSettlementInterval)) : 0;
  },
  fundingInterval: (t, ctx) => ctx.fundingRateData.get(t.instId)?.settlementInterval ?? ctx.defaultSettlementInterval,
  listDate: (t, ctx) => ctx.listingData?.get(t.instId)?.listTime ?? 0,
};

/**
 * Apply sorting to data
 */
export function applySorting(
  data: ProcessedTicker[],
  sort: SortConfig,
  ctx: SortExtractorContext
): ProcessedTicker[] {
  const sorted = [...data];

  sorted.sort((a, b) => {
    let aVal = SORT_EXTRACTORS[sort.column]?.(a, ctx);
    let bVal = SORT_EXTRACTORS[sort.column]?.(b, ctx);

    // Default to rank if column not found
    if (aVal === undefined) {
      aVal = ctx.marketCapData.get(a.baseSymbol)?.rank ?? 9999;
      bVal = ctx.marketCapData.get(b.baseSymbol)?.rank ?? 9999;
    }

    // Special case: rank has inverted sort logic
    if (sort.column === 'rank') {
      if (sort.direction === 'asc') {
        return (bVal as number) - (aVal as number);
      } else {
        return (aVal as number) - (bVal as number);
      }
    }

    // String comparison
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sort.direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }

    // Numeric comparison
    return sort.direction === 'asc'
      ? (aVal as number) - (bVal as number)
      : (bVal as number) - (aVal as number);
  });

  return sorted;
}

// ===========================================
// Combined Pipeline
// ===========================================

/**
 * Filter and sort tickers in a single pipeline
 */
export function filterAndSort(
  tickers: Map<string, ProcessedTicker>,
  searchTerm: string,
  view: 'market' | 'favorites',
  favorites: string[],
  filters: Filters,
  sort: SortConfig,
  ctx: FilterContext,
  isOkx?: boolean
): ProcessedTicker[] {
  let filtered = Array.from(tickers.values());

  // Filter to USDT pairs (OKX only)
  if (isOkx) {
    filtered = applyUsdtFilter(filtered);
  }

  // Search filter
  filtered = applySearchFilter(filtered, searchTerm);

  // Favorites view
  filtered = applyViewFilter(filtered, view, favorites);

  // Apply all filters
  filtered = applyRankFilter(filtered, filters.rank, ctx.marketCapData);
  filtered = applyRsiFilters(filtered, filters, ctx.rsiData);
  filtered = applyFundingFilter(filtered, filters.fundingRate, ctx.fundingRateData);
  filtered = applyMarketCapFilter(filtered, filters.marketCapMin, ctx.marketCapData);
  filtered = applyListAgeFilter(filtered, filters.listAge, ctx.listingData);
  filtered = applyMemeFilter(filtered, filters.isMeme, ctx.marketCapData);
  filtered = applyHasSpotFilter(filtered, filters.hasSpot, ctx.spotSymbols, ctx.spotSymbolFormat);
  filtered = applyDRsiSignalFilter(filtered, filters.dRsiSignal, ctx.rsiData);
  filtered = applyWRsiSignalFilter(filtered, filters.wRsiSignal, ctx.rsiData);

  // Sort
  filtered = applySorting(filtered, sort, ctx);

  return filtered;
}
