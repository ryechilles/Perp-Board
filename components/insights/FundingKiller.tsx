'use client';

import { useMemo } from 'react';
import { EmptyLine, List, ListHeading, ListRow, Panel, Percent, Price } from '@/components/data';
import { TipBody } from '@/components/ui';
import type { Tone } from '@/lib/format';
import { ProcessedTicker, FundingRateData, MarketCapData, TokenWithApr } from '@/lib/types';
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

  const renderSection = (title: string, tone: Tone, all: TokenWithApr[], shown: TokenWithApr[], emptyText: string) => (
    <div>
      <ListHeading
        label={title}
        dot={tone}
        count={isLoading ? '—' : all.length}
        onClick={all.length > 0 && onGroupClick ? () => onGroupClick(all.map((t) => t.symbol)) : undefined}
      />
      {shown.length > 0 ? (
        <List>
          {shown.map((token) => (
            <ListRow
              key={token.instId}
              symbol={token.symbol}
              logo={token.logo}
              detail={<Price value={token.price} />}
              value={<Percent value={token.apr} decimals={1} tone={tone} className="font-medium" />}
              onClick={() => onTokenClick?.(token.symbol)}
            />
          ))}
        </List>
      ) : (
        <EmptyLine>{emptyText}</EmptyLine>
      )}
    </div>
  );

  return (
    <Panel
      title="Funding Killer"
      note={`Beyond ±${aprThreshold}% APR`}
      flush
      loading={isLoading}
      info={
        <TipBody
          title="APR = funding rate × (365 × 24 / interval)"
          items={[
            widgetUniverseNote(exchangeLabel),
            `Long Killer: APR > ${aprThreshold}% — expensive to hold longs`,
            `Short Killer: APR < −${aprThreshold}% — expensive to hold shorts`,
          ]}
        />
      }
    >
      {renderSection('Long Killer', 'up', longKillers, displayLongKillers, `No tokens above +${aprThreshold}% APR`)}
      {renderSection('Short Killer', 'down', shortKillers, displayShortKillers, `No tokens below −${aprThreshold}% APR`)}
    </Panel>
  );
}
