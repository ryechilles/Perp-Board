/**
 * Presentation-neutral formatting: number parts and semantic tones.
 *
 * lib/ never returns class names. It returns WHAT a value means (a Tone, the
 * parts of a price); components/data decides how that looks. See DESIGN.md.
 */

import { FUNDING, RSI } from './constants';

/** Semantic colour of a value. 'neutral' = no colour. */
export type Tone = 'neutral' | 'up' | 'down' | 'cold' | 'hot';

// ===========================================
// Tones
// ===========================================

/** Price direction. Exactly zero is neutral. */
export function deltaTone(value: number | null | undefined): Tone {
  if (value == null || value === 0) return 'neutral';
  return value > 0 ? 'up' : 'down';
}

/** RSI is coloured only at the extremes; the wide middle stays neutral. */
export function rsiTone(value: number | null | undefined): Tone {
  if (value == null) return 'neutral';
  if (value <= RSI.TONE_COLD) return 'cold';
  if (value >= RSI.TONE_HOT) return 'hot';
  return 'neutral';
}

/** Funding is coloured only once the annualized rate is large enough to matter. */
export function fundingTone(apr: number | null | undefined): Tone {
  if (apr == null || Math.abs(apr) < FUNDING.HIGHLIGHT_APR) return 'neutral';
  return apr > 0 ? 'up' : 'down';
}

/** Annualized funding in percent. */
export function fundingApr(rate: number, intervalHours?: number | null): number {
  const interval = intervalHours || FUNDING.DEFAULT_INTERVAL_HOURS;
  return rate * ((365 * 24) / interval) * 100;
}

// ===========================================
// Number parts
// ===========================================

export function signOf(value: number): '+' | '−' | '' {
  return value > 0 ? '+' : value < 0 ? '−' : '';
}

export interface PriceParts {
  /** Integer part with thousands separators: "69,113" */
  int: string;
  /** Fraction digits without the dot: "30". Empty when there is none. */
  frac: string;
  /**
   * Set for very small prices: the count of zeros after the decimal point that
   * `frac` omits. 0.0000043 → { int: '0', zeros: 5, frac: '43' }, shown 0.0₅43.
   */
  zeros?: number;
}

/** Prices below this are written with the subscript-zero notation. */
const SUBSCRIPT_BELOW = 0.0001;

/**
 * Split a price for decimal-aligned display. Precision follows the magnitude:
 * 2 decimals from 100 up, 4 from 1, 6 below 1, and 3 significant digits in
 * subscript notation below 0.0001.
 */
export function priceParts(price: number): PriceParts {
  if (!Number.isFinite(price) || price <= 0) return { int: '0', frac: '' };

  if (price < SUBSCRIPT_BELOW) {
    const [mantissa, exp] = price.toExponential(2).split('e');
    const digits = mantissa.replace('.', '').replace(/0+$/, '') || '0';
    return { int: '0', zeros: -Number(exp) - 1, frac: digits };
  }

  let text: string;
  if (price >= 1000) text = price.toFixed(2);
  else if (price >= 100) text = parseFloat(price.toFixed(2)).toString();
  else if (price >= 1) text = parseFloat(price.toFixed(4)).toString();
  else text = parseFloat(price.toFixed(6)).toString();

  const [int, frac = ''] = text.split('.');
  return { int: Number(int).toLocaleString('en-US'), frac };
}

export interface MoneyParts {
  /** "239.85" */
  value: string;
  /** "T" | "B" | "M" | "K" | "" */
  unit: string;
}

/** Compact dollar amount: 1.38T, 239.85B, 6.1M. `null` when there is nothing to show. */
export function moneyParts(amount: number | null | undefined, decimals = 2): MoneyParts | null {
  if (amount == null || !Number.isFinite(amount) || amount === 0) return null;
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '−' : '';
  if (abs >= 1e12) return { value: sign + (abs / 1e12).toFixed(decimals), unit: 'T' };
  if (abs >= 1e9) return { value: sign + (abs / 1e9).toFixed(decimals), unit: 'B' };
  if (abs >= 1e6) return { value: sign + (abs / 1e6).toFixed(decimals), unit: 'M' };
  if (abs >= 1e3) return { value: sign + (abs / 1e3).toFixed(decimals), unit: 'K' };
  return { value: sign + abs.toFixed(decimals), unit: '' };
}
