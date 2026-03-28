import { NextResponse } from 'next/server';

/**
 * OKX Currencies API proxy
 * Fetches currency info (including logoLink) from OKX
 * Used to provide logos for all tokens including stock perpetuals (AAPL, TSLA, etc.)
 * that CoinGecko doesn't cover.
 *
 * GET /api/okx-currencies
 * Returns: Record<symbol, logoUrl> mapping
 */

const cache: { data: Record<string, string> | null; timestamp: number } = {
  data: null,
  timestamp: 0,
};

// Cache for 24 hours — currency logos rarely change
const CACHE_DURATION = 24 * 60 * 60 * 1000;

export async function GET() {
  // Check cache
  if (cache.data && Date.now() - cache.timestamp < CACHE_DURATION) {
    return NextResponse.json(cache.data);
  }

  try {
    const response = await fetch('https://www.okx.com/api/v5/asset/currencies', {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 86400 }, // 24 hours
    });

    if (!response.ok) {
      console.error(`[OKX Currencies] API error: ${response.status}`);
      // Return cached data if available, even if stale
      if (cache.data) {
        return NextResponse.json(cache.data);
      }
      return NextResponse.json(
        { error: `OKX API error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();

    if (data.code !== '0' || !data.data) {
      console.error('[OKX Currencies] Invalid response:', data.code, data.msg);
      if (cache.data) {
        return NextResponse.json(cache.data);
      }
      return NextResponse.json(
        { error: 'Invalid OKX API response' },
        { status: 502 }
      );
    }

    // Build symbol -> logoLink mapping
    // OKX returns multiple entries per currency (one per chain),
    // we just need one logo per symbol
    const logoMap: Record<string, string> = {};
    for (const currency of data.data) {
      const symbol = (currency.ccy as string)?.toUpperCase();
      const logo = currency.logoLink as string;
      if (symbol && logo && !logoMap[symbol]) {
        logoMap[symbol] = logo;
      }
    }

    console.log(`[OKX Currencies] Fetched logos for ${Object.keys(logoMap).length} currencies`);

    // Update cache
    cache.data = logoMap;
    cache.timestamp = Date.now();

    return NextResponse.json(logoMap);
  } catch (error) {
    console.error('[OKX Currencies] Failed:', error);
    if (cache.data) {
      return NextResponse.json(cache.data);
    }
    return NextResponse.json(
      { error: 'Failed to fetch OKX currencies' },
      { status: 500 }
    );
  }
}
