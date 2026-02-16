'use client';

import { useMemo } from 'react';
import { Activity } from 'lucide-react';
import { SmallWidget } from '@/components/widgets/base';
import { TooltipList, TokenAvatar } from '@/components/ui';
import { ProcessedTicker, MAFlowData, MarketCapData } from '@/lib/types';
import { formatPrice } from '@/lib/utils';
import { MA_FLOW } from '@/lib/constants';

// Timeframe display config
const TIMEFRAME_CONFIG: Record<string, { label: string; bar: string; dataKey: keyof MAFlowData; convergenceKey: keyof MAFlowData }> = {
  '4h': { label: '4H', bar: '4H', dataKey: 'ma4h', convergenceKey: 'convergence4h' },
  daily: { label: 'Daily', bar: '1D', dataKey: 'maDaily', convergenceKey: 'convergenceDaily' },
  weekly: { label: 'Weekly', bar: '1W', dataKey: 'maWeekly', convergenceKey: 'convergenceWeekly' },
  monthly: { label: 'Monthly', bar: '1M', dataKey: 'maMonthly', convergenceKey: 'convergenceMonthly' },
};

interface MAFlowWidgetProps {
  timeframe: '4h' | 'daily' | 'weekly' | 'monthly';
  tickers: Map<string, ProcessedTicker>;
  maFlowData: Map<string, MAFlowData>;
  marketCapData: Map<string, MarketCapData>;
  threshold: number;
  onTokenClick?: (symbol: string) => void;
}

/**
 * Get convergence pill style based on spread %
 */
function getConvergencePillStyle(spread: number): string {
  if (spread <= 1) return 'bg-green-500/15 text-green-600';
  if (spread <= 2) return 'bg-emerald-500/15 text-emerald-600';
  if (spread <= 3) return 'bg-teal-500/15 text-teal-600';
  if (spread <= 5) return 'bg-yellow-500/15 text-yellow-700';
  if (spread <= 7) return 'bg-orange-500/15 text-orange-600';
  return 'bg-red-500/15 text-red-600';
}

export function MAFlowWidget({
  timeframe,
  tickers,
  maFlowData,
  marketCapData,
  threshold,
  onTokenClick,
}: MAFlowWidgetProps) {
  const config = TIMEFRAME_CONFIG[timeframe];

  const convergingTokens = useMemo(() => {
    const results: {
      symbol: string;
      instId: string;
      price: number;
      convergence: number;
      ma7: number | null;
      ma30: number | null;
      ma200: number | null;
      logo?: string;
    }[] = [];

    maFlowData.forEach((maData, instId) => {
      const ticker = tickers.get(instId);
      if (!ticker) return;

      const convergence = maData[config.convergenceKey] as number | null;
      if (convergence === null || convergence > threshold) return;

      const maValues = maData[config.dataKey] as { ma7: number | null; ma30: number | null; ma200: number | null } | null;
      if (!maValues) return;

      // Need at least 2 valid MAs
      const validCount = [maValues.ma7, maValues.ma30, maValues.ma200].filter(v => v !== null).length;
      if (validCount < 2) return;

      const logo = marketCapData.get(ticker.baseSymbol)?.logo;

      results.push({
        symbol: ticker.baseSymbol,
        instId,
        price: ticker.priceNum,
        convergence,
        ma7: maValues.ma7,
        ma30: maValues.ma30,
        ma200: maValues.ma200,
        logo,
      });
    });

    // Sort by convergence (tightest first)
    results.sort((a, b) => a.convergence - b.convergence);

    return results.slice(0, MA_FLOW.DISPLAY_LIMIT);
  }, [maFlowData, tickers, marketCapData, threshold, config]);

  const isLoading = tickers.size === 0 || maFlowData.size === 0;

  return (
    <SmallWidget
      title={`${config.label} MA Flow`}
      icon={<Activity className="w-4 h-4" />}
      subtitle={`MA7/30/200 spread ≤ ${threshold}%`}
      loading={isLoading}
      tooltip={
        <TooltipList
          items={[
            'Detects three-line convergence (三线粘合)',
            `Timeframe: ${config.label} candles`,
            'MA lines: SMA 7, SMA 30, SMA 200',
            'Spread % = (max MA - min MA) / price × 100',
            'Lower spread = tighter convergence = potential breakout',
            <>
              <span className="text-green-500">{'≤ 1%'}</span>{' = extreme convergence, '}
              <span className="text-yellow-600">{'≤ 5%'}</span>{' = converging'}
            </>,
          ]}
        />
      }
    >
      <div className="space-y-1">
        {isLoading ? (
          [1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between py-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground w-4">{i}</span>
                <div className="w-5 h-5 rounded-full bg-muted animate-pulse" />
                <div className="w-10 h-3 bg-muted rounded animate-pulse" />
              </div>
              <div className="flex items-center gap-3">
                <div className="w-12 h-3 bg-muted rounded animate-pulse" />
                <div className="w-12 h-5 bg-muted rounded-md animate-pulse" />
              </div>
            </div>
          ))
        ) : convergingTokens.length > 0 ? (
          convergingTokens.map((token, i) => (
            <div
              key={token.instId}
              className="flex items-center justify-between py-1.5 cursor-pointer hover:bg-muted/50 rounded -mx-2 px-2"
              onClick={() => onTokenClick?.(token.symbol)}
            >
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground w-4">{i + 1}</span>
                <TokenAvatar symbol={token.symbol} logo={token.logo} />
                <span className="text-[12px] font-medium text-foreground">{token.symbol}</span>
              </div>
              <div className="flex items-center">
                <span className="text-[11px] text-muted-foreground tabular-nums w-16 text-center">
                  {formatPrice(token.price)}
                </span>
                <span
                  className={`text-[11px] font-semibold tabular-nums w-14 text-center py-0.5 rounded-md ${getConvergencePillStyle(token.convergence)}`}
                >
                  {token.convergence.toFixed(1)}%
                </span>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-4 text-[11px] text-muted-foreground">
            {maFlowData.size > 0
              ? `No tokens with spread ≤ ${threshold}%`
              : 'Loading MA data...'}
          </div>
        )}
      </div>
    </SmallWidget>
  );
}
