'use client';

import { useMemo } from 'react';
import { SmallWidget, TokenList, TokenListRow, EmptyState } from '@/components/widgets/base';
import { TooltipList, Skeleton, RsiReading } from '@/components/ui';
import { ProcessedTicker, RSIData, MarketCapData } from '@/lib/types';
import { cn, formatPrice } from '@/lib/utils';
import { getTokensByRsiThreshold, widgetUniverseNote } from '@/lib/widget-utils';
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
    title: 'Oversold',
    dot: 'bg-cold',
    threshold: RSI.OVERSOLD,
    comparator: '≤',
    tooltipHint: 'Lower RSI = potentially oversold',
    emptyTitle: 'Nothing oversold',
    emptyDetail: (n: number, t: number) => `All top ${n} are above RSI ${t}.`,
  },
  overbought: {
    title: 'Overbought',
    dot: 'bg-hot',
    threshold: RSI.OVERBOUGHT,
    comparator: '≥',
    tooltipHint: 'Higher RSI = potentially overbought',
    emptyTitle: 'Nothing overbought',
    emptyDetail: (n: number, t: number) => `All top ${n} are below RSI ${t}.`,
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
      subtitle={`Avg RSI ${config.comparator} ${config.threshold} · Top ${WIDGET.TOP_TOKENS_COUNT} ${exchangeLabel} perps`}
      padded={false}
      loading={isLoading}
      headerActions={
        !isLoading && (
          <span className="inline-flex items-center gap-1.5 h-6 px-2 text-xs text-muted-foreground tabular-nums">
            <span className={cn('w-[7px] h-[7px] rounded-full', config.dot)} aria-hidden="true" />
            {tokens.length}
          </span>
        )
      }
      skeleton={
        <div className="space-y-3 py-1">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-2.5">
              <Skeleton className="w-[22px] h-[22px] rounded-full" />
              <Skeleton className="w-12 h-3" />
              <Skeleton className="w-20 h-3 ml-auto" />
            </div>
          ))}
        </div>
      }
      tooltip={
        <TooltipList items={[
          widgetUniverseNote(exchangeLabel),
          "Avg RSI = (RSI7 + RSI14 + W-RSI7 + W-RSI14) / 4",
          `Shows tokens with Avg RSI ${config.comparator} ${config.threshold}`,
          config.tooltipHint,
        ]} />
      }
    >
      {tokens.length > 0 ? (
        <TokenList>
          {tokens.map((token) => (
            <TokenListRow
              key={token.instId}
              symbol={token.symbol}
              logo={token.logo}
              detail={formatPrice(token.price)}
              value={<RsiReading value={token.avgRsi} title={token.avgRsi.toFixed(1)} />}
              onClick={() => onTokenClick?.(token.symbol)}
            />
          ))}
        </TokenList>
      ) : (
        <EmptyState
          title={config.emptyTitle}
          detail={config.emptyDetail(WIDGET.TOP_TOKENS_COUNT, config.threshold)}
        />
      )}
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
