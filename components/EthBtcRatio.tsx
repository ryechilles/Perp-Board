'use client';

import { useEffect } from 'react';
import { loadTradingViewMiniChart } from '@/lib/widget-utils';

export function EthBtcRatio() {
  useEffect(() => {
    loadTradingViewMiniChart();
  }, []);

  return (
    <div role="img" aria-label="ETH/BTC ratio mini chart">
      {/* @ts-ignore - TradingView Web Component */}
      <tv-mini-chart symbol="OKX:ETHBTC"></tv-mini-chart>
    </div>
  );
}
