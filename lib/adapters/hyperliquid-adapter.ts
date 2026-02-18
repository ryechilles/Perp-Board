/**
 * Hyperliquid Exchange Adapter
 * Thin configuration layer that plugs into useExchangeStore
 */

import {
  ExchangeAdapter,
  TickerUpdateCallback,
  StatusUpdateCallback,
  RSIData,
  FundingRateData,
  ProcessedTicker,
  HyperliquidRawTicker,
  DataManager,
} from '../types';
import { HyperliquidDataManager } from '../api/hyperliquid-data-manager';
import { fetchHyperliquidRSIForInstrument } from '../api/hyperliquid-rsi';
import { fetchHyperliquidSpotSymbols } from '../api/hyperliquid-rest';
import { fetchRSIBatchGeneric } from '../api/rsi-batch';

export const hyperliquidAdapter: ExchangeAdapter = {
  exchange: 'hyperliquid',

  createDataManager(onUpdate: TickerUpdateCallback, onStatus: StatusUpdateCallback): DataManager {
    return new HyperliquidDataManager(onUpdate, onStatus);
  },

  async fetchRSIBatch(
    ids: string[],
    existing: Map<string, RSIData>,
    onProgress: (text: string) => void,
    onUpdate: (id: string, data: RSIData) => void,
    tier?: 'top50' | 'tier2' | 'tier3' | 'all'
  ): Promise<void> {
    return fetchRSIBatchGeneric(ids, existing, fetchHyperliquidRSIForInstrument, onProgress, onUpdate, tier);
  },

  async fetchInitialData() {
    const spotSymbols = await fetchHyperliquidSpotSymbols().catch((error: unknown) => {
      console.error('[Hyperliquid] Failed to fetch spot symbols:', error);
      return new Set<string>();
    });
    return { spotSymbols };
  },

  extractFundingFromTickers(tickers: Map<string, ProcessedTicker>): Map<string, FundingRateData> {
    const fundingRates = new Map<string, FundingRateData>();

    tickers.forEach((ticker, instId) => {
      if (ticker.rawData) {
        const hlData = ticker.rawData as HyperliquidRawTicker;
        if (hlData.funding !== undefined) {
          const fundingRate = parseFloat(hlData.funding) || 0;
          fundingRates.set(instId, {
            fundingRate,
            nextFundingRate: fundingRate,
            fundingTime: Date.now(),
            nextFundingTime: Date.now() + 3600 * 1000,
            settlementInterval: 1,
            lastUpdated: Date.now(),
          });
        }
      }
    });

    return fundingRates;
  },

  spotSymbolFormat: 'base',
  defaultSettlementInterval: 1,

  features: {
    maFlow: false,
    listingDates: false,
    separateFundingFetch: false,
  },
};
