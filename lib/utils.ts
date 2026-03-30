/**
 * Core Utilities
 * General-purpose helpers: styling, formatting, data processing, RSI
 *
 * Column/funding-related definitions → see lib/columns.ts
 * Mutex/RateLimiter → see lib/concurrency.ts
 */

import { OKXTicker, ProcessedTicker, RsiSignalType } from './types';
import { MEME_TOKENS as MEME_TOKENS_SET, RSI, UI } from './constants';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// ===========================================
// Re-exports for backward compatibility
// TODO: Migrate consumers to import directly from '@/lib/concurrency', '@/lib/columns', '@/lib/defaults'
// ===========================================

export { Mutex, RateLimiter, withRetry } from './concurrency';

export {
  COLUMN_DEFINITIONS,
  COLUMN_TOOLTIPS,
  formatFundingApr,
  getFundingAprClass,
  formatFundingRate,
  formatSettlementInterval,
  getFundingRateClass,
  formatListDate,
} from './columns';

export { DEFAULT_COLUMN_ORDER, DEFAULT_COLUMNS, getDefaultColumns } from './defaults';

// ===========================================
// Tailwind Utilities
// ===========================================

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ===========================================
// Meme Tokens
// ===========================================

export const MEME_TOKENS = MEME_TOKENS_SET;

export function isMemeToken(symbol: string): boolean {
  const upperSymbol = symbol.toUpperCase();
  if (MEME_TOKENS.has(upperSymbol)) return true;
  const match = upperSymbol.match(/^(\d+)(.+)$/);
  if (match) {
    return MEME_TOKENS.has(match[2]) || MEME_TOKENS.has(upperSymbol);
  }
  return false;
}

// ===========================================
// Device Detection
// ===========================================

export function isMobile(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < UI.MOBILE_BREAKPOINT;
}

// ===========================================
// Price / Market Cap / Volume Formatting
// ===========================================

export function formatPrice(price: number): string {
  if (price >= 1000) {
    return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  } else if (price >= 100) {
    return parseFloat(price.toFixed(2)).toString();
  } else if (price >= 1) {
    return parseFloat(price.toFixed(4)).toString();
  } else if (price >= 0.0001) {
    return parseFloat(price.toFixed(6)).toString();
  }
  return parseFloat(price.toFixed(8)).toString();
}

export function formatMarketCap(cap: number): string {
  if (cap >= 1e12) return '$' + (cap / 1e12).toFixed(2) + 'T';
  if (cap >= 1e9) return '$' + (cap / 1e9).toFixed(2) + 'B';
  if (cap >= 1e6) return '$' + (cap / 1e6).toFixed(2) + 'M';
  if (cap >= 1e3) return '$' + (cap / 1e3).toFixed(2) + 'K';
  return '$' + cap.toFixed(2);
}

export function formatVolume(volCcy: string | number, price: number): string {
  const vol = typeof volCcy === 'string' ? parseFloat(volCcy) : volCcy;
  if (isNaN(vol) || vol === 0 || isNaN(price) || price === 0) return '--';
  const volumeUsd = vol * price;
  if (volumeUsd >= 1e9) return '$' + (volumeUsd / 1e9).toFixed(2) + 'B';
  if (volumeUsd >= 1e6) return '$' + (volumeUsd / 1e6).toFixed(1) + 'M';
  if (volumeUsd >= 1e3) return '$' + (volumeUsd / 1e3).toFixed(0) + 'K';
  return '$' + volumeUsd.toFixed(0);
}

// ===========================================
// Ticker Processing
// ===========================================

export function processTicker(t: OKXTicker): ProcessedTicker {
  const parts = t.instId.split('-');
  const baseSymbol = parts[0];
  const priceNum = parseFloat(t.last) || 0;
  const sodUtc8 = parseFloat(t.sodUtc8) || 0;
  const changeNum = sodUtc8 > 0 ? ((priceNum - sodUtc8) / sodUtc8 * 100) : 0;

  return {
    instId: t.instId,
    baseSymbol,
    priceNum,
    changeNum,
    volCcy24h: t.volCcy24h || '0',
    rawData: t
  };
}

