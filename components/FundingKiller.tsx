'use client';

import { useMemo } from 'react';
import { SmallWidget, TokenList, TokenListRow, SectionLabel } from '@/components/widgets/base';
import { TooltipList } from '@/components/ui';
import { ProcessedTicker, FundingRateData, MarketCapData, TokenWithApr } from '@/lib/types';
import { formatPrice } from '@/lib/utils';
import { calculateFundingApr, widgetUniverseNote } from '@/lib/widget-utils';
import { FUNDING, WIDGET } from '@/lib/constants';

interface FundingKillerProps {
  tickers: Map<string, ProcessedTicker>;
  fundingRateData: Map<string, FundingRateData>;
  marketCapData?: Map<string, MarketCapData>;
  onTokenClick?: (symbol: string) => void;
  onGroupClick?: (symbols: string[]) => void;
  exchangeLabel?: string;
}

export function FundingKiller({
  tickers,
  fundingRateData,
  marketCapData,
  onTokenClick,
  onGroupClick,
  exchangeLabel = 'OKX',
}: FundingKillerProps) {
  const { longKillers, shortKillers } = useMemo(() => {
    const tokensWithApr: TokenWithApr[] = [];

    tickers.forEach((ticker, instId) => {
      const fr = fundingRateData.get(instId);
      if (!fr) return;

      const apr = calculateFundingApr(fr.fundingRate, fr.settlementInterval);
      const mc = marketCapData?.get(ticker.baseSymbol);
      tokensWithApr.push({
        symbol: ticker.baseSymbol,
        instId,
        apr,
        price: ticker.priceNum,
        logo: mc?.logo,
      });
    });

    const threshold = FUNDING.KILLER_APR_THRESHOLD;
    return {
      longKillers: tokensWithApr.filter(t => t.apr > threshold).sort((a, b) => b.apr - a.apr),
      shortKillers: tokensWithApr.filter(t => t.apr < -threshold).sort((a, b) => a.apr - b.apr),
    };
  }, [tickers, fundingRateData, marketCapData]);

  const displayLongKillers = longKillers.slice(0, WIDGET.DISPLAY_LIMIT);
  const displayShortKillers = shortKillers.slice(0, WIDGET.DISPLAY_LIMIT);
  const isLoading = tickers.size === 0;

  const aprThreshold = FUNDING.KILLER_APR_THRESHOLD;

  const renderSection = (
    title: string,
    dot: string,
    all: TokenWithApr[],
    shown: TokenWithApr[],
    inkClass: string,
    emptyText: string
  ) => (
    <div>
      <SectionLabel
        label={title}
        dot={dot}
        count={isLoading ? '--' : all.length}
        onClick={all.length > 0 && onGroupClick ? () => onGroupClick(all.map(t => t.symbol)) : undefined}
      />
      {shown.length > 0 ? (
        <TokenList>
          {shown.map((token) => (
            <TokenListRow
              key={token.instId}
              symbol={token.symbol}
              logo={token.logo}
              detail={formatPrice(token.price)}
              value={
                <span className={`text-[0.8125rem] font-semibold ${inkClass}`}>
                  {token.apr > 0 ? '+' : token.apr < 0 ? '−' : ''}{Math.abs(token.apr).toFixed(1)}%
                </span>
              }
              onClick={() => onTokenClick?.(token.symbol)}
            />
          ))}
        </TokenList>
      ) : (
        <div className="px-4 pt-1 pb-3 text-xs text-faint">{emptyText}</div>
      )}
    </div>
  );

  return (
    <SmallWidget
      title="Funding Killer"
      subtitle={`Annualized funding beyond ±${aprThreshold}%`}
      padded={false}
      loading={isLoading}
      tooltip={
        <TooltipList items={[
          widgetUniverseNote(exchangeLabel),
          <><span className="text-up-ink">Long Killer</span>: APR &gt; {aprThreshold}% (expensive to hold longs)</>,
          <><span className="text-down-ink">Short Killer</span>: APR &lt; -{aprThreshold}% (expensive to hold shorts)</>,
          "APR = Funding Rate × (365 × 24 / interval)",
        ]} />
      }
    >
      {renderSection('Long Killer', 'bg-up', longKillers, displayLongKillers, 'text-up-ink', `No tokens above +${aprThreshold}% APR`)}
      {renderSection('Short Killer', 'bg-down', shortKillers, displayShortKillers, 'text-down-ink', `No tokens below −${aprThreshold}% APR`)}
    </SmallWidget>
  );
}
