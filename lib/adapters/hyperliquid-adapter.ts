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
    tier?: 'top50' | 'tier2' | 'tier3' | 'all',
    signal?: AbortSignal
  ): Promise<void> {
    return fetchRSIBatchGeneric(ids, existing, fetchHyperliquidRSIForInstrument, onProgress, onUpdate, tier, signal);
  },

  // Hyperliquid extracts funding from tickers, so `allowedInstIds` is unused here.
  // No initial data needed: spot symbols aren't used on Hyperliquid (the board
  // shows no spot info there and the no-spot universe cut is OKX-only).
  async fetchInitialData(_allowedInstIds?: Set<string>) {
    void _allowedInstIds;
    return {};
  },

  preFilterTickers(tickers: ProcessedTicker[]): ProcessedTicker[] {
    // Hyperliquid: no pre-filtering needed, all tickers are valid
    return tickers;
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
    excludeNoSpotCrypto: false,
  },
};
