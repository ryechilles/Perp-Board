/**
 * Default configurations for the application
 * Shared across components to avoid duplication
 */

import { ColumnVisibility, ColumnKey } from './types';

// Default columns (unified for all devices)
export const DEFAULT_COLUMNS: ColumnVisibility = {
  favorite: true,
  rank: true,
  logo: true,
  symbol: true,
  price: true,
  fundingRate: false,
  fundingApr: true,
  fundingInterval: false,
  change4h: false,
  change: true,
  change7d: true,
  volume24h: false,
  marketCap: true,
  dRsiSignal: true,
  wRsiSignal: true,
  rsi7: false,
  rsi14: false,
  rsiW7: false,
  rsiW14: false,
  listDate: false,
  hasSpot: false
};

// Get default columns (kept for backward compatibility, isMobile param ignored)
export function getDefaultColumns(_isMobile?: boolean): ColumnVisibility {
  return DEFAULT_COLUMNS;
}

// Default column order
export const DEFAULT_COLUMN_ORDER: ColumnKey[] = [
  'favorite',
  'rank',
  'logo',
  'symbol',
  'price',
  'fundingRate',
  'fundingApr',
  'fundingInterval',
  'change4h',
  'change',
  'change7d',
  'volume24h',
  'marketCap',
  'dRsiSignal',
  'wRsiSignal',
  'rsi7',
  'rsi14',
  'rsiW7',
  'rsiW14',
  'listDate'
];
