'use client';

import { useMemo } from 'react';
import { EmptyLine, Figure, List, ListHeading, ListRow, Panel, Price } from '@/components/data';
import { TipBody } from '@/components/ui';
import { ProcessedTicker, MAFlowData, MarketCapData, MAValues, ListingData } from '@/lib/types';
import { MA_FLOW } from '@/lib/constants';
import { widgetUniverseNote } from '@/lib/widget-utils';

// Minimum listing age in days to be included in MA Flow
const MIN_LISTING_DAYS = 180;
const MIN_LISTING_MS = MIN_LISTING_DAYS * 24 * 60 * 60 * 1000;

// Fixed threshold (no user customization)
const THRESHOLD = MA_FLOW.DEFAULT_THRESHOLD;

// Timeframe sections
const TIMEFRAME_SECTIONS: {
  key: string;
  label: string;
  dataKey: 'ma4h' | 'maDaily' | 'maWeekly';
  convergenceKey: 'convergence4h' | 'convergenceDaily' | 'convergenceWeekly';
}[] = [
  { key: '4h', label: '4H', dataKey: 'ma4h', convergenceKey: 'convergence4h' },
  { key: 'daily', label: 'Daily', dataKey: 'maDaily', convergenceKey: 'convergenceDaily' },
  { key: 'weekly', label: 'Weekly', dataKey: 'maWeekly', convergenceKey: 'convergenceWeekly' },
];

/** A spread this tight is the signal; wider ones are context. */
const TIGHT_SPREAD = 1;

interface ConvergingToken {
  symbol: string;
  instId: string;
  price: number;
  convergence: number;
  logo?: string;
}

interface MaFlowProps {
  tickers: Map<string, ProcessedTicker>;
  maFlowData: Map<string, MAFlowData>;
  marketCapData: Map<string, MarketCapData>;
  listingData: Map<string, ListingData>;
  onTokenClick?: (symbol: string) => void;
  onGroupClick?: (symbols: string[]) => void;
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

/** Tokens whose 7 / 30 / 200 moving averages have converged, per time frame. */
export function MaFlow({
  tickers,
  maFlowData,
  marketCapData,
  listingData,
  onTokenClick,
  onGroupClick,
}: MaFlowProps) {
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
    <Panel
      title="MA Flow"
      note={`Spread ≤ ${THRESHOLD}%`}
      flush
      loading={isLoading}
      info={
        <TipBody
          title="Three-line convergence of SMA 7, 30 and 200"
          items={[
            'Spread % = (max MA − min MA) / avg(MAs) × 100',
            'Lower spread = tighter convergence = potential breakout',
            widgetUniverseNote('OKX'),
            `Listed ≥ ${MIN_LISTING_DAYS} days (MA200 needs the history)`,
          ]}
        />
      }
    >
      {sections.map((section) => (
        <div key={section.key}>
          <ListHeading
            label={section.label}
            count={isLoading ? '—' : section.totalCount}
            onClick={section.totalCount > 0 && onGroupClick ? () => onGroupClick(section.allSymbols) : undefined}
          />
          {section.tokens.length > 0 ? (
            <List>
              {section.tokens.map((token) => (
                <ListRow
                  key={token.instId}
                  symbol={token.symbol}
                  logo={token.logo}
                  detail={<Price value={token.price} />}
                  value={
                    <Figure tone={token.convergence <= TIGHT_SPREAD ? 'up' : 'neutral'} className={token.convergence <= TIGHT_SPREAD ? 'font-medium' : 'text-fg-muted'}>
                      {token.convergence.toFixed(1)}
                      <span className="num-dim-tone">%</span>
                    </Figure>
                  }
                  onClick={() => onTokenClick?.(token.symbol)}
                />
              ))}
            </List>
          ) : (
            <EmptyLine>{maFlowData.size > 0 ? `No tokens with spread ≤ ${THRESHOLD}%` : 'Loading…'}</EmptyLine>
          )}
        </div>
      ))}
    </Panel>
  );
}
