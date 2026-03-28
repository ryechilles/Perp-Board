/**
 * OKX Exchange Adapter
 * Thin configuration layer that plugs into useExchangeStore
 */

import { ExchangeAdapter, TickerUpdateCallback, StatusUpdateCallback, RSIData, DataManager } from '../types';
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

  async fetchInitialData() {
    const [spotSymbols, listingData, fundingRateData] = await Promise.all([
      fetchSpotSymbols(),
      fetchListingDates(),
      fetchFundingRates(),
    ]);
    return { spotSymbols, listingData, fundingRateData };
  },

  spotSymbolFormat: 'base-usdt',
  defaultSettlementInterval: 8,

  features: {
    maFlow: true,
    listingDates: true,
    separateFundingFetch: true,
  },
};
