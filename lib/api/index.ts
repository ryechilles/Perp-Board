/**
 * API module exports
 * Re-exports all API functions for clean imports
 */

// OKX Data Manager
export { OKXHybridDataManager, type TickerUpdateCallback, type StatusCallback } from './okx-data-manager';

// OKX REST API
export { fetchTickersREST, fetchSpotSymbols, fetchListingDates, fetchFundingRates } from './okx-rest';

// OKX RSI
export { fetchRSIForInstrument } from './okx-rsi';

// OKX MA Flow (Three-Line Convergence)
export { fetchMAForInstrument, fetchMAFlowBatch, calculateSMA, calculateConvergence } from './okx-ma-flow';

// CoinGecko
export { fetchMarketCapData } from './coingecko';

// Hyperliquid Data Manager
export { HyperliquidDataManager } from './hyperliquid-data-manager';

// Hyperliquid REST API
export {
  fetchHyperliquidTickers,
  fetchHyperliquidMeta,
  fetchHyperliquidFundingRates,
  fetchHyperliquidListingDates,
  fetchHyperliquidAllMids,
  processHyperliquidTicker,
} from './hyperliquid-rest';

// Hyperliquid RSI
export { fetchHyperliquidRSIForInstrument } from './hyperliquid-rsi';
