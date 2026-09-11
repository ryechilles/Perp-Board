/**
 * Widget Utilities
 * Shared utilities for widget components
 */

import { ProcessedTicker, RSIData, MarketCapData, TokenWithRsi } from './types';
import { RSI, FUNDING, WIDGET } from './constants';

// ===========================================
// TradingView Script Loader
// ===========================================

const TV_MINI_CHART_SRC = 'https://widgets.tradingview-widget.com/w/en/tv-mini-chart.js';

/**
 * Load TradingView mini-chart web component script exactly once.
 * Uses DOM query to detect if already loaded — safe across modules and Strict Mode.
 */
export function loadTradingViewMiniChart(): void {
  if (typeof document === 'undefined') return;
  if (document.querySelector(`script[src="${TV_MINI_CHART_SRC}"]`)) return;

  const script = document.createElement('script');
  script.type = 'module';
  script.src = TV_MINI_CHART_SRC;
  script.onerror = () => console.warn('Failed to load TradingView mini-chart script');
  document.head.appendChild(script);
}

// ===========================================
// Types
// ===========================================

// Time frame type for 1h/4h/24h selectors
export type TimeFrame = '1h' | '4h' | '24h';

// RSI data structure (minimal for calculation)
export interface RSIValues {
  rsi7: number | null;
  rsi14: number | null;
  rsiW7: number | null;
  rsiW14: number | null;
}

// Token with change data for altcoin widgets
export interface TokenWithChange {
  symbol: string;
  instId: string;
  rank: number;
  price?: number;
  change1h: number | null;
  change4h: number | null;
  change24h: number;
  logo?: string;
}

// ===========================================
// Formatting Functions
// ===========================================

// Format percentage with color class
export function formatChange(value: number | null | undefined): { text: string; color: string } {
  if (value === null || value === undefined) {
    return { text: '--', color: 'text-muted-foreground' };
  }
  const sign = value > 0 ? '+' : '';
  const color = value > 0 ? 'text-up-ink' : value < 0 ? 'text-down-ink' : 'text-muted-foreground';
  return { text: `${sign}${value.toFixed(2)}%`, color };
}

// Get change value based on timeframe
export function getChangeByTimeFrame(token: TokenWithChange, tf: TimeFrame): number | null {
  switch (tf) {
    case '1h': return token.change1h;
    case '4h': return token.change4h;
    case '24h': return token.change24h;
  }
}

// ===========================================
// Calculation Functions
// ===========================================

/**
 * Calculate average RSI from all 4 RSI values
 * Used in RsiOversold and RsiOverbought widgets
 */
export function calculateAvgRsi(rsi: RSIValues): number | null {
  const values = [rsi.rsi7, rsi.rsi14, rsi.rsiW7, rsi.rsiW14].filter(
    (v): v is number => v !== null && v !== undefined
  );
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Calculate funding APR from rate and interval
 * Uses FUNDING.DEFAULT_INTERVAL_HOURS as default
 */
export function calculateFundingApr(
  rate: number,
  intervalHours: number = FUNDING.DEFAULT_INTERVAL_HOURS
): number {
  const periodsPerYear = (365 * 24) / intervalHours;
  return rate * periodsPerYear * 100;
}

// ===========================================
// Token Filtering Functions (shared logic for widgets)
// ===========================================

/**
 * Get tokens filtered by RSI threshold
 * Used by RsiOversold and RsiOverbought widgets
 *
 * @param tickers - All tickers
 * @param rsiData - RSI data map
 * @param marketCapData - Market cap data map
 * @param mode - 'oversold' (avgRsi < threshold) or 'overbought' (avgRsi > threshold)
 * @param topN - Number of top tokens by market cap to consider (default: WIDGET.TOP_TOKENS_COUNT)
 * @param displayLimit - Number of results to return (default: WIDGET.DISPLAY_LIMIT)
 */
export function getTokensByRsiThreshold(
  tickers: Map<string, ProcessedTicker>,
  rsiData: Map<string, RSIData>,
  marketCapData: Map<string, MarketCapData>,
  mode: 'oversold' | 'overbought',
  topN: number = WIDGET.TOP_TOKENS_COUNT,
  displayLimit: number = WIDGET.DISPLAY_LIMIT
): TokenWithRsi[] {
  const allTokens: TokenWithRsi[] = [];

  // Collect all tokens with market cap and RSI data
  tickers.forEach((ticker) => {
    // Exclude specific symbols (e.g., BTC)
    if ((WIDGET.EXCLUDE_SYMBOLS as readonly string[]).includes(ticker.baseSymbol)) return;

    const mc = marketCapData.get(ticker.baseSymbol);
    const rsi = rsiData.get(ticker.instId);

    if (!mc || !mc.marketCap || !rsi) return;

    const avgRsi = calculateAvgRsi(rsi);
    if (avgRsi === null) return;

    allTokens.push({
      symbol: ticker.baseSymbol,
      instId: ticker.instId,
      marketCap: mc.marketCap,
      price: ticker.priceNum,
      avgRsi,
      logo: mc.logo,
    });
  });

  // Sort by market cap and take top N
  const topTokens = allTokens
    .sort((a, b) => b.marketCap - a.marketCap)
    .slice(0, topN);

  // Filter by RSI threshold and sort
  const threshold = mode === 'oversold' ? RSI.OVERSOLD : RSI.OVERBOUGHT;

  return topTokens
    .filter(t => mode === 'oversold' ? t.avgRsi <= threshold : t.avgRsi >= threshold)
    .sort((a, b) => mode === 'oversold' ? a.avgRsi - b.avgRsi : b.avgRsi - a.avgRsi)
    .slice(0, displayLimit);
}
