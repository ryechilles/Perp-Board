'use client';

import { useMemo, useState } from 'react';
import { Delta, List, ListRow, ListSkeleton, Panel, Price } from '@/components/data';
import { TipBody } from '@/components/ui';
import { ProcessedTicker, RSIData, MarketCapData } from '@/lib/types';
import { TimeFrameSelect } from './TimeFrameSelect';
import { TimeFrame, TokenWithChange, getChangeByTimeFrame, widgetUniverseNote } from '@/lib/widget-utils';
import { UNIVERSE } from '@/lib/constants';

interface TopGainersProps {
  tickers: Map<string, ProcessedTicker>;
  rsiData: Map<string, RSIData>;
  marketCapData: Map<string, MarketCapData>;
  onTokenClick?: (symbol: string) => void;
  exchangeLabel?: string;
}

/** The five best-performing altcoins over the chosen time frame. */
export function TopGainers({ tickers, rsiData, marketCapData, onTokenClick, exchangeLabel = 'OKX' }: TopGainersProps) {
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
    <Panel
      title="Top Gainers"
      note="Excl. BTC"
      actions={<TimeFrameSelect value={timeFrame} onChange={setTimeFrame} />}
      flush
      loading={isLoading}
      skeleton={<ListSkeleton rows={5} />}
      info={<TipBody title="Top 5 gainers, excluding BTC" items={[widgetUniverseNote(exchangeLabel), 'Click a token to show it in the table']} />}
    >
      <List>
        {topGainers.map((token) => (
          <ListRow
            key={token.instId}
            symbol={token.symbol}
            logo={token.logo}
            detail={<Price value={token.price ?? 0} />}
            value={<Delta value={getChangeByTimeFrame(token, timeFrame)} />}
            onClick={() => onTokenClick?.(token.symbol)}
          />
        ))}
      </List>
    </Panel>
  );
}
