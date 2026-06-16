import { NextResponse } from 'next/server';

// Market-cap / rank proxy backed by CoinLore (keyless).
//
// Replaces the CoinGecko proxy for market data: CoinGecko's free API returns
// 403 to server-side requests originating from Cloudflare Worker IPs. CoinLore
// is keyless and serves datacenter IPs fine.
//
// Returns the top ~500 coins by market cap (5 pages × 100), cached 5 minutes.

export const dynamic = 'force-dynamic';

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
let cache: { data: unknown; timestamp: number } | null = null;

export async function GET() {
  // Serve from in-memory cache when fresh
  if (cache && Date.now() - cache.timestamp < CACHE_DURATION) {
    return NextResponse.json(cache.data);
  }

  try {
    const starts = [0, 100, 200, 300, 400];
    const pages = await Promise.all(
      starts.map(async (start) => {
        const res = await fetch(
          `https://api.coinlore.net/api/tickers/?start=${start}&limit=100`,
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
          return [];
        }
        const json = await res.json();
        return Array.isArray(json?.data) ? json.data : [];
      })
    );

    const data = pages.flat();
    cache = { data, timestamp: Date.now() };
    return NextResponse.json(data);
  } catch (error) {
    console.error('[MarketCap/CoinLore] Failed:', error);
    return NextResponse.json(
      { error: 'Failed to fetch market data' },
      { status: 500 }
    );
  }
}
