/**
 * Column Definitions and Tooltips
 * Centralized column configuration for the data table
 */

import { ColumnKey } from './types';
import { FUNDING } from './constants';

// Column tooltip content
export const COLUMN_TOOLTIPS: Partial<Record<ColumnKey, string[]>> = {
  dRsiSignal: [
    'Daily RSI = (D-RSI7 + D-RSI14) / 2',
    '≤20: Extreme Oversold',
    '≤25: Oversold',
    '≤30: Very Weak',
    '≤40: Weak',
    '≤60: Neutral',
    '≤70: Strong',
    '≤80: Very Strong',
    '≤85: Overbought',
    '>85: Extreme Overbought',
  ],
  wRsiSignal: [
    'Weekly RSI = (W-RSI7 + W-RSI14) / 2',
    '≤20: Extreme Oversold',
    '≤25: Oversold',
    '≤30: Very Weak',
    '≤40: Weak',
    '≤60: Neutral',
    '≤70: Strong',
    '≤80: Very Strong',
    '≤85: Overbought',
    '>85: Extreme Overbought',
  ],
  tdSeq: [
    'TD Sequential (daily candles)',
    'B 9 / S 9: Setup complete (9 closes below/above close 4 bars ago)',
    'B 13 / S 13: Countdown complete — stronger reversal signal',
    'Gray B/S 4-8: Setup in progress (shown from 4)',
    'Gray B/S ·1-12: Countdown in progress',
    'Today\'s candle is unclosed — counts may change intraday',
  ],
};

// Column definitions — numbers right-aligned (tabular), token left-aligned,
// short signal badges centered.
export const COLUMN_DEFINITIONS: Record<ColumnKey, { label: string; width: number; align: 'left' | 'right' | 'center'; fixed?: boolean; sortable?: boolean }> = {
  favorite: { label: '', width: 36, align: 'center', fixed: true, sortable: false },
  rank: { label: '#', width: 38, align: 'center', fixed: true, sortable: true },
  logo: { label: '', width: 42, align: 'center', fixed: true, sortable: false },
  symbol: { label: 'Token', width: 70, align: 'left', fixed: true, sortable: true },
  price: { label: 'Price', width: 96, align: 'right', sortable: true },
  fundingRate: { label: 'Funding rate', width: 96, align: 'right', sortable: true },
  fundingApr: { label: 'Funding APR', width: 104, align: 'right', sortable: true },
  fundingInterval: { label: 'Interval', width: 72, align: 'right', sortable: true },
  change4h: { label: '4h', width: 88, align: 'right', sortable: true },
  change: { label: '24h', width: 88, align: 'right', sortable: true },
  change7d: { label: '7 days', width: 136, align: 'right', sortable: true },
  volume24h: { label: 'Volume 24h', width: 92, align: 'right', sortable: true },
  marketCap: { label: 'Market cap', width: 96, align: 'right', sortable: true },
  dRsiSignal: { label: 'Daily RSI', width: 104, align: 'right', sortable: true },
  tdSeq: { label: 'TD', width: 64, align: 'center', sortable: true },
  wRsiSignal: { label: 'Weekly RSI', width: 104, align: 'right', sortable: true },
  rsi7: { label: 'D-RSI7', width: 72, align: 'right', sortable: true },
  rsi14: { label: 'D-RSI14', width: 76, align: 'right', sortable: true },
  rsiW7: { label: 'W-RSI7', width: 72, align: 'right', sortable: true },
  rsiW14: { label: 'W-RSI14', width: 76, align: 'right', sortable: true },
  listDate: { label: 'Listed', width: 80, align: 'right', sortable: true }
};

// Format funding APR (annualized)
export function formatFundingApr(rate: number | undefined | null, intervalHours: number | undefined | null): string {
  if (rate === undefined || rate === null) return '--';
  const interval = intervalHours || FUNDING.DEFAULT_INTERVAL_HOURS;
  const periodsPerYear = (365 * 24) / interval;
  const apr = rate * periodsPerYear * 100;
  const sign = apr >= 0 ? '+' : '';
  return `${sign}${apr.toFixed(1)}%`;
}

// Get funding APR color class
export function getFundingAprClass(rate: number | undefined | null): string {
  if (rate === undefined || rate === null) return 'text-faint';
  if (rate > 0) return 'text-up-ink';
  if (rate < 0) return 'text-down-ink';
  return 'text-muted-foreground';
}

// Format funding rate as percentage
export function formatFundingRate(rate: number | undefined | null): string {
  if (rate === undefined || rate === null) return '--';
  const percentage = rate * 100;
  const sign = percentage >= 0 ? '+' : '';
  return `${sign}${percentage.toFixed(4)}%`;
}

// Format settlement interval
export function formatSettlementInterval(hours: number | undefined | null): string {
  if (hours === undefined || hours === null || hours === 0) return '--';
  return `${hours}h`;
}

// Get funding rate color class
export function getFundingRateClass(rate: number | undefined | null): string {
  if (rate === undefined || rate === null) return 'text-faint';
  if (rate > FUNDING.POSITIVE_THRESHOLD) return 'text-up-ink';
  if (rate < FUNDING.NEGATIVE_THRESHOLD) return 'text-down-ink';
  return 'text-muted-foreground';
}

// Format listing date
export function formatListDate(timestamp: number | undefined | null): string {
  if (!timestamp) return '--';
  const date = new Date(timestamp);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - timestamp) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
}
