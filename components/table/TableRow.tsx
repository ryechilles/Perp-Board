'use client';

import { memo, forwardRef } from 'react';
import { ColumnKey } from '@/lib/types';
import { MarketStore } from '@/lib/store/marketStore';
import {
  useTicker,
  useRsi,
  useFunding,
  useListing,
  useMarketCap,
} from '@/hooks/useMarketSelectors';
import { Star } from 'lucide-react';
import { TokenAvatar, RsiReading, ChangePill } from '@/components/ui';
import {
  cn,
  COLUMN_DEFINITIONS,
  formatPrice,
  formatMarketCap,
  formatVolume,
  formatFundingRate,
  getFundingRateClass,
  formatFundingApr,
  getFundingAprClass,
  formatListDate,
  formatSettlementInterval,
  getRsiAvg,
  getRsiSignal,
  getRsiTextClass,
  getTdDisplay,
} from '@/lib/utils';
import { FUNDING } from '@/lib/constants';
import { SparklineChange } from '@/components/Sparkline';

/** Zone-colored single RSI value (for the raw RSI7/RSI14 columns). */
function RsiValue({ value }: { value: number | null | undefined }) {
  if (value == null) return <span className="text-faint">—</span>;
  return <span className={cn('font-semibold tabular-nums', getRsiTextClass(value))}>{value.toFixed(1)}</span>;
}

/** Annualized funding with a tiny diverging bar (center = 0, full = ±15%). */
function FundingAprValue({ rate, interval }: { rate: number | undefined | null; interval: number | undefined | null }) {
  if (rate == null) return <span className="text-faint">—</span>;
  const apr = rate * ((365 * 24) / (interval || FUNDING.DEFAULT_INTERVAL_HOURS)) * 100;
  const w = Math.min(Math.abs(apr) / 15, 1) * 18;
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className={cn('font-medium tabular-nums', getFundingAprClass(rate))}>
        {formatFundingApr(rate, interval)}
      </span>
      <span className="relative w-9 h-3 flex-shrink-0 before:absolute before:left-1/2 before:inset-y-0 before:w-px before:bg-separator" aria-hidden="true">
        {w > 0 && (
          <span
            className={cn('absolute top-[3px] h-1.5 rounded-[2px]', apr >= 0 ? 'bg-up' : 'bg-down')}
            style={apr >= 0 ? { left: '50%', width: w } : { right: '50%', width: w }}
          />
        )}
      </span>
    </span>
  );
}

interface TableRowProps {
  /** External store instance — each row subscribes to its own instrument slice. */
  marketStore: MarketStore;
  instId: string;
  baseSymbol: string;
  index: number;
  currentPage: number;
  pageSize: number;
  visibleColumns: ColumnKey[];
  exchange?: 'okx' | 'hyperliquid';
  isFavorite: boolean;
  isScrolled: boolean;
  fixedColumns: ColumnKey[];
  fixedWidths: Record<string, number>;
  columns: Record<ColumnKey, boolean>;
  onToggleFavorite: (instId: string) => void;
}

