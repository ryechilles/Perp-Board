'use client';

import { useMemo } from 'react';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { SmallWidget } from '@/components/widgets/base';
import { TooltipList, TokenAvatar, Skeleton } from '@/components/ui';
import { ProcessedTicker, RSIData, MarketCapData } from '@/lib/types';
import { formatPrice, getRsiPillStyle } from '@/lib/utils';
import { getTokensByRsiThreshold } from '@/lib/widget-utils';
import { RSI, WIDGET } from '@/lib/constants';

type RsiThresholdMode = 'oversold' | 'overbought';

interface RsiThresholdWidgetProps {
  mode: RsiThresholdMode;
  tickers: Map<string, ProcessedTicker>;
  rsiData: Map<string, RSIData>;
  marketCapData: Map<string, MarketCapData>;
  onTokenClick?: (symbol: string) => void;
  exchangeLabel?: string;
}

const MODE_CONFIG = {
  oversold: {
    title: 'RSI Oversold',
    icon: <TrendingDown className="w-4 h-4" />,
    threshold: RSI.OVERSOLD,
    comparator: '≤',
    tooltipHint: 'Lower RSI = potentially oversold',
    emptyText: 'No oversold tokens',
  },
  overbought: {
    title: 'RSI Overbought',
    icon: <TrendingUp className="w-4 h-4" />,
    threshold: RSI.OVERBOUGHT,
    comparator: '≥',
    tooltipHint: 'Higher RSI = potentially overbought',
    emptyText: 'No overbought tokens',
  },
} as const;

export function RsiThresholdWidget({
  mode,
  tickers,
  rsiData,
  marketCapData,
  onTokenClick,
  exchangeLabel = 'OKX',
}: RsiThresholdWidgetProps) {
  const config = MODE_CONFIG[mode];

  const tokens = useMemo(
    () => getTokensByRsiThreshold(tickers, rsiData, marketCapData, mode),
    [tickers, rsiData, marketCapData, mode]
  );

  const isLoading = tickers.size === 0;

  return (
    <SmallWidget
      title={config.title}
      icon={config.icon}
      subtitle={`Avg RSI ${config.comparator} ${config.threshold} in ${exchangeLabel} Perp Top ${WIDGET.TOP_TOKENS_COUNT}`}
      loading={isLoading}
      skeleton={
        <div className="space-y-1">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between py-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground w-4">{i}</span>
                <Skeleton className="w-5 h-5 rounded-full" />
                <Skeleton className="w-10 h-3" />
              </div>
              <div className="flex items-center gap-3">
                <Skeleton className="w-12 h-3" />
                <Skeleton className="w-12 h-5 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      }
      tooltip={
        <TooltipList items={[
          `Filters ${exchangeLabel} perp top ${WIDGET.TOP_TOKENS_COUNT} by market cap`,
          "Avg RSI = (RSI7 + RSI14 + W-RSI7 + W-RSI14) / 4",
          `Shows tokens with Avg RSI ${config.comparator} ${config.threshold}`,
          config.tooltipHint,
        ]} />
      }
    >
      <div className="space-y-1">
        {tokens.length > 0 ? (
          tokens.map((token, i) => (
            <button
              type="button"
              key={token.instId}
              className="w-full text-left flex items-center justify-between py-1.5 cursor-pointer hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded -mx-2 px-2"
              onClick={() => onTokenClick?.(token.symbol)}
              aria-label={token.symbol}
            >
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground w-4">{i + 1}</span>
                <TokenAvatar symbol={token.symbol} logo={token.logo} />
                <span className="text-[12px] font-medium text-foreground">{token.symbol}</span>
              </div>
              <div className="flex items-center">
                <span className="text-[11px] text-muted-foreground tabular-nums w-16 text-center">{formatPrice(token.price)}</span>
                <span className={`text-[11px] font-semibold tabular-nums w-14 text-center py-0.5 rounded-md ${getRsiPillStyle(token.avgRsi)}`}>
                  {token.avgRsi.toFixed(1)}
                </span>
              </div>
            </button>
          ))
        ) : (
          <div className="text-center py-4 text-[11px] text-muted-foreground">
            {config.emptyText} in Top {WIDGET.TOP_TOKENS_COUNT}
          </div>
        )}
      </div>
    </SmallWidget>
  );
}

// Backward-compatible re-exports
export function RsiOversold(props: Omit<RsiThresholdWidgetProps, 'mode'>) {
  return <RsiThresholdWidget mode="oversold" {...props} />;
}

export function RsiOverbought(props: Omit<RsiThresholdWidgetProps, 'mode'>) {
  return <RsiThresholdWidget mode="overbought" {...props} />;
}
