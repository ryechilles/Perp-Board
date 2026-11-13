'use client';

import { useEffect } from 'react';
import { loadTradingViewMiniChart } from '@/lib/widget-utils';

interface MiniChartProps {
  /** TradingView symbol, e.g. "CRYPTOCAP:BTC.D" */
  symbol: string;
  /** Accessible description of the chart */
  label: string;
}

/** A TradingView mini chart, framed as a sidebar block. */
export function MiniChart({ symbol, label }: MiniChartProps) {
  useEffect(() => {
    loadTradingViewMiniChart();
  }, []);

  return (
    <div role="img" aria-label={label} className="min-h-32 overflow-hidden rule-b">
      {/* @ts-expect-error - TradingView Web Component */}
      <tv-mini-chart symbol={symbol}></tv-mini-chart>
    </div>
  );
}
