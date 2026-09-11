'use client';

import { useMemo, useState } from 'react';
import { SmallWidget, TokenList, TokenListRow } from '@/components/widgets/base';
import { TooltipList, TimeFrameSelector, ChangePill, Skeleton } from '@/components/ui';
import { ProcessedTicker, RSIData, MarketCapData } from '@/lib/types';
import { formatPrice } from '@/lib/utils';
import { TimeFrame, TokenWithChange, getChangeByTimeFrame } from '@/lib/widget-utils';
import { UNIVERSE } from '@/lib/constants';

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

  // Top N altcoins
  const topN = useMemo(() => altcoins.slice(0, UNIVERSE.MAX_CRYPTO), [altcoins]);

  // Top gainers
  const topGainers = useMemo(() => {
    return [...topN]
      .filter(t => getChangeByTimeFrame(t, timeFrame) !== null)
      .sort((a, b) => (getChangeByTimeFrame(b, timeFrame) ?? 0) - (getChangeByTimeFrame(a, timeFrame) ?? 0))
      .slice(0, 5);
  }, [topN, timeFrame]);

  const isLoading = altcoins.length === 0;

  return (
    <SmallWidget
      title="Top Gainers"
      subtitle="Excluding BTC"
      headerActions={<TimeFrameSelector value={timeFrame} onChange={setTimeFrame} />}
      padded={false}
      loading={isLoading}
      skeleton={
        <div className="space-y-3 py-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-2.5">
              <Skeleton className="w-[22px] h-[22px] rounded-full" />
              <Skeleton className="w-12 h-3" />
              <Skeleton className="w-16 h-6 rounded-md ml-auto" />
            </div>
          ))}
        </div>
      }
      tooltip={
        <TooltipList items={[
          `Top 5 gainers from ${exchangeLabel} perp top ${UNIVERSE.MAX_CRYPTO}`,
          "Excludes BTC",
          "Click token to filter in table",
        ]} />
      }
    >
      <TokenList>
        {topGainers.map((token) => (
          <TokenListRow
            key={token.instId}
            symbol={token.symbol}
            logo={token.logo}
            detail={formatPrice(token.price ?? 0)}
            value={<ChangePill change={getChangeByTimeFrame(token, timeFrame)} />}
            onClick={() => onTokenClick?.(token.symbol)}
          />
        ))}
      </TokenList>
    </SmallWidget>
  );
}
