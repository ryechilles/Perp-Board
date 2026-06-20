'use client';

import { useId } from 'react';

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
export function Sparkline({ data, change, width = 50, height = 20, className = '' }: SparklineProps) {
  const isPositive = change >= 0;
  const color = isPositive ? '#22c55e' : '#ef4444'; // green-500 / red-500
  const gradientId = `sparkline-gradient-${useId()}`;

  // Generate points from real data or simulated data
  const generatePoints = (): { line: string; area: string } => {
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

    const padding = 2;
    const chartHeight = height - padding * 2;
    const chartWidth = width;

    const points: [number, number][] = prices.map((price, i) => {
      const x = (i / (prices.length - 1)) * chartWidth;
      const y = padding + chartHeight - ((price - minPrice) / priceRange) * chartHeight;
      return [x, y];
    });

    // Create line path
    const linePath = points.map(([x, y], i) =>
      `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)},${y.toFixed(1)}`
    ).join(' ');

    // Create area path (for gradient fill)
    const areaPath = linePath +
      ` L ${width},${height} L 0,${height} Z`;

    return { line: linePath, area: areaPath };
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

  const { line, area } = generatePoints();

  return (
    <svg
      width={width}
      height={height}
      className={className}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
    >
      {/* Gradient definition for shadow/fill effect */}
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Area fill with gradient */}
      <path
        d={area}
        fill={`url(#${gradientId})`}
      />

      {/* Line stroke */}
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface ChangeWithSparklineProps {
  change: number | null | undefined;
  sparklineData?: number[];
  showSparkline?: boolean;
}

/**
 * Change percentage display with optional sparkline
 */
export function ChangeWithSparkline({ change, sparklineData, showSparkline = true }: ChangeWithSparklineProps) {
  if (change === null || change === undefined) {
    return <span className="text-muted-foreground">-</span>;
  }

  const isPositive = change >= 0;
  const colorClass = isPositive ? 'text-green-500' : 'text-red-500';
  const arrow = isPositive ? '▲' : '▼';

  return (
    <div className="flex flex-col items-center gap-0.5">
      {showSparkline && (
        <Sparkline data={sparklineData} change={change} width={45} height={16} />
      )}
      <span className={`${colorClass} font-medium tabular-nums text-[12px]`}>
        {arrow} {Math.abs(change).toFixed(2)}%
      </span>
    </div>
  );
}
