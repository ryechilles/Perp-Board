'use client';

import { useEffect, useRef } from 'react';
import { loadTradingViewMiniChart } from '@/lib/widget-utils';

export function BTCDominance() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    loadTradingViewMiniChart();
  }, []);

  return (
    <div ref={containerRef}>
      {/* @ts-ignore - TradingView Web Component */}
      <tv-mini-chart symbol="CRYPTOCAP:BTC.D"></tv-mini-chart>
    </div>
  );
}
