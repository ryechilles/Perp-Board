/**
 * API module exports
 * Re-exports all API functions for clean imports
 */

// Base Data Manager
export { BaseDataManager } from './base-data-manager';

// Shared RSI Pipeline
export { calculateRSIForInstrument, type CandleFetcher } from './rsi-core';

// RSI Batch
export { fetchRSIBatchGeneric } from './rsi-batch';

// OKX Data Manager
export { OKXHybridDataManager, type TickerUpdateCallback, type StatusCallback } from './okx-data-manager';

// OKX REST API
export { fetchTickersREST, fetchSpotSymbols, fetchListingDates, fetchFundingRates } from './okx-rest';

// OKX RSI
export { fetchRSIForInstrument } from './okx-rsi';

// OKX MA Flow (Three-Line Convergence)
export { fetchMAForInstrument, fetchMAFlowBatch, calculateSMA, calculateConvergence } from './okx-ma-flow';

// Market cap (CoinLore-backed)
export { fetchMarketCapData } from './marketcap';

// Hyperliquid Data Manager
export { HyperliquidDataManager } from './hyperliquid-data-manager';

// Hyperliquid REST API
export {
  fetchHyperliquidTickers,
  fetchHyperliquidMeta,
  fetchHyperliquidFundingRates,
  fetchHyperliquidAllMids,
  processHyperliquidTicker,
} from './hyperliquid-rest';

// Hyperliquid RSI
export { fetchHyperliquidRSIForInstrument } from './hyperliquid-rsi';
