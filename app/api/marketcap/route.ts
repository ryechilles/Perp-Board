import { NextResponse } from 'next/server';
import { MARKET_CAP } from '@/lib/constants';

// Market-cap / rank proxy backed by CoinLore (keyless).
//
// Replaces the CoinGecko proxy for market data: CoinGecko's free API returns
// 403 to server-side requests originating from Cloudflare Worker IPs. CoinLore
// is keyless and serves datacenter IPs fine.
//
// Returns the top ~500 coins by market cap (5 pages × 100), cached 5 minutes.
//
// CoinLore does NOT fail cleanly: instead of an error it can serve a structurally
// valid payload whose `market_cap_usd` fields are the literal string "0?" and
// whose ranks are scrambled. Such a payload is worse than no payload — it makes
// every real coin look unranked, which collapses the board's universe (see
// MARKET_CAP in lib/constants). So rows are validated here, a page that comes
// back mostly corrupt counts as a FAILED page, and a response that fails the
// gates is neither cached nor served: the last good payload is served instead
// (or 503, so the client keeps its own cached ranks).

export const dynamic = 'force-dynamic';

// NOTE: this in-memory cache is BEST-EFFORT on Cloudflare Workers. Worker
// isolates are stateless and per-isolate, so this module-level variable (and the
// `next: { revalidate }` Data Cache below) only dedupe requests that land on the
// same warm isolate; they are NOT durable or shared across isolates. That still
// meaningfully protects CoinLore from concurrent users on a warm isolate. To make
// the 5-minute cache globally durable, configure an incremental cache (R2/KV) in
// open-next.config.ts, or use the Cloudflare Cache API (caches.default) here.
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
let cache: { data: CoinLoreCoin[]; timestamp: number } | null = null;

interface CoinLoreCoin {
  symbol?: string;
  rank?: number | string;
  market_cap_usd?: string;
  nameid?: string;
}

/**
 * A row is well-formed when its market cap is a real number. Note `Number()`,
 * not `parseFloat()`: parseFloat('0?') is 0 (indistinguishable from a legitimate
 * zero-cap coin), while Number('0?') is NaN — which is exactly the corruption
 * this gate exists to catch. A genuine '0' still passes.
 */
function isWellFormed(coin: CoinLoreCoin): boolean {
  if (!coin || typeof coin.symbol !== 'string' || !coin.symbol) return false;
  if (!Number.isFinite(Number(coin.rank))) return false;
  return Number.isFinite(Number(coin.market_cap_usd));
}

/** Fetch one page; null means the page failed or came back mostly corrupt. */
async function fetchPage(start: number): Promise<CoinLoreCoin[] | null> {
  const res = await fetch(
    `https://api.coinlore.net/api/tickers/?start=${start}&limit=${MARKET_CAP.PAGE_SIZE}`,
    {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; PerpBoard/1.0)',
      },
      next: { revalidate: 300 },
    }
  );
  if (!res.ok) {
    console.error(`[MarketCap/CoinLore] page start=${start} error: ${res.status}`);
    return null;
  }
  const json = await res.json();
  const rows: CoinLoreCoin[] = Array.isArray(json?.data) ? json.data : [];
  const valid = rows.filter(isWellFormed);
  if (valid.length < MARKET_CAP.MIN_VALID_PER_PAGE) {
    console.error(
      `[MarketCap/CoinLore] page start=${start} corrupt: ${valid.length}/${rows.length} rows well-formed`
    );
    return null;
  }
  return valid;
}

/**
 * Whole-payload sanity check. The totals gate catches the common "most rows are
 * '0?'" failure; the top-rank check catches a payload that is thin only where it
 * matters most (the majors that actually define the universe).
 */
function isPayloadSane(coins: CoinLoreCoin[]): boolean {
  if (coins.length < MARKET_CAP.MIN_VALID_TOTAL) {
    console.error(`[MarketCap/CoinLore] payload too thin: ${coins.length} well-formed rows`);
    return false;
  }
  // Every coin ranked in the top N must carry a real, positive market cap.
  const topRanks = new Set<number>();
  for (const coin of coins) {
    const rank = Number(coin.rank);
    if (rank >= 1 && rank <= MARKET_CAP.SANITY_TOP_RANK) {
      if (!(Number(coin.market_cap_usd) > 0)) {
        console.error(`[MarketCap/CoinLore] rank ${rank} (${coin.symbol}) has no market cap`);
        return false;
      }
      topRanks.add(rank);
    }
  }
  if (topRanks.size < MARKET_CAP.SANITY_TOP_RANK) {
    console.error(`[MarketCap/CoinLore] only ${topRanks.size} of the top ${MARKET_CAP.SANITY_TOP_RANK} ranks present`);
    return false;
  }
  return true;
}

export async function GET() {
  // Serve from in-memory cache when fresh
  if (cache && Date.now() - cache.timestamp < CACHE_DURATION) {
    return NextResponse.json(cache.data);
  }

  try {
    const starts = [0, 100, 200, 300, 400];
    const pages = await Promise.all(starts.map(fetchPage));

    const data = pages.flat().filter((c): c is CoinLoreCoin => c !== null);
    const failedPages = pages.filter((p) => p === null).length;

    if (failedPages > 0 || !isPayloadSane(data)) {
      // Upstream is degraded. Never cache this — a poisoned 5-minute cache turns
      // a momentary CoinLore hiccup into a five-minute outage for every client.
      if (cache) {
        console.warn(
          `[MarketCap/CoinLore] degraded response (${failedPages} failed pages, ${data.length} rows) — serving stale cache`
        );
        return NextResponse.json(cache.data);
      }
      return NextResponse.json(
        { error: 'Upstream market data unavailable' },
        { status: 503 }
      );
    }

    cache = { data, timestamp: Date.now() };
    return NextResponse.json(data);
  } catch (error) {
    console.error('[MarketCap/CoinLore] Failed:', error);
    if (cache) return NextResponse.json(cache.data);
    return NextResponse.json(
      { error: 'Failed to fetch market data' },
      { status: 500 }
    );
  }
}
