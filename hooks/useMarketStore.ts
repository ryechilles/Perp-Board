'use client';

import { useExchangeStore } from './useExchangeStore';
import { okxAdapter } from '@/lib/adapters/okx-adapter';

/**
 * OKX Market Store
 * Thin wrapper around the unified useExchangeStore with OKX adapter
 */
export function useMarketStore() {
  return useExchangeStore(okxAdapter);
}
