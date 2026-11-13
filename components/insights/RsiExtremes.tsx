'use client';

import { useMemo } from 'react';
import { EmptyLine, Figure, List, ListHeading, ListRow, ListSkeleton, Panel, Price, RsiReading } from '@/components/data';
import { TipBody } from '@/components/ui';
import { ProcessedTicker, RSIData, MarketCapData } from '@/lib/types';
import { rankTokensByRsi, widgetUniverseNote } from '@/lib/widget-utils';
import { RSI, WIDGET } from '@/lib/constants';

type Mode = 'oversold' | 'overbought';

interface RsiExtremesProps {
  mode: Mode;
  tickers: Map<string, ProcessedTicker>;
  rsiData: Map<string, RSIData>;
  marketCapData: Map<string, MarketCapData>;
  onTokenClick?: (symbol: string) => void;
  exchangeLabel?: string;
}

const MODE = {
  oversold: { title: 'Oversold', threshold: RSI.OVERSOLD, comparator: '≤', closest: 'Lowest right now', hint: 'Lower RSI = potentially oversold' },
  overbought: { title: 'Overbought', threshold: RSI.OVERBOUGHT, comparator: '≥', closest: 'Highest right now', hint: 'Higher RSI = potentially overbought' },
} as const;

/** How many runners-up to list when nothing is past the threshold. */
const CLOSEST_COUNT = 3;

/**
 * Tokens past an RSI threshold. When none are, the panel does not go blank: it
 * says so in one line and lists the closest few, so there is always a reading.
 */
export function RsiExtremes({ mode, tickers, rsiData, marketCapData, onTokenClick, exchangeLabel = 'OKX' }: RsiExtremesProps) {
  const config = MODE[mode];

  const { matches, closest } = useMemo(() => {
    const ranked = rankTokensByRsi(tickers, rsiData, marketCapData, mode);
    const past = ranked.filter((t) => (mode === 'oversold' ? t.avgRsi <= config.threshold : t.avgRsi >= config.threshold));
    return { matches: past.slice(0, WIDGET.DISPLAY_LIMIT), closest: ranked.slice(0, CLOSEST_COUNT) };
  }, [tickers, rsiData, marketCapData, mode, config.threshold]);

  const isLoading = tickers.size === 0;
  const rows = matches.length > 0 ? matches : closest;

  return (
    <Panel
      title={config.title}
      note={`Avg RSI ${config.comparator} ${config.threshold}`}
      flush
      loading={isLoading}
      skeleton={<ListSkeleton />}
      actions={!isLoading && <Figure className="text-small text-fg-muted">{matches.length}</Figure>}
      info={
        <TipBody
          title="Avg RSI = (RSI7 + RSI14 + W-RSI7 + W-RSI14) / 4"
          items={[widgetUniverseNote(exchangeLabel), config.hint]}
        />
      }
    >
      {matches.length === 0 &&
        (rows.length > 0 ? <ListHeading label={`None past ${config.threshold} · ${config.closest.toLowerCase()}`} /> : <EmptyLine>No RSI data yet</EmptyLine>)}
      <List>
        {rows.map((token) => (
          <ListRow
            key={token.instId}
            symbol={token.symbol}
            logo={token.logo}
            detail={<Price value={token.price} />}
            value={<RsiReading value={token.avgRsi} title={token.avgRsi.toFixed(1)} />}
            onClick={() => onTokenClick?.(token.symbol)}
          />
        ))}
      </List>
    </Panel>
  );
}
