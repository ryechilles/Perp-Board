'use client';

import { useMemo } from 'react';
import { Activity } from 'lucide-react';
import { SmallWidget } from '@/components/widgets/base';
import { TooltipList, TokenAvatar } from '@/components/ui';
import { ProcessedTicker, MAFlowData, MarketCapData, MAValues, ListingData } from '@/lib/types';
import { formatPrice } from '@/lib/utils';
import { MA_FLOW } from '@/lib/constants';

// Minimum listing age in days to be included in MA Flow
const MIN_LISTING_DAYS = 180;
const MIN_LISTING_MS = MIN_LISTING_DAYS * 24 * 60 * 60 * 1000;

// Fixed threshold (no user customization)
const THRESHOLD = MA_FLOW.DEFAULT_THRESHOLD;

// Timeframe sections config with proper types
const TIMEFRAME_SECTIONS: {
  key: string;
  label: string;
  dataKey: 'ma4h' | 'maDaily' | 'maWeekly';
  convergenceKey: 'convergence4h' | 'convergenceDaily' | 'convergenceWeekly';
  color: 'blue' | 'purple' | 'orange';
}[] = [
  { key: '4h', label: '4H', dataKey: 'ma4h', convergenceKey: 'convergence4h', color: 'blue' },
  { key: 'daily', label: 'Daily', dataKey: 'maDaily', convergenceKey: 'convergenceDaily', color: 'purple' },
  { key: 'weekly', label: 'Weekly', dataKey: 'maWeekly', convergenceKey: 'convergenceWeekly', color: 'orange' },
];

// Section dot colors
const DOT_COLORS: Record<string, string> = {
  blue: 'bg-blue-500',
  purple: 'bg-purple-500',
  orange: 'bg-orange-500',
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
  listingData: Map<string, ListingData>;
  onTokenClick?: (symbol: string) => void;
  onGroupClick?: (symbols: string[]) => void;
}

/**
 * Get convergence pill style based on spread %
 */
function getConvergencePillStyle(spread: number): string {
  if (spread <= 0.5) return 'bg-green-500/15 text-green-600';
  if (spread <= 1) return 'bg-emerald-500/15 text-emerald-600';
  if (spread <= 2) return 'bg-teal-500/15 text-teal-600';
  if (spread <= 3) return 'bg-yellow-500/15 text-yellow-700';
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
      className={`flex items-center justify-between mb-3 pb-2 border-b border-gray-950/[0.10] dark:border-white/[0.10] ${
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

// Type-safe accessor for MA values by timeframe key
type MATimeframeKey = 'ma4h' | 'maDaily' | 'maWeekly' | 'maMonthly';
type ConvergenceKey = 'convergence4h' | 'convergenceDaily' | 'convergenceWeekly' | 'convergenceMonthly';

/**
 * Check if all 3 MA values are valid (non-null) for true three-line convergence
 */
function hasValidMAs(maValues: MAValues | null): maValues is MAValues {
  if (!maValues) return false;
  return maValues.ma7 !== null && maValues.ma30 !== null && maValues.ma200 !== null;
}

/**
 * Get converging tokens for a specific timeframe, returning both
 * the display-limited list and the total count (single pass)
 */
function getConvergingTokensWithCount(
  maFlowData: Map<string, MAFlowData>,
  tickers: Map<string, ProcessedTicker>,
  marketCapData: Map<string, MarketCapData>,
  listingData: Map<string, ListingData>,
  dataKey: MATimeframeKey,
  convergenceKey: ConvergenceKey,
): { tokens: ConvergingToken[]; allSymbols: string[]; totalCount: number } {
  const results: ConvergingToken[] = [];
  const now = Date.now();

  maFlowData.forEach((maData, instId) => {
    const convergence = maData[convergenceKey];
    if (convergence === null || convergence > THRESHOLD) return;

    const maValues = maData[dataKey];
    if (!hasValidMAs(maValues)) return;

    const ticker = tickers.get(instId);
    if (!ticker) return;

    // Filter out tokens listed less than 180 days ago
    const listing = listingData.get(instId);
    if (listing && (now - listing.listTime) < MIN_LISTING_MS) return;

    results.push({
      symbol: ticker.baseSymbol,
      instId,
      price: ticker.priceNum,
      convergence,
      logo: marketCapData.get(ticker.baseSymbol)?.logo,
    });
  });

  results.sort((a, b) => a.convergence - b.convergence);
  return {
    tokens: results.slice(0, MA_FLOW.DISPLAY_LIMIT),
    allSymbols: results.map(t => t.symbol),
    totalCount: results.length,
  };
}

export function MAFlowWidget({
  tickers,
  maFlowData,
  marketCapData,
  listingData,
  onTokenClick,
  onGroupClick,
}: MAFlowWidgetProps) {
  // Compute converging tokens + total counts for all 4 timeframes in a single pass
  const sections = useMemo(() => {
    return TIMEFRAME_SECTIONS.map(tf => {
      const { tokens, allSymbols, totalCount } = getConvergingTokensWithCount(
        maFlowData, tickers, marketCapData, listingData, tf.dataKey, tf.convergenceKey
      );
      return { ...tf, tokens, allSymbols, totalCount };
    });
  }, [maFlowData, tickers, marketCapData, listingData]);

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
            'Spread % = (max MA - min MA) / avg(MAs) × 100',
            'Lower spread = tighter convergence = potential breakout',
            `OKX Perp Top 100 by Market Cap (excl. USDC, listed ≥ ${MIN_LISTING_DAYS}d)`,
            <>
              <span className="text-green-500">{'≤ 0.5%'}</span>{' extreme, '}
              <span className="text-emerald-500">{'≤ 1%'}</span>{' tight, '}
              <span className="text-yellow-600">{'≤ 3%'}</span>{' converging'}
            </>,
          ]}
        />
      }
    >
      <div className="space-y-4">
        {sections.map((section) => (
          <div key={section.key}>
            <SectionHeader
              title={section.label}
              count={section.totalCount}
              color={section.color}
              isLoading={isLoading}
              onClick={() => onGroupClick?.(section.allSymbols)}
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
