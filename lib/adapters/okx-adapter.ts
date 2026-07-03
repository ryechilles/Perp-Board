/**
 * OKX Exchange Adapter
 * Thin configuration layer that plugs into useExchangeStore
 */

import { ExchangeAdapter, TickerUpdateCallback, StatusUpdateCallback, RSIData, ProcessedTicker, DataManager } from '../types';
import { OKXHybridDataManager } from '../api/okx-data-manager';
import { fetchRSIForInstrument } from '../api/okx-rsi';
import { fetchRSIBatchGeneric } from '../api/rsi-batch';
import { fetchSpotSymbols, fetchListingDates, fetchFundingRates } from '../api/okx-rest';

export const okxAdapter: ExchangeAdapter = {
  exchange: 'okx',

  createDataManager(onUpdate: TickerUpdateCallback, onStatus: StatusUpdateCallback): DataManager {
    return new OKXHybridDataManager(onUpdate, onStatus);
  },

  async fetchRSIBatch(
    ids: string[],
    existing: Map<string, RSIData>,
    onProgress: (text: string) => void,
    onUpdate: (id: string, data: RSIData) => void,
    tier?: 'top50' | 'tier2' | 'tier3' | 'all',
    signal?: AbortSignal
  ): Promise<void> {
    return fetchRSIBatchGeneric(ids, existing, fetchRSIForInstrument, onProgress, onUpdate, tier, signal);
  },

  preFilterTickers(tickers: ProcessedTicker[]): ProcessedTicker[] {
    // OKX: keep only USDT perpetual swaps
    return tickers.filter(t => t.instId.includes('-USDT-'));
  },

  async fetchInitialData(allowedInstIds?: Set<string>) {
    // Each fetch REJECTS on failure (no empty fallbacks). allSettled keeps the
    // parts independent: one failing source must not discard the others.
    const [spot, listing, funding] = await Promise.allSettled([
      fetchSpotSymbols(),
      fetchListingDates(),
      fetchFundingRates(allowedInstIds),
    ]);
    if (spot.status === 'rejected') console.error('[OKX] Spot symbols failed:', spot.reason);
    if (listing.status === 'rejected') console.error('[OKX] Listing dates failed:', listing.reason);
    if (funding.status === 'rejected') console.error('[OKX] Funding rates failed:', funding.reason);
    return {
      spotSymbols: spot.status === 'fulfilled' ? spot.value : null,
      listingData: listing.status === 'fulfilled' ? listing.value : null,
      fundingRateData: funding.status === 'fulfilled' ? funding.value : null,
    };
  },

  spotSymbolFormat: 'base-usdt',
  defaultSettlementInterval: 8,

  features: {
    maFlow: true,
    listingDates: true,
    separateFundingFetch: true,
  },
};
