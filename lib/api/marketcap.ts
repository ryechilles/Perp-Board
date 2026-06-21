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
 *  - logo: built from CoinLore's `nameid` (e.g. "bitcoin" → c1.coinlore.com
 *    image). Logos load browser-side via <img>, so the Worker-IP block that
 *    killed the CoinGecko API never applied to them. The UI <img> falls back
 *    to a symbol-keyed CDN, then a letter avatar, if this 404s (see
 *    TokenAvatar). A previously cached logo, if any, is preferred so revisits
 *    paint instantly.
 *  - sparkline: not provided; the table falls back to OKX-derived sparklines.
 */

import { MarketCapData } from '../types';
import { getLogoCache } from '../cache';

// CoinLore ticker shape (subset we use)
interface CoinLoreCoin {
  symbol: string;
  rank: number;
  market_cap_usd: string;
  nameid?: string;
}

/** CoinLore logo CDN, keyed by the coin's `nameid` (e.g. "bitcoin"). */
function coinLoreLogo(nameid?: string): string | undefined {
  return nameid ? `https://c1.coinlore.com/img/25x25/${nameid}.png` : undefined;
}

// Fetch market cap data via the CoinLore proxy.
//
// Contract: resolves ONLY on a real, non-empty result. Any failure — network
// error, non-OK proxy response, non-array payload, or a parsed-but-empty result
// — REJECTS. A successful CoinLore response always has coins, so an empty result
// is itself a failure signal; returning it (as an earlier version did) let
// callers overwrite good ranks with nothing, which collapses the table's default
// market-cap sort and uncaps the universe. Rejecting instead lets callers keep
// the last good data on a transient upstream hiccup.
export async function fetchMarketCapData(): Promise<Map<string, MarketCapData>> {
  const result = new Map<string, MarketCapData>();
  const cachedLogos = getLogoCache();

  const response = await fetch('/api/marketcap');
  if (!response.ok) {
    throw new Error(`[MarketCap] /api/marketcap error: ${response.status}`);
  }

  const data = await response.json();
  if (!Array.isArray(data)) {
    throw new Error('[MarketCap] /api/marketcap returned a non-array payload');
  }

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
        // Prefer a cached logo (instant revisit paint), else CoinLore's CDN.
        logo: cachedLogos[symbol] || coinLoreLogo(coin.nameid),
        sparkline: undefined,
      });
    }
  }

  if (result.size === 0) {
    throw new Error('[MarketCap] resolved to 0 coins — treating as failure');
  }

  console.log(`[MarketCap] CoinLore: ${result.size} coins`);
  return result;
}
