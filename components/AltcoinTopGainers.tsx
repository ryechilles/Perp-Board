'use client';

import { useMemo, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { SmallWidget } from '@/components/widgets/base';
import { TokenAvatar, TooltipList, TimeFrameSelector } from '@/components/ui';
import { ProcessedTicker, RSIData, MarketCapData } from '@/lib/types';
import { formatPrice } from '@/lib/utils';
import { TimeFrame, TokenWithChange, formatChange, getChangeByTimeFrame } from '@/lib/widget-utils';

interface AltcoinTopGainersProps {
  tickers: Map<string, ProcessedTicker>;
  rsiData: Map<string, RSIData>;
  marketCapData: Map<string, MarketCapData>;
  onTokenClick?: (symbol: string) => void;
  exchangeLabel?: string;
}

export function AltcoinTopGainers({ tickers, rsiData, marketCapData, onTokenClick, exchangeLabel = 'OKX' }: AltcoinTopGainersProps) {
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('4h');

  // Get altcoins sorted by market cap (excluding BTC)
  const altcoins = useMemo(() => {
    const tokens: (TokenWithChange & { marketCap: number })[] = [];

    tickers.forEach((ticker) => {
      const mc = marketCapData.get(ticker.baseSymbol);
      const rsi = rsiData.get(ticker.instId);

      // Skip BTC
      if (ticker.baseSymbol === 'BTC') return;

      // Only include tokens with market cap
      if (mc && mc.marketCap) {
        tokens.push({
          symbol: ticker.baseSymbol,
          instId: ticker.instId,
          rank: 0, // Not used anymore
          marketCap: mc.marketCap,
          price: ticker.priceNum,
          change1h: rsi?.change1h ?? null,
          change4h: rsi?.change4h ?? null,
          change24h: ticker.changeNum,
          logo: mc.logo,
        });
      }
    });

    // Sort by market cap (descending)
    return tokens.sort((a, b) => b.marketCap - a.marketCap);
  }, [tickers, rsiData, marketCapData]);

  // Top 100 altcoins
  const top100 = useMemo(() => altcoins.slice(0, 100), [altcoins]);

  // Top gainers
  const topGainers = useMemo(() => {
    return [...top100]
      .filter(t => getChangeByTimeFrame(t, timeFrame) !== null)
      .sort((a, b) => (getChangeByTimeFrame(b, timeFrame) ?? 0) - (getChangeByTimeFrame(a, timeFrame) ?? 0))
      .slice(0, 5);
  }, [top100, timeFrame]);

  const isLoading = altcoins.length === 0;

  return (
    <SmallWidget
      title="Top Gainers"
      icon={<TrendingUp className="w-4 h-4" />}
      headerActions={<TimeFrameSelector value={timeFrame} onChange={setTimeFrame} />}
      loading={isLoading}
      tooltip={
        <TooltipList items={[
          `Top 5 gainers from ${exchangeLabel} perp top 100`,
          "Excludes BTC",
          "Click token to filter in table",
        ]} />
      }
    >
      <div className="space-y-1">
        {isLoading ? (
          [1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center justify-between py-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground w-4">{i}</span>
                <div className="w-5 h-5 rounded-full bg-muted animate-pulse" />
                <div className="w-10 h-3 bg-muted rounded animate-pulse" />
              </div>
              <div className="flex items-center gap-3">
                <div className="w-12 h-3 bg-muted rounded animate-pulse" />
                <div className="w-10 h-3 bg-muted rounded animate-pulse" />
              </div>
            </div>
          ))
        ) : (
          topGainers.map((token, i) => {
            const change = getChangeByTimeFrame(token, timeFrame);
            return (
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
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-muted-foreground tabular-nums">{formatPrice(token.price ?? 0)}</span>
                  <span className={`text-[12px] font-semibold tabular-nums ${formatChange(change).color}`}>
                    {formatChange(change).text}
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </SmallWidget>
  );
}