export const TableRow = memo(forwardRef<HTMLTableRowElement, TableRowProps>(function TableRow({
  marketStore,
  instId,
  baseSymbol,
  index,
  currentPage,
  pageSize,
  visibleColumns,
  exchange = 'okx',
  isFavorite,
  isScrolled,
  fixedColumns,
  fixedWidths,
  columns,
  onToggleFavorite,
}: TableRowProps, ref) {
  // Per-instrument subscriptions: this row re-renders only when its own
  // ticker / rsi / funding / listing / marketCap / spot data changes.
  const ticker = useTicker(marketStore, instId);
  const rsi = useRsi(marketStore, instId);
  const fundingRate = useFunding(marketStore, instId);
  const listingRaw = useListing(marketStore, instId);
  const listingData = exchange === 'okx' ? listingRaw : undefined;
  const marketCap = useMarketCap(marketStore, baseSymbol);

  const displayRank = (currentPage - 1) * pageSize + index + 1;
  const base = instId.split('-')[0];

  // Row data not yet in the store (e.g. mid-update) — render nothing.
  if (!ticker) return null;

  const isFixedColumn = (key: ColumnKey) => fixedColumns.includes(key);

  const isLastFixedColumn = (key: ColumnKey) => {
    const visibleFixed = fixedColumns.filter((col) => columns[col]);
    return visibleFixed[visibleFixed.length - 1] === key;
  };

  const getStickyLeftOffset = (key: ColumnKey): number => {
    if (!fixedColumns.includes(key)) return 0;
    let left = 0;
    for (const col of fixedColumns) {
      if (col === key) break;
      if (columns[col]) {
        left += fixedWidths[col] || 0;
      }
    }
    return left;
  };

  const getCellStyle = (key: ColumnKey): React.CSSProperties | undefined => {
    if (!isFixedColumn(key)) return undefined;
    const isLastFixed = isLastFixedColumn(key);
    const fixedWidth = fixedWidths[key];
    return {
      position: 'sticky',
      left: getStickyLeftOffset(key),
      zIndex: 10,
      width: fixedWidth,
      minWidth: fixedWidth,
      maxWidth: fixedWidth,
      boxSizing: 'border-box',
      boxShadow:
        isLastFixed && isScrolled
          ? 'inset 0 -0.5px 0 hsl(var(--separator)), 1px 0 0 hsl(var(--separator)), 6px 0 10px -6px rgb(0 0 0 / 0.12)'
          : undefined,
    };
  };

  const renderCell = (key: ColumnKey) => {
    const def = COLUMN_DEFINITIONS[key];
    const isFixed = isFixedColumn(key);
    const alignClass = def.align === 'right' ? 'text-right' : def.align === 'center' ? 'text-center' : 'text-left';
    const baseClass = cn('h-12 px-3 text-[0.8125rem] whitespace-nowrap hairline-b', alignClass, isFixed && 'sticky-cell');

    switch (key) {
      case 'favorite':
        return (
          <td key={key} className={cn(baseClass, 'pl-3.5 pr-0')} style={getCellStyle(key)}>
            <button
              type="button"
              className={cn(
                'w-[22px] h-[22px] rounded-md grid place-items-center transition-[opacity,color] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                isFavorite ? 'text-star' : 'text-faint opacity-40 group-hover:opacity-100 hover:text-star focus-visible:opacity-100'
              )}
              onClick={() => onToggleFavorite(instId)}
              aria-label={isFavorite ? `Remove ${base} from favorites` : `Add ${base} to favorites`}
              aria-pressed={isFavorite}
            >
              <Star className="w-3.5 h-3.5" fill={isFavorite ? 'currentColor' : 'none'} strokeWidth={1.6} aria-hidden="true" />
            </button>
          </td>
        );

      case 'rank':
        return (
          <td key={key} className={cn(baseClass, 'px-1 text-xs text-faint tabular-nums')} style={getCellStyle(key)}>
            {displayRank}
          </td>
        );

      case 'symbol':
        return (
          <td key={key} className={cn(baseClass, 'pl-0 text-[0.84rem] font-semibold tracking-[-0.01em]')} style={getCellStyle(key)}>
            <div className="truncate" translate="no">{base}</div>
          </td>
        );

      case 'logo':
        return (
          <td key={key} className={cn(baseClass, 'pl-2 pr-2.5')} style={getCellStyle(key)}>
            <TokenAvatar symbol={base} logo={marketCap?.logo} size="lg" />
          </td>
        );

      case 'price':
        return (
          <td key={key} className={cn(baseClass, 'text-[0.84rem] font-medium tabular-nums')}>
            {formatPrice(ticker.priceNum)}
          </td>
        );

      case 'fundingRate':
        return (
          <td key={key} className={cn(baseClass, 'font-medium tabular-nums', getFundingRateClass(fundingRate?.fundingRate))}>
            {formatFundingRate(fundingRate?.fundingRate)}
          </td>
        );

      case 'fundingApr':
        return (
          <td key={key} className={baseClass}>
            <FundingAprValue rate={fundingRate?.fundingRate} interval={fundingRate?.settlementInterval} />
          </td>
        );

      case 'fundingInterval':
        return (
          <td key={key} className={cn(baseClass, 'text-muted-foreground tabular-nums')}>
            {formatSettlementInterval(fundingRate?.settlementInterval)}
          </td>
        );

      case 'change4h':
        return (
          <td key={key} className={baseClass}>
            <ChangePill change={rsi?.change4h} />
          </td>
        );

      case 'change':
        return (
          <td key={key} className={baseClass}>
            <ChangePill change={ticker.changeNum} />
          </td>
        );

      case 'change7d': {
        const sparkline7d = rsi?.sparkline7d || marketCap?.sparkline;
        return (
          <td key={key} className={baseClass}>
            <SparklineChange change={rsi?.change7d} sparklineData={sparkline7d} />
          </td>
        );
      }

      case 'marketCap':
        return (
          <td key={key} className={cn(baseClass, 'text-muted-foreground tabular-nums')}>
            {marketCap?.marketCap ? formatMarketCap(marketCap.marketCap) : <span className="text-faint">—</span>}
          </td>
        );

      case 'volume24h':
        return (
          <td key={key} className={cn(baseClass, 'text-muted-foreground tabular-nums')}>
            {formatVolume(ticker.volCcy24h, ticker.priceNum)}
          </td>
        );

      case 'dRsiSignal': {
        const avg = getRsiAvg(rsi?.rsi7, rsi?.rsi14);
        const signal = getRsiSignal(rsi?.rsi7 ?? null, rsi?.rsi14 ?? null);
        return (
          <td key={key} className={baseClass}>
            <RsiReading
              value={avg}
              title={`${signal.label} · RSI7 ${rsi?.rsi7?.toFixed(1) ?? '—'} · RSI14 ${rsi?.rsi14?.toFixed(1) ?? '—'}`}
            />
          </td>
        );
      }

      case 'wRsiSignal': {
        const avg = getRsiAvg(rsi?.rsiW7, rsi?.rsiW14);
        const signal = getRsiSignal(rsi?.rsiW7 ?? null, rsi?.rsiW14 ?? null);
        return (
          <td key={key} className={baseClass}>
            <RsiReading
              value={avg}
              title={`${signal.label} · RSI7 ${rsi?.rsiW7?.toFixed(1) ?? '—'} · RSI14 ${rsi?.rsiW14?.toFixed(1) ?? '—'}`}
            />
          </td>
        );
      }

      case 'tdSeq': {
        const td = getTdDisplay(rsi?.td);
        return (
          <td key={key} className={baseClass}>
            <span title={td.title} className={td.className}>
              {td.label}
            </span>
          </td>
        );
      }

      case 'rsi7':
        return <td key={key} className={baseClass}><RsiValue value={rsi?.rsi7} /></td>;
      case 'rsi14':
        return <td key={key} className={baseClass}><RsiValue value={rsi?.rsi14} /></td>;
      case 'rsiW7':
        return <td key={key} className={baseClass}><RsiValue value={rsi?.rsiW7} /></td>;
      case 'rsiW14':
        return <td key={key} className={baseClass}><RsiValue value={rsi?.rsiW14} /></td>;

      case 'listDate':
        return (
          <td key={key} className={cn(baseClass, 'text-muted-foreground')}>
            {formatListDate(listingData?.listTime)}
          </td>
        );

      default:
        return (
          <td key={key} className={baseClass}>
            <span className="text-faint">—</span>
          </td>
        );
    }
  };

  return (
    <tr
      ref={ref}
      data-index={index}
      className="data-row group"
    >
      {visibleColumns.map(renderCell)}
    </tr>
  );
}));
