'use client';

import { useMemo } from 'react';
import { Activity } from 'lucide-react';
import { SmallWidget } from '@/components/widgets/base';
import { TooltipList, TokenAvatar } from '@/components/ui';
import { ProcessedTicker, MAFlowData, MarketCapData } from '@/lib/types';
import { formatPrice } from '@/lib/utils';
import { MA_FLOW } from '@/lib/constants';

// Fixed threshold (no user customization)
const THRESHOLD = MA_FLOW.DEFAULT_THRESHOLD;

// Timeframe sections config
const TIMEFRAME_SECTIONS = [
  { key: '4h', label: '4H', dataKey: 'ma4h' as const, convergenceKey: 'convergence4h' as const, color: 'blue' as const },
  { key: 'daily', label: 'Daily', dataKey: 'maDaily' as const, convergenceKey: 'convergenceDaily' as const, color: 'purple' as const },
  { key: 'weekly', label: 'Weekly', dataKey: 'maWeekly' as const, convergenceKey: 'convergenceWeekly' as const, color: 'orange' as const },
  { key: 'monthly', label: 'Monthly', dataKey: 'maMonthly' as const, convergenceKey: 'convergenceMonthly' as const, color: 'pink' as const },
];

// Section dot colors
const DOT_COLORS: Record<string, string> = {
  blue: 'bg-blue-500',
  purple: 'bg-purple-500',
  orange: 'bg-orange-500',
  pink: 'bg-pink-500',
};

interface ConvergingToken {
  symbol: string;
  instId: string;
  price: number;
  convergence: number;
  logo?: string;
}

interface MAFlowWidgetProps {
  tickers: Map<string, ProcessedTicker>;
  maFlowData: Map<string, MAFlowData>;
  marketCapData: Map<string, MarketCapData>;
  onTokenClick?: (symbol: string) => void;
  onGroupClick?: (symbols: string[]) => void;
}

/**
 * Get convergence pill style based on spread %
 */
function getConvergencePillStyle(spread: number): string {
  if (spread <= 1) return 'bg-green-500/15 text-green-600';
  if (spread <= 2) return 'bg-emerald-500/15 text-emerald-600';
  if (spread <= 3) return 'bg-teal-500/15 text-teal-600';
  if (spread <= 5) return 'bg-yellow-500/15 text-yellow-700';
  return 'bg-orange-500/15 text-orange-600';
}

/**
 * Section header matching FundingKiller's KillerSectionHeader pattern
 */
