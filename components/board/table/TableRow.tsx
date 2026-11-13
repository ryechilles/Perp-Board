'use client';

import { memo, forwardRef } from 'react';
import { ColumnKey } from '@/lib/types';
import { MarketStore } from '@/lib/store/marketStore';
import { useTicker, useRsi, useFunding, useListing, useMarketCap } from '@/hooks/useMarketSelectors';
import { TokenAvatar } from '@/components/ui';
import { Delta, FavoriteButton, Figure, FundingValue, Money, Price, RsiReading, SparkDelta, TdValue } from '@/components/data';
import { cn, formatListDate, formatSettlementInterval, getRsiAvg, getRsiSignal } from '@/lib/utils';
import { ColumnFlags, alignClass, cellPad, isFixed, stickyStyle } from './layout';

interface TableRowProps {
  /** External store instance — each row subscribes to its own instrument slice. */
  marketStore: MarketStore;
  instId: string;
  baseSymbol: string;
  index: number;
  visibleColumns: ColumnKey[];
  exchange?: 'okx' | 'hyperliquid';
  isFavorite: boolean;
  isScrolled: boolean;
  columns: ColumnFlags;
  onToggleFavorite: (instId: string) => void;
}

const Dash = () => <span className="text-fg-faint">—</span>;
const fmt1 = (v: number | null | undefined) => v?.toFixed(1) ?? '—';

/**
 * One instrument. Cells are data components — the row decides which readout a
 * column gets, never how it is coloured.
 */
export const TableRow = memo(forwardRef<HTMLTableRowElement, TableRowProps>(function TableRow({
  marketStore,
  instId,
  baseSymbol,
  index,
  visibleColumns,
  exchange = 'okx',
  isFavorite,
  isScrolled,
  columns,
  onToggleFavorite,
}, ref) {
  // Per-instrument subscriptions: this row re-renders only when its own
  // ticker / rsi / funding / listing / marketCap data changes.
  const ticker = useTicker(marketStore, instId);
  const rsi = useRsi(marketStore, instId);
  const funding = useFunding(marketStore, instId);
  const listingRaw = useListing(marketStore, instId);
  const listing = exchange === 'okx' ? listingRaw : undefined;
  const marketCap = useMarketCap(marketStore, baseSymbol);

  // Row data not yet in the store (e.g. mid-update) — render nothing.
  if (!ticker) return null;

  const base = instId.split('-')[0];

  const content = (key: ColumnKey) => {
    switch (key) {
      case 'favorite':
        return <FavoriteButton symbol={base} active={isFavorite} onToggle={() => onToggleFavorite(instId)} />;
      case 'rank':
        return <Figure className="text-small text-fg-faint">{index + 1}</Figure>;
      case 'logo':
        return <TokenAvatar symbol={base} logo={marketCap?.logo} size="md" />;
      case 'symbol':
        return <div className="truncate font-semibold" translate="no">{base}</div>;
      case 'price':
        return <Price value={ticker.priceNum} className="font-medium" />;
      case 'fundingRate':
        return <FundingValue rate={funding?.fundingRate} interval={funding?.settlementInterval} show="rate" />;
      case 'fundingApr':
        return <FundingValue rate={funding?.fundingRate} interval={funding?.settlementInterval} />;
      case 'fundingInterval':
        return <Figure className="text-fg-muted">{formatSettlementInterval(funding?.settlementInterval)}</Figure>;
      case 'change4h':
        return <Delta value={rsi?.change4h} />;
      case 'change':
        return <Delta value={ticker.changeNum} />;
      case 'change7d':
        return <SparkDelta change={rsi?.change7d} sparklineData={rsi?.sparkline7d || marketCap?.sparkline} />;
      case 'marketCap':
        return <Money value={marketCap?.marketCap} />;
      case 'volume24h': {
        const vol = parseFloat(ticker.volCcy24h);
        return <Money value={Number.isFinite(vol) ? vol * ticker.priceNum : null} decimals={1} />;
      }
      case 'dRsiSignal':
        return (
          <RsiReading
            value={getRsiAvg(rsi?.rsi7, rsi?.rsi14)}
            title={`${getRsiSignal(rsi?.rsi7 ?? null, rsi?.rsi14 ?? null).label} · RSI7 ${fmt1(rsi?.rsi7)} · RSI14 ${fmt1(rsi?.rsi14)}`}
          />
        );
      case 'wRsiSignal':
        return (
          <RsiReading
            value={getRsiAvg(rsi?.rsiW7, rsi?.rsiW14)}
            title={`${getRsiSignal(rsi?.rsiW7 ?? null, rsi?.rsiW14 ?? null).label} · RSI7 ${fmt1(rsi?.rsiW7)} · RSI14 ${fmt1(rsi?.rsiW14)}`}
          />
        );
      case 'tdSeq':
        return <TdValue td={rsi?.td} />;
      case 'rsi7':
        return <RsiReading value={rsi?.rsi7} decimals={1} meter={false} />;
      case 'rsi14':
        return <RsiReading value={rsi?.rsi14} decimals={1} meter={false} />;
      case 'rsiW7':
        return <RsiReading value={rsi?.rsiW7} decimals={1} meter={false} />;
      case 'rsiW14':
        return <RsiReading value={rsi?.rsiW14} decimals={1} meter={false} />;
      case 'listDate':
        return <span className="text-fg-muted">{formatListDate(listing?.listTime)}</span>;
      default:
        return <Dash />;
    }
  };

  return (
    <tr ref={ref} data-index={index} className="data-row group">
      {visibleColumns.map((key) => (
        <td
          key={key}
          className={cn('h-row whitespace-nowrap rule-b', cellPad(key), alignClass(key), isFixed(key) && 'sticky-cell')}
          style={stickyStyle(key, columns, isScrolled, 10)}
        >
          {content(key)}
        </td>
      ))}
    </tr>
  );
}));
