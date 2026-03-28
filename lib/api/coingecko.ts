/**
 * Market data & logo functions
 *
 * Logos: sourced exclusively from OKX /asset/currencies (logoLink field).
 *   - Covers ALL OKX-listed tokens: crypto AND stock perpetuals (AAPL, TSLA, etc.)
 *   - Cached locally for 7 days
 *
 * Market cap & sparkline: sourced from CoinGecko (Top 500 by market cap).
 */

import { MarketCapData } from '../types';
import { TIMING, CACHE_KEYS } from '../constants';
import { getLogoCache, setLogoCache } from '../cache';

// CoinGecko coin type
type CoinGeckoCoin = {
  symbol: string;
  market_cap: number;
  market_cap_rank: number;
  image: string;
  sparkline_in_7d?: { price: number[] };
};

/**
 * Fetch logo mappings from OKX /asset/currencies API
 * This is the single source of truth for ALL token logos.
 */
export async function fetchOKXLogos(): Promise<Record<string, string>> {
  try {
    console.log('[OKX Logos] Fetching currency logos...');
    const response = await fetch('/api/okx-currencies');
    if (!response.ok) {
      console.warn(`[OKX Logos] API error: ${response.status}`);
      return {};
    }

    const data = await response.json();
    if (data && typeof data === 'object' && !data.error) {
      const count = Object.keys(data).length;
      console.log(`[OKX Logos] Fetched ${count} currency logos`);
      return data as Record<string, string>;
    }
    return {};
  } catch (error) {
    console.warn('[OKX Logos] Failed to fetch:', error);
    return {};
  }
}

/**
 * Fetch market cap data (CoinGecko) and logos (OKX) in parallel.
 * Logo source: OKX only. CoinGecko only provides market cap, rank, sparkline.
 */
export async function fetchMarketCapData(): Promise<Map<string, MarketCapData>> {
  const result = new Map<string, MarketCapData>();

  // Load cached logos for instant display (these are OKX logos from previous sessions)
  const cachedLogos = getLogoCache();

  // Fetch OKX logos in parallel with CoinGecko — this is the sole logo source
  const okxLogosPromise = fetchOKXLogos();

  // Helper to process CoinGecko response (market cap & sparkline only, no logos)
  const processCoinGeckoData = (data: CoinGeckoCoin[], logos: Record<string, string>) => {
    data.forEach((coin) => {
      const symbol = coin.symbol.toUpperCase();
      const existing = result.get(symbol);
      if (!existing || (coin.market_cap_rank && coin.market_cap_rank < existing.rank)) {
        result.set(symbol, {
          marketCap: coin.market_cap,
          rank: coin.market_cap_rank || 9999,
          logo: logos[symbol] || cachedLogos[symbol] || '',
          sparkline: coin.sparkline_in_7d?.price,
        });
      }
    });
  };

  // Wait for OKX logos first (or use cache as fallback)
  let okxLogos: Record<string, string> = {};
  try {
    okxLogos = await okxLogosPromise;
  } catch (error) {
    console.warn('[OKX Logos] Failed, falling back to cache:', error);
  }

  // Merge: OKX fresh logos take priority, then cached logos fill gaps
  const allLogos: Record<string, string> = { ...cachedLogos, ...okxLogos };

  // Persist to cache
  if (Object.keys(okxLogos).length > 0) {
    setLogoCache(allLogos);
    console.log(`[OKX Logos] Logo cache updated: ${Object.keys(allLogos).length} total`);
  }

  try {
    // Fetch CoinGecko Top 500 coins by market cap (2 pages x 250)
    console.log('[CoinGecko] Fetching page 1 (rank 1-250)...');
    const response1 = await fetch('/api/coingecko?page=1');
    if (response1.ok) {
      const data1 = await response1.json();
      if (Array.isArray(data1)) {
        console.log(`[CoinGecko] Page 1: ${data1.length} coins`);
        processCoinGeckoData(data1, allLogos);
      }
    }

    console.log('[CoinGecko] Fetching page 2 (rank 251-500)...');
    const response2 = await fetch('/api/coingecko?page=2');
    if (response2.ok) {
      const data2 = await response2.json();
      if (Array.isArray(data2)) {
        console.log(`[CoinGecko] Page 2: ${data2.length} coins`);
        processCoinGeckoData(data2, allLogos);
      }
    }

    console.log(`[CoinGecko] Total matched: ${result.size} coins`);
  } catch (error) {
    console.error('[CoinGecko] Failed to fetch data:', error);
  }

  // Add MarketCapData entries for tokens that have OKX logos but no CoinGecko data
  // (e.g. stock perpetuals: AAPL, TSLA, NVDA, etc.)
  for (const [symbol, logoUrl] of Object.entries(allLogos)) {
    if (!result.has(symbol) && logoUrl) {
      result.set(symbol, {
        marketCap: 0,
        rank: 9999,
        logo: logoUrl,
      });
    }
  }

  return result;
}
