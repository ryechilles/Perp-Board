'use client';

import { useMemo } from 'react';
import { SmallWidget, TokenList, TokenListRow, SectionLabel } from '@/components/widgets/base';
import { TooltipList } from '@/components/ui';
import { ProcessedTicker, MAFlowData, MarketCapData, MAValues, ListingData } from '@/lib/types';
import { formatPrice } from '@/lib/utils';
import { MA_FLOW } from '@/lib/constants';
import { widgetUniverseNote } from '@/lib/widget-utils';

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
  blue: 'bg-tint',
  purple: 'bg-[#AF52DE]',
  orange: 'bg-hot',
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
  if (spread <= 0.5) return 'bg-up/[0.18] text-up-ink';
  if (spread <= 1) return 'bg-up/[0.1] text-up-ink';
  if (spread <= 2) return 'bg-fill text-foreground';
  return 'bg-fill text-muted-foreground';
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

  return (
    <SmallWidget
      title="MA Flow"
      subtitle={`MA7/30/200 convergence ≤ ${THRESHOLD}%`}
      padded={false}
      loading={isLoading}
      tooltip={
        <TooltipList
          items={[
            'Detects three-line convergence (三线粘合)',
            'MA lines: SMA 7, SMA 30, SMA 200',
            `Threshold: spread ≤ ${THRESHOLD}%`,
            'Spread % = (max MA - min MA) / avg(MAs) × 100',
            'Lower spread = tighter convergence = potential breakout',
            widgetUniverseNote('OKX'),
            `Listed ≥ ${MIN_LISTING_DAYS} days (MA200 needs the history)`,
            <>
              <span className="text-up-ink font-semibold">{'≤ 0.5%'}</span>{' extreme, '}
              <span className="text-up-ink">{'≤ 1%'}</span>{' tight, '}
              <span className="text-foreground">{'≤ 3%'}</span>{' converging'}
            </>,
          ]}
        />
      }
    >
      {sections.map((section) => (
        <div key={section.key}>
          <SectionLabel
            label={section.label}
            dot={DOT_COLORS[section.color]}
            count={isLoading ? '--' : section.totalCount}
            onClick={section.totalCount > 0 && onGroupClick ? () => onGroupClick(section.allSymbols) : undefined}
          />
          {section.tokens.length > 0 ? (
            <TokenList>
              {section.tokens.map((token) => (
                <TokenListRow
                  key={token.instId}
                  symbol={token.symbol}
                  logo={token.logo}
                  detail={formatPrice(token.price)}
                  value={
                    <span className={`inline-flex items-center justify-center min-w-[48px] h-[22px] px-1.5 rounded-md text-xs font-semibold ${getConvergencePillStyle(token.convergence)}`}>
                      {token.convergence.toFixed(1)}%
                    </span>
                  }
                  onClick={() => onTokenClick?.(token.symbol)}
                />
              ))}
            </TokenList>
          ) : (
            <div className="px-4 pt-1 pb-3 text-xs text-faint">
              {maFlowData.size > 0 ? `No tokens with spread ≤ ${THRESHOLD}%` : 'Loading…'}
            </div>
          )}
        </div>
      ))}
    </SmallWidget>
  );
}
