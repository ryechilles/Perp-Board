'use client';

/**
 * Row-level selector hooks.
 *
 * Each hook subscribes a component to a SINGLE instrument's slice of the
 * MarketStore via useSyncExternalStore, so a table row re-renders only when
 * its own data changes — not when any other row updates.
 */

import { useCallback, useSyncExternalStore } from 'react';
import { MarketStore } from '@/lib/store/marketStore';
import {
  ProcessedTicker,
  RSIData,
  FundingRateData,
  ListingData,
  MarketCapData,
} from '@/lib/types';

export function useTicker(store: MarketStore, instId: string): ProcessedTicker | undefined {
  const subscribe = useCallback((cb: () => void) => store.subscribeInst(instId, cb), [store, instId]);
  const get = useCallback(() => store.getTicker(instId), [store, instId]);
  return useSyncExternalStore(subscribe, get, get);
}

export function useRsi(store: MarketStore, instId: string): RSIData | undefined {
  const subscribe = useCallback((cb: () => void) => store.subscribeInst(instId, cb), [store, instId]);
  const get = useCallback(() => store.getRsi(instId), [store, instId]);
  return useSyncExternalStore(subscribe, get, get);
}

export function useFunding(store: MarketStore, instId: string): FundingRateData | undefined {
  const subscribe = useCallback((cb: () => void) => store.subscribeInst(instId, cb), [store, instId]);
  const get = useCallback(() => store.getFunding(instId), [store, instId]);
  return useSyncExternalStore(subscribe, get, get);
}

export function useListing(store: MarketStore, instId: string): ListingData | undefined {
  const subscribe = useCallback((cb: () => void) => store.subscribeInst(instId, cb), [store, instId]);
  const get = useCallback(() => store.getListing(instId), [store, instId]);
  return useSyncExternalStore(subscribe, get, get);
}

export function useMarketCap(store: MarketStore, baseSymbol: string): MarketCapData | undefined {
  const subscribe = useCallback((cb: () => void) => store.subscribeBase(baseSymbol, cb), [store, baseSymbol]);
  const get = useCallback(() => store.getMarketCap(baseSymbol), [store, baseSymbol]);
  return useSyncExternalStore(subscribe, get, get);
}

export function useHasSpot(
  store: MarketStore,
  baseSymbol: string,
  exchange: 'okx' | 'hyperliquid'
): boolean {
  const spotKey = exchange === 'okx' ? `${baseSymbol}-USDT` : baseSymbol;
  const subscribe = useCallback((cb: () => void) => store.subscribeSpot(cb), [store]);
  const get = useCallback(() => store.hasSpot(spotKey), [store, spotKey]);
  return useSyncExternalStore(subscribe, get, get);
}
