'use client';

import { useMemo } from 'react';
import { Figure, Panel, Stat } from '@/components/data';
import { Button, TipBody } from '@/components/ui';
import { ProcessedTicker, FundingRateData, MarketCapData } from '@/lib/types';
import { UNIVERSE } from '@/lib/constants';
import { widgetUniverseNote } from '@/lib/widget-utils';

interface FundingSentimentProps {
  tickers: Map<string, ProcessedTicker>;
  fundingRateData: Map<string, FundingRateData>;
  marketCapData?: Map<string, MarketCapData>;
  onGroupClick?: (symbols: string[]) => void;
  exchangeLabel?: string;
}

/**
 * FundingSentiment - Shows funding rate market sentiment
 *
 * Displays count of positive vs negative funding rates
 * from top N (UNIVERSE.MAX_CRYPTO) perp tokens by market cap
 */
export function FundingSentiment({
  tickers,
  fundingRateData,
  marketCapData,
  onGroupClick,
  exchangeLabel = 'OKX',
}: FundingSentimentProps) {
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
    <Panel
      title="Funding Sentiment"
      note={`Top ${UNIVERSE.MAX_CRYPTO}`}
      loading={isLoading}
      info={
        <TipBody
          title="How many perps have positive vs negative funding"
          items={[
            widgetUniverseNote(exchangeLabel),
            'Positive: longs pay shorts · Negative: shorts pay longs',
            'Click a number to show that group in the table',
          ]}
        />
      }
    >
      <div className="flex flex-col gap-3">
        {/* Split bar */}
        <div className="flex h-1 gap-px overflow-hidden rounded-full" aria-hidden="true">
          {total > 0 ? (
            <>
              <span className="bg-up transition-[flex-grow] duration-300" style={{ flexGrow: positivePercent }} />
              <span className="bg-track transition-[flex-grow] duration-300" style={{ flexGrow: Math.max(0, 100 - positivePercent - negativePercent) }} />
              <span className="bg-down transition-[flex-grow] duration-300" style={{ flexGrow: negativePercent }} />
            </>
          ) : (
            <span className="flex-1 bg-track" />
          )}
        </div>

        <div className="flex items-start justify-between">
          <Button
            variant="bare"
            disabled={!(onGroupClick && positiveCount > 0)}
            className="rounded-control text-left transition-opacity enabled:hover:opacity-70"
            onClick={() => onGroupClick?.(positiveSymbols)}
            aria-label={`Show ${positiveCount} tokens with positive funding`}
          >
            <Stat size="display" value={<Figure tone="up">{positiveCount}</Figure>} label="Positive · longs pay" />
          </Button>
          <Button
            variant="bare"
            disabled={!(onGroupClick && negativeCount > 0)}
            className="rounded-control transition-opacity enabled:hover:opacity-70"
            onClick={() => onGroupClick?.(negativeSymbols)}
            aria-label={`Show ${negativeCount} tokens with negative funding`}
          >
            <Stat size="display" align="right" value={<Figure tone="down">{negativeCount}</Figure>} label="Negative · shorts pay" />
          </Button>
        </div>
      </div>
    </Panel>
  );
}
