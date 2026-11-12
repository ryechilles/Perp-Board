import { NextResponse } from 'next/server';
import { MARKET_CAP } from '@/lib/constants';
import { CoinLoreCoin, isWellFormed, payloadProblem } from '@/lib/api/marketcap-validate';

// Market-cap / rank proxy backed by CoinLore (keyless).
//
// Replaces the CoinGecko proxy for market data: CoinGecko's free API returns
// 403 to server-side requests originating from Cloudflare Worker IPs. CoinLore
// is keyless and serves datacenter IPs fine.
//
// Returns the top ~500 coins by market cap (5 pages × 100), fresh for 5 minutes.
//
// CoinLore does NOT fail cleanly (see lib/api/marketcap-validate): rows are
// validated here, a page that comes back mostly corrupt counts as a FAILED
// page, and a response that fails the gates is neither cached nor served: the
// last good payload is served instead (or 503, so the client keeps its own
// cached ranks).
//
// Three cache layers, cheapest first:
//  1. `memory`  — this isolate only; gone when the isolate is.
//  2. Cloudflare Cache API (`caches.default`) — shared by every isolate in the
//     same data centre, so a cold isolate no longer has to go back to CoinLore.
//     Absent outside Workers (local `next dev`) and a silent no-op where the
//     zone doesn't support it; every use is guarded, so it can only help.
//  3. `Cache-Control` on the response — the browser reuses the payload across
//     reloads and revalidates it in the background.

export const dynamic = 'force-dynamic';

const FRESH_MS = 5 * 60 * 1000; // serve without refetching
const KEEP_SECONDS = 60 * 60; // how long the edge keeps a payload as a stale fallback
const EDGE_CACHE_PATH = '/__cache/marketcap-v1';
const FETCHED_AT_HEADER = 'x-fetched-at';

// Browser: reuse for 2 minutes, then serve stale while refreshing in the background.
const CLIENT_CACHE_CONTROL = 'public, max-age=120, stale-while-revalidate=600';

interface Cached {
  data: CoinLoreCoin[];
  timestamp: number;
}

let memory: Cached | null = null;

const isFresh = (c: Cached | null): boolean =>
  !!c && Date.now() - c.timestamp < FRESH_MS;

/** Cloudflare's shared edge cache, or null where the runtime has none. */
function edgeCache(): Cache | null {
  const storage = (globalThis as { caches?: { default?: Cache } }).caches;
  return storage?.default ?? null;
}

async function readEdge(key: string): Promise<Cached | null> {
  try {
    const hit = await edgeCache()?.match(key);
    if (!hit) return null;
    const timestamp = Number(hit.headers.get(FETCHED_AT_HEADER));
    const data = await hit.json();
    if (!Number.isFinite(timestamp) || !Array.isArray(data)) return null;
    return { data, timestamp };
  } catch {
    return null;
  }
}

async function writeEdge(key: string, entry: Cached): Promise<void> {
  try {
    await edgeCache()?.put(
      key,
      new Response(JSON.stringify(entry.data), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': `public, max-age=${KEEP_SECONDS}`,
          [FETCHED_AT_HEADER]: String(entry.timestamp),
        },
      })
    );
  } catch {
    // Best effort — the in-memory layer still holds the payload.
  }
}

/** A good payload: cacheable by the browser. */
function ok(entry: Cached) {
  return NextResponse.json(entry.data, {
    headers: { 'Cache-Control': CLIENT_CACHE_CONTROL },
  });
}

/** A stale fallback during an upstream outage: usable, but not worth keeping. */
function stale(entry: Cached) {
  return NextResponse.json(entry.data, {
    headers: { 'Cache-Control': 'no-store' },
  });
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
      // Caching is handled explicitly above; keep Next's data cache out of it.
      cache: 'no-store',
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

export async function GET(request: Request) {
  if (memory && isFresh(memory)) return ok(memory);

  const edgeKey = new URL(EDGE_CACHE_PATH, request.url).toString();
  const edge = await readEdge(edgeKey);
  if (edge && (!memory || edge.timestamp > memory.timestamp)) memory = edge;
  if (memory && isFresh(memory)) return ok(memory);

  // `memory` is now the newest payload either layer has — the stale fallback.
  try {
    const starts = [0, 100, 200, 300, 400];
    const pages = await Promise.all(starts.map(fetchPage));

    const data = pages.flat().filter((c): c is CoinLoreCoin => c !== null);
    const failedPages = pages.filter((p) => p === null).length;
    const problem = failedPages > 0 ? `${failedPages} failed pages` : payloadProblem(data);

    if (problem) {
      // Upstream is degraded. Never cache this — a poisoned 5-minute cache turns
      // a momentary CoinLore hiccup into a five-minute outage for every client.
      console.error(`[MarketCap/CoinLore] degraded response: ${problem}`);
      if (memory) return stale(memory);
      return NextResponse.json(
        { error: 'Upstream market data unavailable' },
        { status: 503, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const entry: Cached = { data, timestamp: Date.now() };
    memory = entry;
    await writeEdge(edgeKey, entry);
    return ok(entry);
  } catch (error) {
    console.error('[MarketCap/CoinLore] Failed:', error);
    if (memory) return stale(memory);
    return NextResponse.json(
      { error: 'Failed to fetch market data' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
