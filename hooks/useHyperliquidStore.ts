'use client';

import { useExchangeStore } from './useExchangeStore';
import { hyperliquidAdapter } from '@/lib/adapters/hyperliquid-adapter';

/**
 * Hyperliquid Market Store
 * Thin wrapper around the unified useExchangeStore with Hyperliquid adapter
 */
export function useHyperliquidStore() {
  return useExchangeStore(hyperliquidAdapter);
}
