'use client';

import { useMemo } from 'react';
import { SmallWidget } from '@/components/widgets/base';
import { TooltipList } from '@/components/ui';
import { ProcessedTicker, FundingRateData, MarketCapData } from '@/lib/types';
import { UNIVERSE } from '@/lib/constants';

interface FundingMarketProps {
  tickers: Map<string, ProcessedTicker>;
  fundingRateData: Map<string, FundingRateData>;
  marketCapData?: Map<string, MarketCapData>;
  onGroupClick?: (symbols: string[]) => void;
  exchangeLabel?: string;
}

/**
 * FundingMarket - Shows funding rate market sentiment
 *
 * Displays count of positive vs negative funding rates
 * from top N (UNIVERSE.MAX_CRYPTO) perp tokens by market cap
 */
export function FundingMarket({
  tickers,
  fundingRateData,
  marketCapData,
  onGroupClick,
  exchangeLabel = 'OKX',
}: FundingMarketProps) {
  const { positiveSymbols, negativeSymbols, total } = useMemo(() => {
    // Get all OKX perp tickers with market cap and funding rate
    const tickersWithMcap: Array<{
      instId: string;
      symbol: string;
      marketCap: number;
      fundingRate: number;
    }> = [];

    tickers.forEach((ticker, instId) => {
      const mc = marketCapData?.get(ticker.baseSymbol);
      const fr = fundingRateData.get(instId);

      if (mc && mc.marketCap && fr) {
        tickersWithMcap.push({
          instId,
          symbol: ticker.baseSymbol,
          marketCap: mc.marketCap,
          fundingRate: fr.fundingRate,
        });
      }
    });

    // Sort by market cap (descending) and take top N within OKX perp tokens
    const topN = tickersWithMcap
      .sort((a, b) => b.marketCap - a.marketCap)
      .slice(0, UNIVERSE.MAX_CRYPTO);

    const positive: string[] = [];
    const negative: string[] = [];

    topN.forEach((t) => {
      if (t.fundingRate > 0) {
        positive.push(t.symbol);
      } else if (t.fundingRate < 0) {
        negative.push(t.symbol);
      }
    });

    return {
      positiveSymbols: positive,
      negativeSymbols: negative,
      total: topN.length,
    };
  }, [tickers, fundingRateData, marketCapData]);

  const positiveCount = positiveSymbols.length;
  const negativeCount = negativeSymbols.length;

  const isLoading = tickers.size === 0;

  // Calculate percentages for the bar
  const positivePercent = total > 0 ? (positiveCount / total) * 100 : 0;
  const negativePercent = total > 0 ? (negativeCount / total) * 100 : 0;

  return (
    <SmallWidget
      title="Funding Sentiment"
      subtitle={`Top ${UNIVERSE.MAX_CRYPTO} ${exchangeLabel} perps by market cap`}
      loading={isLoading}
      tooltip={
        <TooltipList items={[
          `${exchangeLabel} perp top ${UNIVERSE.MAX_CRYPTO} by market cap`,
          <><span className="text-up-ink">Positive</span>: rate &gt; 0 (longs pay shorts)</>,
          <><span className="text-down-ink">Negative</span>: rate &lt; 0 (shorts pay longs)</>,
          "USDC/USDT pairs always have 0 funding rate",
          "Tap a number to show that group in the table",
        ]} />
      }
    >
      {/* Split bar */}
      <div className="flex gap-0.5 h-2 mb-3" aria-hidden="true">
        {total > 0 ? (
          <>
            <span className="bg-up rounded-l-full rounded-r-[2px] transition-[flex-grow] duration-300" style={{ flexGrow: positivePercent }} />
            <span className="bg-zone-neutral rounded-[2px] transition-[flex-grow] duration-300" style={{ flexGrow: Math.max(0, 100 - positivePercent - negativePercent) }} />
            <span className="bg-down rounded-r-full rounded-l-[2px] transition-[flex-grow] duration-300" style={{ flexGrow: negativePercent }} />
          </>
        ) : (
          <span className="flex-1 bg-fill rounded-full" />
        )}
      </div>

      <div className="flex items-end justify-between">
        <button
          type="button"
          disabled={!(onGroupClick && positiveCount > 0)}
          className="flex flex-col items-start rounded-lg enabled:hover:opacity-70 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40 transition-opacity"
          onClick={() => positiveCount > 0 && onGroupClick?.(positiveSymbols)}
          aria-label={`Show ${positiveCount} tokens with positive funding`}
        >
          <span className="text-[1.75rem] leading-tight font-semibold tracking-[-0.025em] tabular-nums text-up-ink">
            {isLoading ? '--' : positiveCount}
          </span>
          <span className="text-xs text-muted-foreground">Positive · longs pay</span>
        </button>

        <button
          type="button"
          disabled={!(onGroupClick && negativeCount > 0)}
          className="flex flex-col items-end rounded-lg enabled:hover:opacity-70 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40 transition-opacity"
          onClick={() => negativeCount > 0 && onGroupClick?.(negativeSymbols)}
          aria-label={`Show ${negativeCount} tokens with negative funding`}
        >
          <span className="text-[1.75rem] leading-tight font-semibold tracking-[-0.025em] tabular-nums text-down-ink">
            {isLoading ? '--' : negativeCount}
          </span>
          <span className="text-xs text-muted-foreground">Negative · shorts pay</span>
        </button>
      </div>
    </SmallWidget>
  );
}
