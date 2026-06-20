'use client';

import { useMemo } from 'react';
import { SmallWidget } from '@/components/widgets/base';
import { TooltipList } from '@/components/ui';
import { ProcessedTicker, FundingRateData, MarketCapData } from '@/lib/types';

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
 * from top 100 perp tokens by market cap
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

    // Sort by market cap (descending) and take top 100 within OKX perp tokens
    const top100 = tickersWithMcap
      .sort((a, b) => b.marketCap - a.marketCap)
      .slice(0, 100);

    const positive: string[] = [];
    const negative: string[] = [];

    top100.forEach((t) => {
      if (t.fundingRate > 0) {
        positive.push(t.symbol);
      } else if (t.fundingRate < 0) {
        negative.push(t.symbol);
      }
    });

    return {
      positiveSymbols: positive,
      negativeSymbols: negative,
      total: top100.length,
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
      title="Funding Market"
      icon={<span>📊</span>}
      subtitle={`${exchangeLabel} Perp Top 100 by Market Cap`}
      loading={isLoading}
      className="group"
      tooltip={
        <TooltipList items={[
          `${exchangeLabel} perp top 100 by market cap`,
          <><span className="text-green-500">Positive</span>: rate &gt; 0 (longs pay shorts)</>,
          <><span className="text-red-500">Negative</span>: rate &lt; 0 (shorts pay longs)</>,
          "USDC/USDT pairs always have 0 funding rate",
        ]} />
      }
    >
      <div className="space-y-4">
        {/* Main Stats */}
        <div className="flex items-center justify-around">
          {/* Positive */}
          <button
            type="button"
            disabled={!(onGroupClick && positiveCount > 0)}
            className="text-center enabled:cursor-pointer enabled:hover:opacity-70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded"
            onClick={() => positiveCount > 0 && onGroupClick?.(positiveSymbols)}
            aria-label={`Positive funding: ${positiveCount}`}
          >
            <div className="text-[28px] font-bold text-green-500">
              {isLoading ? '--' : positiveCount}
            </div>
            <div className="text-[11px] text-muted-foreground">Positive</div>
          </button>

          {/* Divider */}
          <div className="h-12 w-px bg-muted" aria-hidden="true" />

          {/* Negative */}
          <button
            type="button"
            disabled={!(onGroupClick && negativeCount > 0)}
            className="text-center enabled:cursor-pointer enabled:hover:opacity-70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded"
            onClick={() => negativeCount > 0 && onGroupClick?.(negativeSymbols)}
            aria-label={`Negative funding: ${negativeCount}`}
          >
            <div className="text-[28px] font-bold text-red-500">
              {isLoading ? '--' : negativeCount}
            </div>
            <div className="text-[11px] text-muted-foreground">Negative</div>
          </button>
        </div>

        {/* Visual Bar */}
        <div className="h-2 rounded-full bg-muted overflow-hidden flex">
          {total > 0 && (
            <>
              <div
                className="bg-green-500 transition-[width] duration-300"
                style={{ width: `${positivePercent}%` }}
              />
              <div
                className="bg-red-500 transition-[width] duration-300"
                style={{ width: `${negativePercent}%` }}
              />
            </>
          )}
        </div>

      </div>
    </SmallWidget>
  );
}
