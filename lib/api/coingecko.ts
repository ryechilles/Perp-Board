/**
 * Market data & logo functions
 *
 * Logos:
 *   - Crypto: sourced from CoinGecko (via coin.image in /coins/markets response)
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

// Fetch CoinGecko market cap data
// OKX only has ~250-300 perpetual pairs, most are in top 500 by market cap
// Logos are cached locally for 7 days
export async function fetchMarketCapData(): Promise<Map<string, MarketCapData>> {
  const result = new Map<string, MarketCapData>();

  // Load cached logos for instant display
  const cachedLogos = getLogoCache();
  const newLogos: Record<string, string> = { ...cachedLogos };

  // Helper to process CoinGecko response
  const processCoinGeckoData = (data: CoinGeckoCoin[]) => {
    data.forEach((coin) => {
      const symbol = coin.symbol.toUpperCase();
      const existing = result.get(symbol);
      if (!existing || (coin.market_cap_rank && coin.market_cap_rank < existing.rank)) {
        const logo = cachedLogos[symbol] || coin.image;
        if (coin.image) {
          newLogos[symbol] = coin.image;
        }
        result.set(symbol, {
          marketCap: coin.market_cap,
          rank: coin.market_cap_rank || 9999,
          logo,
          sparkline: coin.sparkline_in_7d?.price
        });
      }
    });
  };

  try {
    // Use our API proxy to avoid CORS and rate limit issues
    // Fetch Top 500 coins by market cap (2 pages x 250)

    // Page 1: rank 1-250
    console.log('[CoinGecko] Fetching page 1 (rank 1-250)...');
    const response1 = await fetch('/api/coingecko?page=1');
    if (response1.ok) {
      const data1 = await response1.json();
      if (Array.isArray(data1)) {
        console.log(`[CoinGecko] Page 1: ${data1.length} coins`);
        processCoinGeckoData(data1);
        setLogoCache(newLogos);
      }
    }

    // Page 2: rank 251-500
    console.log('[CoinGecko] Fetching page 2 (rank 251-500)...');
    const response2 = await fetch('/api/coingecko?page=2');
    if (response2.ok) {
      const data2 = await response2.json();
      if (Array.isArray(data2)) {
        console.log(`[CoinGecko] Page 2: ${data2.length} coins`);
        processCoinGeckoData(data2);
        setLogoCache(newLogos);
      }
    }

    console.log(`[CoinGecko] Total matched: ${result.size} coins`);
  } catch (error) {
    console.error('[CoinGecko] Failed to fetch data:', error);
    setLogoCache(newLogos);
  }

  return result;
}
