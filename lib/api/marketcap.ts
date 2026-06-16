/**
 * Market cap / rank data — sourced from CoinLore (keyless).
 *
 * Replaces CoinGecko for market data: CoinGecko's free API returns 403 to
 * server-side requests from Cloudflare Worker IPs. CoinLore is keyless and
 * works from datacenter IPs. Fetched via the /api/marketcap proxy (which adds
 * a 5-minute server cache).
 *
 * Field coverage vs the old CoinGecko source:
 *  - marketCap + rank: provided by CoinLore.
 *  - logo: CoinLore does not return logos. Best-effort: reuse any previously
 *    cached CoinGecko logos from localStorage; unknown symbols fall back to
 *    letter avatars in the UI.
 *  - sparkline: not provided; the table falls back to OKX-derived sparklines.
 *
 * NOTE: filename kept as `coingecko.ts` to avoid churn (imported widely as
 * `fetchMarketCapData`); the data source is now CoinLore.
 */

import { MarketCapData } from '../types';
import { getLogoCache } from '../cache';

// CoinLore ticker shape (subset we use)
interface CoinLoreCoin {
  symbol: string;
  rank: number;
  market_cap_usd: string;
}

// Fetch market cap data via the CoinLore proxy.
export async function fetchMarketCapData(): Promise<Map<string, MarketCapData>> {
  const result = new Map<string, MarketCapData>();
  const cachedLogos = getLogoCache();

  try {
    const response = await fetch('/api/marketcap');
    if (!response.ok) {
      console.error(`[MarketCap] /api/marketcap error: ${response.status}`);
      return result;
    }

    const data = await response.json();
    if (!Array.isArray(data)) return result;

    for (const coin of data as CoinLoreCoin[]) {
      const symbol = (coin.symbol || '').toUpperCase();
      if (!symbol) continue;

      const rank = Number(coin.rank) || 9999;
      const marketCap = parseFloat(coin.market_cap_usd) || 0;
      if (!marketCap) continue;

      const existing = result.get(symbol);
      // Multiple coins can share a symbol — keep the highest-ranked one.
      if (!existing || rank < existing.rank) {
        result.set(symbol, {
          marketCap,
          rank,
          logo: cachedLogos[symbol],
          sparkline: undefined,
        });
      }
    }

    console.log(`[MarketCap] CoinLore: ${result.size} coins`);
  } catch (error) {
    console.error('[MarketCap] Failed to fetch:', error);
  }

  return result;
}
