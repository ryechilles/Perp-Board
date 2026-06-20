'use client';

import { useEffect } from 'react';
import { loadTradingViewMiniChart } from '@/lib/widget-utils';

export function Total2MiniChart() {
  useEffect(() => {
    loadTradingViewMiniChart();
  }, []);

  return (
    <div role="img" aria-label="TOTAL2 (altcoin market cap) mini chart" className="min-h-[120px]">
      {/* @ts-ignore - TradingView Web Component */}
      <tv-mini-chart symbol="CRYPTOCAP:TOTAL2"></tv-mini-chart>
    </div>
  );
}
