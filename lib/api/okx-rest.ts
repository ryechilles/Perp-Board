/**
 * OKX REST API functions
 * Handles all REST API calls to OKX
 */

import { OKXTicker, OKXInstrument, OKXFundingRate, FundingRateData, ListingData, ProcessedTicker } from '../types';
import { processTicker } from '../utils';
import { API, TIMING, RATE_LIMIT } from '../constants';
import { okxFetch } from './okx-gateway';

const OKX_REST_BASE = API.OKX_REST_BASE;

// Fetch all tickers via REST (fallback)
export async function fetchTickersREST(): Promise<ProcessedTicker[]> {
  try {
    const response = await okxFetch(`${OKX_REST_BASE}/market/tickers?instType=SWAP`);
    if (!response.ok) {
      console.error(`Failed to fetch tickers: HTTP ${response.status}`);
      return [];
    }
    const data = await response.json();

    if (data.code === '0' && data.data) {
      return data.data.map((t: OKXTicker) => processTicker(t));
    }
    return [];
  } catch (error) {
    console.error('Failed to fetch tickers:', error);
    return [];
  }
}

// Fetch spot symbols.
// REJECTS on failure (never resolves with an empty set) so callers keep the
// previous data instead of wiping the store — same contract as fetchMarketCapData.
export async function fetchSpotSymbols(): Promise<Set<string>> {
  const response = await okxFetch(`${OKX_REST_BASE}/market/tickers?instType=SPOT`);
  if (!response.ok) {
    throw new Error(`Spot symbols: HTTP ${response.status}`);
  }
  const data = await response.json();
  if (data.code !== '0' || !data.data) {
    throw new Error(`Spot symbols: OKX code ${data.code}`);
  }

  const symbols = new Set<string>();
  data.data.forEach((t: OKXTicker) => {
    const parts = t.instId.split('-');
    symbols.add(`${parts[0]}-${parts[1]}`);
  });
  if (symbols.size === 0) {
    throw new Error('Spot symbols: empty response');
  }
  return symbols;
}

// Fetch listing dates for all SWAP instruments.
// REJECTS on failure (never resolves with an empty map) — see fetchSpotSymbols.
export async function fetchListingDates(): Promise<Map<string, ListingData>> {
  const response = await okxFetch(`${OKX_REST_BASE}/public/instruments?instType=SWAP`);
  if (!response.ok) {
    throw new Error(`Listing dates: HTTP ${response.status}`);
  }
  const data = await response.json();
  if (data.code !== '0' || !data.data) {
    throw new Error(`Listing dates: OKX code ${data.code}`);
  }

  const result = new Map<string, ListingData>();
  data.data.forEach((inst: OKXInstrument) => {
    if (inst.listTime) {
      result.set(inst.instId, {
        listTime: parseInt(inst.listTime, 10),
        instCategory: inst.instCategory,
      });
    }
  });
  if (result.size === 0) {
    throw new Error('Listing dates: empty response');
  }
  return result;
}

// Fetch funding rates for all SWAP instruments.
// REJECTS on failure (never resolves with an empty map) so callers keep the
// previous data instead of wiping the store. Individual per-instrument failures
// inside the fan-out are tolerated; only a fully-empty result rejects.
export async function fetchFundingRates(
  allowedInstIds?: Set<string>
): Promise<Map<string, FundingRateData>> {
  // First get the list of all SWAP instruments
  const response = await okxFetch(`${OKX_REST_BASE}/public/instruments?instType=SWAP`);
  if (!response.ok) {
    throw new Error(`Funding rates: instruments HTTP ${response.status}`);
  }
  const instData = await response.json();

  if (instData.code !== '0' || !instData.data) {
    throw new Error(`Funding rates: instruments OKX code ${instData.code}`);
  }

  const result = new Map<string, FundingRateData>();
  const instIds = instData.data
    .filter((inst: OKXInstrument) => inst.instId.includes('-USDT-'))
    // Cap to the active universe when provided — shrinks the per-instrument
    // fan-out (~250 → ~100). Omit to fetch all (cold-start fallback).
    .filter((inst: OKXInstrument) => !allowedInstIds || allowedInstIds.has(inst.instId))
    .map((inst: OKXInstrument) => inst.instId);

  // Fetch funding rates in batches
  const batchSize = RATE_LIMIT.API_BATCH_SIZE;
  for (let i = 0; i < instIds.length; i += batchSize) {
    const batch = instIds.slice(i, i + batchSize);

    // Fetch each instrument's funding rate
    const promises = batch.map(async (instId: string) => {
      try {
        const res = await okxFetch(`${OKX_REST_BASE}/public/funding-rate?instId=${instId}`);
        const data = await res.json();

        if (data.code === '0' && data.data && data.data[0]) {
          const fr = data.data[0] as OKXFundingRate;
          const fundingTime = parseInt(fr.fundingTime, 10) || 0;
          const nextFundingTime = parseInt(fr.nextFundingTime, 10) || 0;

          // Calculate settlement interval in hours
          let settlementInterval = 8; // default
          if (fundingTime && nextFundingTime) {
            const diffMs = nextFundingTime - fundingTime;
            const diffHours = Math.round(diffMs / (1000 * 60 * 60));
            if (diffHours > 0 && diffHours <= 8) {
              settlementInterval = diffHours;
            }
          }

          return {
            instId,
            data: {
              fundingRate: parseFloat(fr.fundingRate) || 0,
              nextFundingRate: parseFloat(fr.nextFundingRate) || 0,
              fundingTime,
              nextFundingTime,
              settlementInterval,
              lastUpdated: Date.now()
            }
          };
        }
        return null;
      } catch (err) {
        console.warn(`Funding rate fetch failed for ${instId}:`, err);
        return null;
      }
    });

    const results = await Promise.all(promises);
    results.forEach(r => {
      if (r) result.set(r.instId, r.data);
    });

    // Small delay between batches
    if (i + batchSize < instIds.length) {
      await new Promise(r => setTimeout(r, TIMING.API_BATCH_DELAY));
    }
  }

  if (result.size === 0) {
    throw new Error('Funding rates: empty result (all requests failed or no instruments matched)');
  }
  return result;
}
