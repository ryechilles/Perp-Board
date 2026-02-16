// AHR999 Bitcoin Indicator
// Formula: AHR999 = (BTC Price / 200-day DCA Cost) × (BTC Price / Growth Valuation)
//
// Zones:
// < 0.45: Bottom Zone (抄底区) - Strong buy
// 0.45 - 1.2: DCA Zone (定投区) - Regular buying
// 1.2 - 2.0: Wait Zone (观望区) - Be cautious
// 2.0 - 4.0: Take Profit Zone (止盈区) - Gradual exit
// >= 4.0: Top Zone (逃顶区) - Sell

export interface AHR999Data {
  value: number;
  btcPrice: number;
  dca200Cost: number;
  growthValuation: number;
  zone: AHR999Zone;
  lastUpdated: number;
}

export type AHR999Zone = 'bottom' | 'dca' | 'wait' | 'takeProfit' | 'top';

export interface AHR999ZoneInfo {
  zone: AHR999Zone;
  label: string;
  labelCn: string;
  color: string;
  bgColor: string;
  description: string;
  dot: string;
  range: string;
}

export function getAHR999ZoneInfo(value: number | null): AHR999ZoneInfo {
  if (value === null) {
    return {
      zone: 'dca',
      label: '--',
      labelCn: '--',
      color: 'text-muted-foreground',
      bgColor: 'bg-muted',
      description: 'Loading...',
      dot: '●',
      range: '--'
    };
  }

  if (value < 0.45) {
    return {
      zone: 'bottom',
      label: 'Bottom',
      labelCn: '抄底区',
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-50 dark:bg-green-950/40',
      description: 'Strong buy opportunity',
      dot: '●',
      range: '<0.45'
    };
  }
  if (value < 1.2) {
    return {
      zone: 'dca',
      label: 'DCA',
      labelCn: '定投区',
      color: 'text-emerald-500 dark:text-emerald-400',
      bgColor: 'bg-emerald-50 dark:bg-emerald-950/40',
      description: 'Regular buying zone',
      dot: '●',
      range: '0.45-1.2'
    };
  }
  if (value < 2.0) {
    return {
      zone: 'wait',
      label: 'Wait',
      labelCn: '观望区',
      color: 'text-orange-500 dark:text-orange-400',
      bgColor: 'bg-orange-50 dark:bg-orange-950/40',
      description: 'Be cautious',
      dot: '●',
      range: '1.2-2.0'
    };
  }
  if (value < 4.0) {
    return {
      zone: 'takeProfit',
      label: 'Take Profit',
      labelCn: '止盈区',
      color: 'text-red-500 dark:text-red-400',
      bgColor: 'bg-red-50 dark:bg-red-950/40',
      description: 'Consider taking profits',
      dot: '●',
      range: '2.0-4.0'
    };
  }
  return {
    zone: 'top',
    label: 'Top',
    labelCn: '逃顶区',
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-950/40',
    description: 'Market top signals',
    dot: '●',
    range: '>4'
  };
}

// Calculate 200-day DCA cost (average of last 200 daily closes)
function calculate200DayCost(prices: number[]): number {
  if (prices.length === 0) return 0;
  const sum = prices.reduce((a, b) => a + b, 0);
  return sum / prices.length;
}

// Calculate growth valuation using Bitcoin's historical growth model
// Based on: 10^(5.84 * log10(days since genesis) - 17.01)
// Genesis block: January 3, 2009
function calculateGrowthValuation(): number {
  const genesisDate = new Date('2009-01-03T00:00:00Z');
  const now = new Date();
  const daysSinceGenesis = Math.floor((now.getTime() - genesisDate.getTime()) / (1000 * 60 * 60 * 24));

  // Power law growth model
  const valuation = Math.pow(10, 5.84 * Math.log10(daysSinceGenesis) - 17.01);
  return valuation;
}

// Fetch BTC historical prices via server-side proxy (avoids CoinGecko rate limits)
async function fetchBTCHistoricalPrices(): Promise<number[]> {
  try {
    const response = await fetch('/api/coingecko?type=history');
    if (!response.ok) {
      console.error(`[AHR999] Failed to fetch BTC historical prices: HTTP ${response.status}`);
      return [];
    }
    const data = await response.json();

    if (data.prices && Array.isArray(data.prices)) {
      return data.prices.map((p: [number, number]) => p[1]);
    }
    return [];
  } catch (error) {
    console.error('[AHR999] Failed to fetch BTC historical prices:', error);
    return [];
  }
}

// Main function to fetch and calculate AHR999
// @param btcPrice - Current BTC price from live ticker data (avoids extra API call)
export async function fetchAHR999Data(btcPrice?: number): Promise<AHR999Data | null> {
  try {
    const historicalPrices = await fetchBTCHistoricalPrices();

    // Use provided price or fallback to latest historical price
    const currentPrice = btcPrice && btcPrice > 0
      ? btcPrice
      : (historicalPrices.length > 0 ? historicalPrices[historicalPrices.length - 1] : null);

    if (!currentPrice || historicalPrices.length === 0) {
      return null;
    }

    // Calculate components
    const dca200Cost = calculate200DayCost(historicalPrices);
    const growthValuation = calculateGrowthValuation();

    // Calculate AHR999
    // AHR999 = (price / dca200Cost) * (price / growthValuation)
    const ahr999 = (currentPrice / dca200Cost) * (currentPrice / growthValuation);

    const zoneInfo = getAHR999ZoneInfo(ahr999);

    return {
      value: ahr999,
      btcPrice: currentPrice,
      dca200Cost,
      growthValuation,
      zone: zoneInfo.zone,
      lastUpdated: Date.now()
    };
  } catch (error) {
    console.error('[AHR999] Failed to calculate:', error);
    return null;
  }
}