// ===========================================
// RSI Calculation & Signals
// ===========================================

export function calculateRSI(closes: number[], period: number): number | null {
  if (closes.length < period + 1) return null;

  const changes: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    changes.push(closes[i] - closes[i - 1]);
  }
  if (changes.length < period) return null;

  const gains = changes.map(c => c > 0 ? c : 0);
  const losses = changes.map(c => c < 0 ? Math.abs(c) : 0);

  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 0; i < period; i++) {
    avgGain += gains[i];
    avgLoss += losses[i];
  }
  avgGain /= period;
  avgLoss /= period;

  for (let i = period; i < changes.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
  }

  if (avgLoss === 0) return avgGain === 0 ? 50 : 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

export type RsiSignal = RsiSignalType;

export interface RsiSignalInfo {
  signal: RsiSignalType;
  label: string;
  pillStyle: string;
  level: number;
}

export function getRsiSignal(rsi7: number | null, rsi14: number | null): RsiSignalInfo {
  if (rsi7 === null && rsi14 === null) {
    return { signal: 'neutral', label: '--', pillStyle: 'bg-muted text-muted-foreground', level: 5 };
  }

  const avg = rsi7 !== null && rsi14 !== null
    ? (rsi7 + rsi14) / 2
    : rsi7 ?? rsi14 ?? 50;

  if (avg <= RSI.EXTREME_OVERSOLD) return { signal: 'extreme-oversold', label: 'Extreme Oversold', pillStyle: 'bg-green-500 text-white', level: 1 };
  if (avg <= RSI.OVERSOLD) return { signal: 'oversold', label: 'Oversold', pillStyle: 'bg-green-400 text-white', level: 2 };
  if (avg <= RSI.VERY_WEAK) return { signal: 'very-weak', label: 'Very Weak', pillStyle: 'bg-green-300 text-green-800', level: 3 };
  if (avg <= RSI.WEAK) return { signal: 'weak', label: 'Weak', pillStyle: 'bg-emerald-100 text-emerald-700', level: 4 };
  if (avg <= RSI.NEUTRAL_HIGH) return { signal: 'neutral', label: 'Neutral', pillStyle: 'bg-muted text-muted-foreground', level: 5 };
  if (avg <= RSI.STRONG) return { signal: 'strong', label: 'Strong', pillStyle: 'bg-orange-100 text-orange-700', level: 6 };
  if (avg <= RSI.VERY_STRONG) return { signal: 'very-strong', label: 'Very Strong', pillStyle: 'bg-red-300 text-red-800', level: 7 };
  if (avg <= RSI.OVERBOUGHT) return { signal: 'overbought', label: 'Overbought', pillStyle: 'bg-red-400 text-white', level: 8 };
  return { signal: 'extreme-overbought', label: 'Extreme Overbought', pillStyle: 'bg-red-500 text-white', level: 9 };
}

export function calculate7DChange(candles: number[][]): number | null {
  if (candles.length < 7) return null;
  const currentClose = candles[candles.length - 1][4];
  const close7dAgo = candles[candles.length - 7][4];
  if (close7dAgo === 0) return null;
  return ((currentClose - close7dAgo) / close7dAgo) * 100;
}

// ===========================================
// RSI Pill Styles
// ===========================================

export function getRsiPillStyle(rsi: number | null | undefined): string {
  if (rsi === null || rsi === undefined) return 'bg-muted text-muted-foreground';
  if (rsi <= 20) return 'bg-green-500 text-white';
  if (rsi <= 25) return 'bg-green-400 text-white';
  if (rsi <= 30) return 'bg-green-300 text-green-800';
  if (rsi <= 40) return 'bg-emerald-100 text-emerald-700';
  if (rsi <= 60) return 'bg-muted text-muted-foreground';
  if (rsi <= 70) return 'bg-orange-100 text-orange-700';
  if (rsi <= 80) return 'bg-red-300 text-red-800';
  if (rsi <= 85) return 'bg-red-400 text-white';
  return 'bg-red-500 text-white';
}

