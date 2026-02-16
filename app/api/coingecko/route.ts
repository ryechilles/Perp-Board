import { NextResponse } from 'next/server';

// CoinGecko API proxy to avoid CORS and rate limit issues
// Cache the response for 5 minutes to reduce API calls
const cache: Record<string, { data: unknown; timestamp: number }> = {};
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type'); // 'history' for BTC historical prices

  // --- BTC historical prices for AHR999 ---
  if (type === 'history') {
    const cacheKey = 'btc_history_200d';
    const cached = cache[cacheKey];
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return NextResponse.json(cached.data);
    }

    try {
      const apiUrl = new URL('https://api.coingecko.com/api/v3/coins/bitcoin/market_chart');
      apiUrl.searchParams.set('vs_currency', 'usd');
      apiUrl.searchParams.set('days', '200');
      apiUrl.searchParams.set('interval', 'daily');

      const response = await fetch(apiUrl.toString(), {
        headers: { 'Accept': 'application/json' },
        next: { revalidate: 300 },
      });

      if (!response.ok) {
        console.error(`[CoinGecko Proxy] BTC history error: ${response.status}`);
        return NextResponse.json({ error: `CoinGecko API error: ${response.status}` }, { status: response.status });
      }

      const data = await response.json();
      cache[cacheKey] = { data, timestamp: Date.now() };
      return NextResponse.json(data);
    } catch (error) {
      console.error('[CoinGecko Proxy] BTC history failed:', error);
      return NextResponse.json({ error: 'Failed to fetch BTC history' }, { status: 500 });
    }
  }

  // --- Market cap pages (default) ---
  const pageParam = searchParams.get('page') || '1';

  // Validate page parameter to prevent cache pollution
  const pageNum = parseInt(pageParam, 10);
  if (isNaN(pageNum) || pageNum < 1 || pageNum > 10) {
    return NextResponse.json(
      { error: 'Invalid page parameter. Must be 1-10.' },
      { status: 400 }
    );
  }
  const page = String(pageNum);

  // Check cache first (per page)
  const cacheKey = `page_${page}`;
  const cached = cache[cacheKey];
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return NextResponse.json(cached.data);
  }

  try {
    // Build URL safely using URL API
    const apiUrl = new URL('https://api.coingecko.com/api/v3/coins/markets');
    apiUrl.searchParams.set('vs_currency', 'usd');
    apiUrl.searchParams.set('order', 'market_cap_desc');
    apiUrl.searchParams.set('per_page', '250');
    apiUrl.searchParams.set('page', page);
    apiUrl.searchParams.set('sparkline', 'true');

    const response = await fetch(
      apiUrl.toString(),
      {
        headers: {
          'Accept': 'application/json',
        },
        // Cache on server side
        next: { revalidate: 300 } // 5 minutes
      }
    );

    if (!response.ok) {
      console.error(`[CoinGecko Proxy] API error: ${response.status}`);
      return NextResponse.json(
        { error: `CoinGecko API error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Update cache for this page
    cache[cacheKey] = { data, timestamp: Date.now() };

    return NextResponse.json(data);
  } catch (error) {
    console.error('[CoinGecko Proxy] Failed:', error);
    return NextResponse.json(
      { error: 'Failed to fetch from CoinGecko' },
      { status: 500 }
    );
  }
}
