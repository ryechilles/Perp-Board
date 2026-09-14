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
import { MARKET_CAP } from '../constants';
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
// Contract: resolves ONLY on a real, PLAUSIBLE result. Any failure — network
// error, non-OK proxy response, non-array payload, or a payload that fails the
// MARKET_CAP sanity gates — REJECTS, so callers keep the last good data on a
// transient upstream hiccup instead of overwriting good ranks with rubbish.
//
// "Empty" is deliberately NOT the only failure signal. CoinLore serves a thin,
// half-corrupt payload far more often than an empty one (market_cap_usd as the
// literal string "0?"), and a thin result is the dangerous case: every coin it
// drops looks UNRANKED to selectUniverse, which drops unranked crypto — so a
// 9-coin result once collapsed the whole OKX board to a single row. Hence the
// size gate below, and Number() rather than parseFloat() so '0?' is recognised
// as malformed instead of silently becoming 0.
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

  let malformed = 0;

  for (const coin of data as CoinLoreCoin[]) {
    const symbol = (coin.symbol || '').toUpperCase();
    if (!symbol) continue;

    const rank = Number(coin.rank) || 9999;
    const marketCap = Number(coin.market_cap_usd);
    if (!Number.isFinite(marketCap)) {
      malformed++;
      continue;
    }
    if (marketCap <= 0) continue;

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

  if (result.size < MARKET_CAP.MIN_VALID_TOTAL) {
    throw new Error(
      `[MarketCap] resolved to only ${result.size} coins ` +
      `(${malformed} malformed of ${data.length}) — treating as failure`
    );
  }

  console.log(`[MarketCap] CoinLore: ${result.size} coins`);
  return result;
}