function SectionHeader({
  title,
  count,
  color,
  isLoading,
  onClick,
}: {
  title: string;
  count: number;
  color: string;
  isLoading: boolean;
  onClick?: () => void;
}) {
  const canClick = count > 0 && onClick;

  return (
    <div
      className={`flex items-center justify-between mb-3 pb-2 border-b ${
        canClick ? 'cursor-pointer hover:opacity-80' : ''
      }`}
      onClick={() => canClick && onClick()}
    >
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${DOT_COLORS[color]}`} />
        <span className="text-[12px] font-medium text-foreground">{title}</span>
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {isLoading ? '--' : count}
        </span>
      </div>
    </div>
  );
}

/**
 * Get converging tokens for a specific timeframe
 */
function getConvergingTokens(
  maFlowData: Map<string, MAFlowData>,
  tickers: Map<string, ProcessedTicker>,
  marketCapData: Map<string, MarketCapData>,
  dataKey: keyof MAFlowData,
  convergenceKey: keyof MAFlowData,
): ConvergingToken[] {
  const results: ConvergingToken[] = [];

  maFlowData.forEach((maData, instId) => {
    const ticker = tickers.get(instId);
    if (!ticker) return;

    const convergence = maData[convergenceKey] as number | null;
    if (convergence === null || convergence > THRESHOLD) return;

    const maValues = maData[dataKey] as { ma7: number | null; ma30: number | null; ma200: number | null } | null;
    if (!maValues) return;

    const validCount = [maValues.ma7, maValues.ma30, maValues.ma200].filter(v => v !== null).length;
    if (validCount < 2) return;

    results.push({
      symbol: ticker.baseSymbol,
      instId,
      price: ticker.priceNum,
      convergence,
      logo: marketCapData.get(ticker.baseSymbol)?.logo,
    });
  });

  results.sort((a, b) => a.convergence - b.convergence);
  return results.slice(0, MA_FLOW.DISPLAY_LIMIT);
}

export function MAFlowWidget({
  tickers,
  maFlowData,
  marketCapData,
  onTokenClick,
  onGroupClick,
}: MAFlowWidgetProps) {
  // Compute converging tokens for all 4 timeframes
  const sections = useMemo(() => {
    return TIMEFRAME_SECTIONS.map(tf => ({
      ...tf,
      tokens: getConvergingTokens(maFlowData, tickers, marketCapData, tf.dataKey, tf.convergenceKey),
    }));
  }, [maFlowData, tickers, marketCapData]);

  // Count all converging tokens for each timeframe (before display limit)
  const allCounts = useMemo(() => {
    return TIMEFRAME_SECTIONS.map(tf => {
      let count = 0;
      maFlowData.forEach((maData) => {
        const convergence = maData[tf.convergenceKey] as number | null;
        if (convergence !== null && convergence <= THRESHOLD) {
          const maValues = maData[tf.dataKey] as { ma7: number | null; ma30: number | null; ma200: number | null } | null;
          if (maValues) {
            const validCount = [maValues.ma7, maValues.ma30, maValues.ma200].filter(v => v !== null).length;
            if (validCount >= 2) count++;
          }
        }
      });
      return count;
    });
  }, [maFlowData]);

  const isLoading = tickers.size === 0 || maFlowData.size === 0;

  const renderTokenRow = (token: ConvergingToken, index: number) => (
    <div
      key={token.instId}
      className="flex items-center justify-between py-1.5 cursor-pointer hover:bg-muted/50 rounded -mx-2 px-2"
      onClick={() => onTokenClick?.(token.symbol)}
    >
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-muted-foreground w-4">{index + 1}</span>
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
  );

  return (
    <SmallWidget
      title="MA Flow"
      icon={<Activity className="w-4 h-4" />}
      subtitle={`MA7/30/200 convergence ≤ ${THRESHOLD}%`}
      loading={isLoading}
      tooltip={
        <TooltipList
          items={[
            'Detects three-line convergence (三线粘合)',
            'MA lines: SMA 7, SMA 30, SMA 200',
            `Threshold: spread ≤ ${THRESHOLD}%`,
            'Spread % = (max MA - min MA) / price × 100',
            'Lower spread = tighter convergence = potential breakout',
            'OKX Perp Top 50 by 24h volume',
            <>
              <span className="text-green-500">{'≤ 1%'}</span>{' extreme, '}
              <span className="text-emerald-500">{'≤ 3%'}</span>{' tight, '}
              <span className="text-yellow-600">{'≤ 5%'}</span>{' converging'}
            </>,
          ]}
        />
      }
    >
      <div className="space-y-4">
        {sections.map((section, sIdx) => (
          <div key={section.key}>
            <SectionHeader
              title={section.label}
              count={allCounts[sIdx]}
              color={section.color}
              isLoading={isLoading}
              onClick={() => onGroupClick?.(section.tokens.map(t => t.symbol))}
            />
            <div className="space-y-1">
              {section.tokens.length > 0 ? (
                section.tokens.map((t, i) => renderTokenRow(t, i))
              ) : (
                <div className="text-center py-3 text-[11px] text-muted-foreground">
                  {maFlowData.size > 0
                    ? `No tokens with spread ≤ ${THRESHOLD}%`
                    : 'Loading...'}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </SmallWidget>
  );
}
