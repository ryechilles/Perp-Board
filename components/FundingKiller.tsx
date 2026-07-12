'use client';

import { useMemo } from 'react';
import { SmallWidget } from '@/components/widgets/base';
import { TooltipList, TokenAvatar } from '@/components/ui';
import { ProcessedTicker, FundingRateData, MarketCapData, TokenWithApr } from '@/lib/types';
import { formatPrice } from '@/lib/utils';
import { calculateFundingApr } from '@/lib/widget-utils';
import { FUNDING, WIDGET } from '@/lib/constants';

interface FundingKillerProps {
  tickers: Map<string, ProcessedTicker>;
  fundingRateData: Map<string, FundingRateData>;
  marketCapData?: Map<string, MarketCapData>;
  onTokenClick?: (symbol: string) => void;
  onGroupClick?: (symbols: string[]) => void;
  exchangeLabel?: string;
}

// Section header component
function KillerSectionHeader({
  title,
  count,
  color,
  isLoading,
  onClick,
}: {
  title: string;
  count: number;
  color: 'green' | 'red';
  isLoading: boolean;
  onClick?: () => void;
}) {
  const dotColor = color === 'green' ? 'bg-green-500' : 'bg-red-500';
  const canClick = count > 0 && onClick;
  const baseClass =
    'flex items-center justify-between mb-3 pb-2 border-b border-gray-950/[0.10] dark:border-white/[0.10]';
  const inner = (
    <div className="flex items-center gap-2">
      <span className={`w-2 h-2 rounded-full ${dotColor}`} aria-hidden="true" />
      <span className="text-[0.75rem] font-medium text-foreground">{title}</span>
      <span className="text-[0.6875rem] text-muted-foreground tabular-nums">
        {isLoading ? '--' : count}
      </span>
    </div>
  );

  if (canClick) {
    return (
      <button
        type="button"
        className={`${baseClass} w-full text-left cursor-pointer hover:opacity-80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-sm`}
        onClick={() => onClick()}
        aria-label={`${title} (${count})`}
      >
        {inner}
      </button>
    );
  }

  return <div className={baseClass}>{inner}</div>;
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
      // Exclude specific symbols
      if ((WIDGET.EXCLUDE_SYMBOLS as readonly string[]).includes(ticker.baseSymbol)) return;

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

  const renderTokenRow = (token: TokenWithApr, index: number, colorClass: string, showSign: boolean) => (
    <button
      type="button"
      key={token.instId}
      className="w-full text-left flex items-center justify-between py-1.5 cursor-pointer hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded -mx-2 px-2"
      onClick={() => onTokenClick?.(token.symbol)}
      aria-label={token.symbol}
    >
      <div className="flex items-center gap-2">
        <span className="text-[0.6875rem] text-muted-foreground w-4">{index + 1}</span>
        <TokenAvatar symbol={token.symbol} logo={token.logo} />
        <span className="text-[0.75rem] font-medium text-foreground">{token.symbol}</span>
      </div>
      <div className="flex items-center">
        <span className="text-[0.6875rem] text-muted-foreground tabular-nums w-16 text-center">
          {formatPrice(token.price)}
        </span>
        <span className={`text-[0.75rem] font-semibold tabular-nums w-16 text-center ${colorClass}`}>
          {showSign && token.apr > 0 ? '+' : ''}{token.apr.toFixed(1)}%
        </span>
      </div>
    </button>
  );

  const aprThreshold = FUNDING.KILLER_APR_THRESHOLD;

  return (
    <SmallWidget
      title="Funding Killer"
      icon={<span>☠️</span>}
      subtitle="Funding Killer's APR"
      loading={isLoading}
      tooltip={
        <TooltipList items={[
          `All ${exchangeLabel} perp tokens (excludes BTC)`,
          <><span className="text-green-500">Long Killer</span>: APR &gt; {aprThreshold}% (expensive to hold longs)</>,
          <><span className="text-red-500">Short Killer</span>: APR &lt; -{aprThreshold}% (expensive to hold shorts)</>,
          "APR = Funding Rate × (365 × 24 / interval)",
        ]} />
      }
    >
      <div className="space-y-4">
        {/* Long Killers Section - Positive APR (green) */}
        <div>
          <KillerSectionHeader
            title="Long Killer"
            count={longKillers.length}
            color="green"
            isLoading={isLoading}
            onClick={() => onGroupClick?.(longKillers.map(t => t.symbol))}
          />
          <div className="space-y-1">
            {displayLongKillers.length > 0 ? (
              displayLongKillers.map((t, i) => renderTokenRow(t, i, 'text-green-500', true))
            ) : (
              <div className="text-center py-4 text-[0.6875rem] text-muted-foreground">
                No tokens with APR &gt; {aprThreshold}%
              </div>
            )}
          </div>
        </div>

        {/* Short Killers Section - Negative APR (red) */}
        <div>
          <KillerSectionHeader
            title="Short Killer"
            count={shortKillers.length}
            color="red"
            isLoading={isLoading}
            onClick={() => onGroupClick?.(shortKillers.map(t => t.symbol))}
          />
          <div className="space-y-1">
            {displayShortKillers.length > 0 ? (
              displayShortKillers.map((t, i) => renderTokenRow(t, i, 'text-red-500', false))
            ) : (
              <div className="text-center py-4 text-[0.6875rem] text-muted-foreground">
                No tokens with APR &lt; -{aprThreshold}%
              </div>
            )}
          </div>
        </div>
      </div>
    </SmallWidget>
  );
}
