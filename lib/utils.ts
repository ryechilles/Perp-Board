/**
 * Core Utilities
 * General-purpose helpers: styling, formatting, data processing, RSI
 *
 * Column/funding-related definitions → see lib/columns.ts
 * Mutex/RateLimiter → see lib/concurrency.ts
 */

import { OKXTicker, ProcessedTicker, RsiSignalType } from './types';
import { MEME_TOKENS as MEME_TOKENS_SET, RSI, ADX, UI } from './constants';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// ===========================================
// Re-exports for backward compatibility
// ===========================================

// Concurrency (consumers should migrate to '@/lib/concurrency')
export { Mutex, RateLimiter, withRetry } from './concurrency';

// Columns & funding formatters (consumers should migrate to '@/lib/columns')
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

// Defaults
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
}

export function getRsiSignal(rsi7: number | null, rsi14: number | null): RsiSignalInfo {
  if (rsi7 === null && rsi14 === null) {
    return { signal: 'neutral', label: '--', pillStyle: 'bg-muted text-muted-foreground' };
  }

  const avg = rsi7 !== null && rsi14 !== null
    ? (rsi7 + rsi14) / 2
    : rsi7 ?? rsi14 ?? 50;

  if (avg <= RSI.EXTREME_OVERSOLD) return { signal: 'extreme-oversold', label: 'Extreme Oversold', pillStyle: 'bg-green-500 text-white' };
  if (avg <= RSI.OVERSOLD) return { signal: 'oversold', label: 'Oversold', pillStyle: 'bg-green-400 text-white' };
  if (avg <= RSI.VERY_WEAK) return { signal: 'very-weak', label: 'Very Weak', pillStyle: 'bg-green-300 text-green-800' };
  if (avg <= RSI.WEAK) return { signal: 'weak', label: 'Weak', pillStyle: 'bg-emerald-100 text-emerald-700' };
  if (avg <= RSI.NEUTRAL_HIGH) return { signal: 'neutral', label: 'Neutral', pillStyle: 'bg-muted text-muted-foreground' };
  if (avg <= RSI.STRONG) return { signal: 'strong', label: 'Strong', pillStyle: 'bg-orange-100 text-orange-700' };
  if (avg <= RSI.VERY_STRONG) return { signal: 'very-strong', label: 'Very Strong', pillStyle: 'bg-red-300 text-red-800' };
  if (avg <= RSI.OVERBOUGHT) return { signal: 'overbought', label: 'Overbought', pillStyle: 'bg-red-400 text-white' };
  return { signal: 'extreme-overbought', label: 'Extreme Overbought', pillStyle: 'bg-red-500 text-white' };
}

// ===========================================
// ADX Calculation & Signals (5-level trend strength)
// ===========================================

/**
 * Calculate ADX (Average Directional Index) from OHLC candle data.
 * Expects candles in chronological order (oldest first).
 * Each candle: [timestamp, open, high, low, close, ...]
 */
export function calculateADX(candles: number[][], period: number = 14): number | null {
  // Need at least 2*period + 1 candles for a reliable ADX
  if (candles.length < period * 2 + 1) return null;

  const highs = candles.map(c => c[2]);
  const lows = candles.map(c => c[3]);
  const closes = candles.map(c => c[4]);

  // Step 1: Calculate True Range, +DM, -DM for each bar
  const trList: number[] = [];
  const plusDMList: number[] = [];
  const minusDMList: number[] = [];

  for (let i = 1; i < candles.length; i++) {
    const highDiff = highs[i] - highs[i - 1];
    const lowDiff = lows[i - 1] - lows[i];

    const plusDM = highDiff > lowDiff && highDiff > 0 ? highDiff : 0;
    const minusDM = lowDiff > highDiff && lowDiff > 0 ? lowDiff : 0;

    const tr = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    );

    trList.push(tr);
    plusDMList.push(plusDM);
    minusDMList.push(minusDM);
  }

  if (trList.length < period * 2) return null;

  // Step 2: Wilder's smoothing for first period values
  let smoothTR = 0;
  let smoothPlusDM = 0;
  let smoothMinusDM = 0;

  for (let i = 0; i < period; i++) {
    smoothTR += trList[i];
    smoothPlusDM += plusDMList[i];
    smoothMinusDM += minusDMList[i];
  }

  // Step 3: Calculate DX values using Wilder's smoothing
  const dxValues: number[] = [];

  for (let i = period; i < trList.length; i++) {
    if (i === period) {
      // First smoothed values already computed above
    } else {
      smoothTR = smoothTR - (smoothTR / period) + trList[i];
      smoothPlusDM = smoothPlusDM - (smoothPlusDM / period) + plusDMList[i];
      smoothMinusDM = smoothMinusDM - (smoothMinusDM / period) + minusDMList[i];
    }

    if (smoothTR === 0) continue;

    const plusDI = (smoothPlusDM / smoothTR) * 100;
    const minusDI = (smoothMinusDM / smoothTR) * 100;
    const diSum = plusDI + minusDI;

    if (diSum === 0) {
      dxValues.push(0);
    } else {
      dxValues.push((Math.abs(plusDI - minusDI) / diSum) * 100);
    }
  }

  if (dxValues.length < period) return null;

  // Step 4: Smooth DX to get ADX (Wilder's smoothing)
  let adx = 0;
  for (let i = 0; i < period; i++) {
    adx += dxValues[i];
  }
  adx /= period;

  for (let i = period; i < dxValues.length; i++) {
    adx = ((adx * (period - 1)) + dxValues[i]) / period;
  }

  return adx;
}

/**
 * ADX signal types (5-level system)
 */
export type AdxSignalType = 'no-trend' | 'forming' | 'trending' | 'strong' | 'extreme';

export interface AdxSignalInfo {
  signal: AdxSignalType;
  label: string;
  pillStyle: string;
}

/**
 * Get ADX signal based on ADX value (5 levels)
 */
export function getAdxSignal(adx: number | null | undefined): AdxSignalInfo {
  if (adx === null || adx === undefined) {
    return { signal: 'no-trend', label: '--', pillStyle: 'bg-muted text-muted-foreground' };
  }

  if (adx < ADX.NO_TREND) return { signal: 'no-trend', label: 'No Trend', pillStyle: 'bg-muted text-muted-foreground' };
  if (adx < ADX.FORMING) return { signal: 'forming', label: 'Forming', pillStyle: 'bg-sky-100 text-sky-700' };
  if (adx < ADX.TRENDING) return { signal: 'trending', label: 'Trending', pillStyle: 'bg-blue-400 text-white' };
  if (adx < ADX.STRONG) return { signal: 'strong', label: 'Strong', pillStyle: 'bg-violet-500 text-white' };
  return { signal: 'extreme', label: 'Extreme', pillStyle: 'bg-fuchsia-600 text-white' };
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

export function getRsiOversoldPillStyle(rsi: number | null | undefined): string {
  if (rsi === null || rsi === undefined) return 'bg-muted text-muted-foreground';
  if (rsi <= 20) return 'bg-green-500 text-white';
  if (rsi <= 25) return 'bg-green-400 text-white';
  return 'bg-green-300 text-green-800';
}

export function getRsiOverboughtPillStyle(rsi: number | null | undefined): string {
  if (rsi === null || rsi === undefined) return 'bg-muted text-muted-foreground';
  if (rsi >= 85) return 'bg-red-600 text-white';
  if (rsi >= 80) return 'bg-red-500 text-white';
  return 'bg-red-400 text-white';
}

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
