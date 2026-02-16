/**
 * OKX API Compatibility Layer
 * Re-exports all API functions from the split modules
 *
 * NOTE: This file is kept for backward compatibility.
 * New code should import directly from '@/lib/api'
 */

// Re-export everything from the split API modules
export {
  OKXHybridDataManager,
  type TickerUpdateCallback,
  type StatusCallback,
  fetchTickersREST,
  fetchSpotSymbols,
  fetchListingDates,
  fetchFundingRates,
  fetchRSIForInstrument,
  fetchRSIBatch,
  fetchMarketCapData,
  fetchMAFlowBatch,
} from './api';
