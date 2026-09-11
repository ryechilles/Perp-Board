import { NextResponse } from 'next/server';

// BTC Dominance API proxy
// Fetches global market data including BTC dominance
// Also fetches historical data for sparkline

interface GlobalData {
  data: {
    market_cap_percentage: {
      btc: number;
      eth: number;
    };
    total_market_cap: {
      usd: number;
    };
    market_cap_change_percentage_24h_usd: number;
  };
}

interface HistoricalData {
  timestamp: number;
  dominance: number;
}

// Cache for global data
const globalCache: { data: GlobalData | null; timestamp: number } = {
  data: null,
  timestamp: 0
};

// Cache for historical dominance data (store hourly points for 24h)
const historyCache: HistoricalData[] = [];

const CACHE_DURATION = 60 * 1000; // 1 minute for current data

export async function GET() {
  const now = Date.now();

  // Check cache first
  if (globalCache.data && now - globalCache.timestamp < CACHE_DURATION) {
    return NextResponse.json({
      current: globalCache.data,
      history: historyCache
    });
  }

  try {
    // Fetch global market data
    const response = await fetch(
      'https://api.coingecko.com/api/v3/global',
      {
        headers: {
          'Accept': 'application/json',
        },
        next: { revalidate: 60 }
      }
    );

    if (!response.ok) {
      console.error(`[BTC Dominance] API error: ${response.status}`);
      return NextResponse.json(
        { error: `CoinGecko API error: ${response.status}` },
        { status: response.status }
      );
    }

    const data: GlobalData = await response.json();

    // Update cache
    globalCache.data = data;
    globalCache.timestamp = now;

    // Store historical data point (every ~1 minute when fetched)
    const currentDominance = data.data.market_cap_percentage.btc;
    const lastPoint = historyCache[historyCache.length - 1];

    // Add new point if enough time has passed (at least 5 minutes between points)
    if (!lastPoint || now - lastPoint.timestamp >= 5 * 60 * 1000) {
      historyCache.push({
        timestamp: now,
        dominance: currentDominance
      });

      // Keep only last 24 hours of data (288 points at 5-min intervals max)
      while (historyCache.length > 288) {
        historyCache.shift();
      }
    }

    return NextResponse.json({
      current: data,
      history: historyCache
    });
  } catch (error) {
    console.error('[BTC Dominance] Failed:', error);
    return NextResponse.json(
      { error: 'Failed to fetch BTC dominance' },
      { status: 500 }
    );
  }
}
