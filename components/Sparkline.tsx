'use client';

import { useId } from 'react';
import { cn } from '@/lib/utils';
import { formatSignedPercent } from '@/components/ui/Metrics';

interface SparklineProps {
  data?: number[];       // Real price data array
  change: number;        // Percentage change for color
  width?: number;
  height?: number;
  className?: string;
}

/**
 * Mini sparkline chart showing price trend
 * Uses real price data when available, otherwise generates simulated data
 */
export function Sparkline({ data, change, width = 64, height = 24, className = '' }: SparklineProps) {
  const isPositive = change >= 0;
  const gradientId = `sparkline-gradient-${useId()}`;

  // Generate points from real data or simulated data
  const generatePoints = (): { line: string; area: string; end: [number, number] } => {
    let prices: number[];

    if (data && data.length >= 2) {
      // Use real data - sample evenly if too many points
      const targetPoints = 24; // ~24 points for smooth but detailed line
      if (data.length > targetPoints) {
        const step = Math.floor(data.length / targetPoints);
        prices = [];
        for (let i = 0; i < data.length; i += step) {
          prices.push(data[i]);
        }
        // Always include the last point
        if (prices[prices.length - 1] !== data[data.length - 1]) {
          prices.push(data[data.length - 1]);
        }
      } else {
        prices = [...data];
      }
    } else {
      // Generate simulated data based on change
      prices = generateSimulatedData(change);
    }

    // Normalize prices to fit in SVG
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice || 1;

    const padding = 3;
    const chartHeight = height - padding * 2;
    const inset = 2.5; // room for the endpoint dot
    const chartWidth = width - inset * 2;

    const points: [number, number][] = prices.map((price, i) => {
      const x = inset + (i / (prices.length - 1)) * chartWidth;
      const y = padding + chartHeight - ((price - minPrice) / priceRange) * chartHeight;
      return [x, y];
    });

    // Create line path
    const linePath = points.map(([x, y], i) =>
      `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)},${y.toFixed(1)}`
    ).join(' ');

    // Create area path (for gradient fill)
    const last = points[points.length - 1];
    const areaPath = linePath +
      ` L ${last[0].toFixed(1)},${height} L ${points[0][0].toFixed(1)},${height} Z`;

    return { line: linePath, area: areaPath, end: last };
  };

  // Generate simulated price data based on change percentage
  const generateSimulatedData = (changePercent: number): number[] => {
    const points: number[] = [];
    const numPoints = 24;
    const seed = Math.abs(changePercent * 1000) % 1000;

    // Seeded random function
    const seededRandom = (i: number): number => {
      const x = Math.sin(seed + i * 127.1) * 43758.5453;
      return x - Math.floor(x);
    };

    const startPrice = 100;
    const endPrice = startPrice * (1 + changePercent / 100);

    let price = startPrice;
    for (let i = 0; i < numPoints; i++) {
      const progress = i / (numPoints - 1);
      const targetPrice = startPrice + (endPrice - startPrice) * progress;

      // Add volatility
      const volatility = (seededRandom(i) - 0.5) * 5;
      price = price * 0.3 + (targetPrice + volatility) * 0.7;

      points.push(price);
    }

    return points;
  };

  const { line, area, end } = generatePoints();

  return (
    <svg
      width={width}
      height={height}
      className={cn(isPositive ? 'text-up-ink' : 'text-down-ink', className)}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <path
        d={line}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={end[0]} cy={end[1]} r="2.2" fill="currentColor" />
    </svg>
  );
}

interface SparklineChangeProps {
  change: number | null | undefined;
  sparklineData?: number[];
}

/** Sparkline followed by the signed percentage (right-aligned table cell). */
export function SparklineChange({ change, sparklineData }: SparklineChangeProps) {
  if (change === null || change === undefined) {
    return <span className="text-faint">—</span>;
  }
  return (
    <span className="inline-flex items-center gap-2.5">
      <Sparkline data={sparklineData} change={change} />
      <span className={`min-w-[52px] text-right text-[0.78rem] font-medium tabular-nums ${change >= 0 ? 'text-up-ink' : 'text-down-ink'}`}>
        {formatSignedPercent(change)}
      </span>
    </span>
  );
}
