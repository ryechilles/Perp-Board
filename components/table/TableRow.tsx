'use client';

import {
  ProcessedTicker,
  RSIData,
  FundingRateData,
  ListingData,
  MarketCapData,
  ColumnKey,
} from '@/lib/types';
import { Button } from '@/components/ui';
import {
  COLUMN_DEFINITIONS,
  formatPrice,
  formatMarketCap,
  formatVolume,
  getRsiPillStyle,
  formatFundingRate,
  getFundingRateClass,
  formatFundingApr,
  getFundingAprClass,
  formatListDate,
  formatSettlementInterval,
  getRsiSignal,
} from '@/lib/utils';
import { ChangeWithSparkline } from '@/components/Sparkline';

interface TableRowProps {
  ticker: ProcessedTicker;
  index: number;
  currentPage: number;
  pageSize: number;
  visibleColumns: ColumnKey[];
  rsi: RSIData | undefined;
  fundingRate: FundingRateData | undefined;
  listingData: ListingData | undefined;
  marketCap: MarketCapData | undefined;
  hasSpot: boolean;
  exchange?: 'okx' | 'hyperliquid';
  isFavorite: boolean;
  isScrolled: boolean;
  fixedColumns: ColumnKey[];
  fixedWidths: Record<string, number>;
  columns: Record<ColumnKey, boolean>;
  onToggleFavorite: (instId: string) => void;
}

export function TableRow({
  ticker,
  index,
  currentPage,
  pageSize,
  visibleColumns,
  rsi,
  fundingRate,
  listingData,
  marketCap,
  hasSpot,
  exchange = 'okx',
  isFavorite,
  isScrolled,
  fixedColumns,
  fixedWidths,
  columns,
  onToggleFavorite,
}: TableRowProps) {
  const displayRank = (currentPage - 1) * pageSize + index + 1;
  const parts = ticker.instId.split('-');
  const base = parts[0];
  const quote = parts[1] || (exchange === 'hyperliquid' ? 'USDC' : 'USDT');

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
      backgroundColor: 'hsl(var(--card))',
      width: fixedWidth,
      minWidth: fixedWidth,
      maxWidth: fixedWidth,
      boxSizing: 'border-box',
      boxShadow:
        isLastFixed && isScrolled ? '4px 0 6px -2px rgba(0,0,0,0.1)' : undefined,
    };
  };

  // Calculate listing age label
  const getListingAgeLabel = (): { label: string; isNew: boolean } | null => {
    if (!listingData?.listTime) return null;
    const now = Date.now();
    const ageMs = now - listingData.listTime;
    const ageDays = ageMs / (24 * 60 * 60 * 1000);
    if (ageDays <= 30) return { label: 'Listed <30d', isNew: true };
    if (ageDays <= 60) return { label: 'Listed <60d', isNew: false };
    if (ageDays <= 90) return { label: 'Listed <90d', isNew: false };
    if (ageDays <= 180) return { label: 'Listed <180d', isNew: false };
    return null;
  };

  const listingAgeInfo = getListingAgeLabel();

  const renderCell = (key: ColumnKey) => {
    const def = COLUMN_DEFINITIONS[key];
    const isFixed = isFixedColumn(key);
    let alignClass = 'text-left';
    if (def.align === 'right') alignClass = 'text-right';
    if (def.align === 'center') alignClass = 'text-center';

    const baseClass = `px-1 py-2.5 text-[13px] whitespace-nowrap ${alignClass} ${isFixed ? 'bg-card group-hover:bg-muted/50' : ''}`;

    switch (key) {
      case 'favorite':
        return (
          <td
            key={key}
            className={`py-2.5 text-center ${isFixed ? 'bg-card group-hover:bg-muted/50' : ''}`}
            style={getCellStyle(key)}
          >
            <Button
              variant="ghost"
              size="icon"
              className={`h-6 w-6 text-sm ${
                isFavorite
                  ? 'text-yellow-400'
                  : 'text-muted hover:text-yellow-400'
              }`}
              onClick={() => onToggleFavorite(ticker.instId)}
              aria-label={isFavorite ? `Remove ${base} from favorites` : `Add ${base} to favorites`}
              aria-pressed={isFavorite}
            >
              {isFavorite ? '★' : '☆'}
            </Button>
          </td>
        );

      case 'rank':
        return (
          <td
            key={key}
            className={`${baseClass} text-[12px] text-muted-foreground`}
            style={getCellStyle(key)}
          >
            {displayRank}
          </td>
        );

      case 'symbol':
        return (
          <td key={key} className={`${baseClass} font-semibold`} style={getCellStyle(key)}>
            <div className="flex flex-col leading-tight">
              <div className="truncate">
                <span className="text-foreground">{base}</span>
                <span className="text-muted-foreground font-normal">/{quote}</span>
              </div>
              {!hasSpot && exchange !== 'hyperliquid' && (
                <span className="text-[11px] text-muted-foreground font-normal">
                  No Spot on {exchange === 'okx' ? 'OKX' : exchange}
                </span>
              )}
              {listingAgeInfo && (
                <span
                  className={`text-[11px] font-normal ${listingAgeInfo.isNew ? 'text-blue-500' : 'text-muted-foreground'}`}
                >
                  {listingAgeInfo.label}
                </span>
              )}
            </div>
          </td>
        );

      case 'logo':
        const logoUrl = marketCap?.logo;
        return (
          <td key={key} className={baseClass} style={getCellStyle(key)}>
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={base}
                className="w-5 h-5 rounded-full bg-muted"
                loading="lazy"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.onerror = null;
                  target.src = `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect fill='%23e5e7eb' width='32' height='32' rx='16'/><text x='16' y='21' text-anchor='middle' fill='%236b7280' font-size='14' font-family='sans-serif'>${base.charAt(0)}</text></svg>`;
                }}
              />
            ) : (
              <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[10px] text-muted-foreground font-medium">
                {base.charAt(0)}
              </div>
            )}
          </td>
        );

      case 'price':
        return (
          <td key={key} className={`${baseClass} font-medium tabular-nums`}>
            {formatPrice(ticker.priceNum)}
          </td>
        );

      case 'fundingRate':
        return (
          <td
            key={key}
            className={`${baseClass} font-medium tabular-nums ${getFundingRateClass(fundingRate?.fundingRate)}`}
          >
            {formatFundingRate(fundingRate?.fundingRate)}
          </td>
        );

      case 'fundingApr':
        return (
          <td
            key={key}
            className={`${baseClass} font-medium tabular-nums ${getFundingAprClass(fundingRate?.fundingRate)}`}
          >
            {formatFundingApr(
              fundingRate?.fundingRate,
              fundingRate?.settlementInterval
            )}
          </td>
        );

      case 'fundingInterval':
        return (
          <td key={key} className={`${baseClass} text-[12px] text-muted-foreground`}>
            {formatSettlementInterval(fundingRate?.settlementInterval)}
          </td>
        );

      case 'change4h':
        const change4h = rsi?.change4h;
        return (
          <td key={key} className={baseClass}>
            <ChangeWithSparkline change={change4h} showSparkline={false} />
          </td>
        );

      case 'change':
        const sparkline24h = rsi?.sparkline24h || marketCap?.sparkline?.slice(-24);
        return (
          <td key={key} className={baseClass}>
            <ChangeWithSparkline
              change={ticker.changeNum}
              sparklineData={sparkline24h}
            />
          </td>
        );

      case 'change7d':
        const change7d = rsi?.change7d;
        const sparkline7d = rsi?.sparkline7d || marketCap?.sparkline;
        return (
          <td key={key} className={baseClass}>
            <ChangeWithSparkline change={change7d} sparklineData={sparkline7d} />
          </td>
        );

      case 'marketCap':
        return (
          <td key={key} className={`${baseClass} text-muted-foreground tabular-nums`}>
            {marketCap?.marketCap ? (
              formatMarketCap(marketCap.marketCap)
            ) : (
              <span className="text-muted-foreground">--</span>
            )}
          </td>
        );

      case 'volume24h':
        return (
          <td key={key} className={`${baseClass} text-muted-foreground tabular-nums`}>
            {formatVolume(ticker.volCcy24h, ticker.priceNum)}
          </td>
        );

      case 'dRsiSignal': {
        const dSignal = getRsiSignal(rsi?.rsi7 ?? null, rsi?.rsi14 ?? null);
        const hasRsiData = (rsi?.rsi7 != null || rsi?.rsi14 != null) && dSignal.label !== '--';
        return (
          <td key={key} className={`${baseClass} align-middle group/dsignal`}>
            <div className="inline-flex flex-col items-center justify-center">
              <span className={`inline-block px-2 py-0.5 rounded-md text-[13px] font-semibold whitespace-nowrap ${dSignal.pillStyle}`}>
                {dSignal.label}
              </span>
              <span className={`text-[10px] text-muted-foreground tabular-nums leading-none mt-0.5 whitespace-nowrap h-0 overflow-hidden group-hover/dsignal:h-auto ${hasRsiData ? '' : 'invisible'}`}>
                {rsi?.rsi7 != null ? rsi.rsi7.toFixed(1) : '--'}/{rsi?.rsi14 != null ? rsi.rsi14.toFixed(1) : '--'}
              </span>
            </div>
          </td>
        );
      }

      case 'wRsiSignal': {
        const wSignal = getRsiSignal(rsi?.rsiW7 ?? null, rsi?.rsiW14 ?? null);
        const hasRsiData = (rsi?.rsiW7 != null || rsi?.rsiW14 != null) && wSignal.label !== '--';
        return (
          <td key={key} className={`${baseClass} align-middle group/wsignal`}>
            <div className="inline-flex flex-col items-center justify-center">
              <span className={`inline-block px-2 py-0.5 rounded-md text-[13px] font-semibold whitespace-nowrap ${wSignal.pillStyle}`}>
                {wSignal.label}
              </span>
              <span className={`text-[10px] text-muted-foreground tabular-nums leading-none mt-0.5 whitespace-nowrap h-0 overflow-hidden group-hover/wsignal:h-auto ${hasRsiData ? '' : 'invisible'}`}>
                {rsi?.rsiW7 != null ? rsi.rsiW7.toFixed(1) : '--'}/{rsi?.rsiW14 != null ? rsi.rsiW14.toFixed(1) : '--'}
              </span>
            </div>
          </td>
        );
      }

      case 'rsi7':
        return (
          <td key={key} className={baseClass}>
            <span className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold tabular-nums min-w-[42px] text-center ${getRsiPillStyle(rsi?.rsi7)}`}>
              {rsi?.rsi7 != null ? rsi.rsi7.toFixed(1) : '--'}
            </span>
          </td>
        );

      case 'rsi14':
        return (
          <td key={key} className={baseClass}>
            <span className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold tabular-nums min-w-[42px] text-center ${getRsiPillStyle(rsi?.rsi14)}`}>
              {rsi?.rsi14 != null ? rsi.rsi14.toFixed(1) : '--'}
            </span>
          </td>
        );

      case 'rsiW7':
        return (
          <td key={key} className={baseClass}>
            <span className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold tabular-nums min-w-[42px] text-center ${getRsiPillStyle(rsi?.rsiW7)}`}>
              {rsi?.rsiW7 != null ? rsi.rsiW7.toFixed(1) : '--'}
            </span>
          </td>
        );

      case 'rsiW14':
        return (
          <td key={key} className={baseClass}>
            <span className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold tabular-nums min-w-[42px] text-center ${getRsiPillStyle(rsi?.rsiW14)}`}>
              {rsi?.rsiW14 != null ? rsi.rsiW14.toFixed(1) : '--'}
            </span>
          </td>
        );

      case 'listDate':
        return (
          <td key={key} className={`${baseClass} text-[12px] text-muted-foreground`}>
            {formatListDate(listingData?.listTime)}
          </td>
        );

      case 'hasSpot':
        return (
          <td key={key} className={baseClass}>
            <span
              className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                hasSpot
                  ? 'bg-green-500/15 text-green-500'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {hasSpot ? 'Yes' : 'No'}
            </span>
          </td>
        );

      default:
        return (
          <td key={key} className={baseClass}>
            --
          </td>
        );
    }
  };

  return (
    <tr className="hover:bg-muted/50 border-b border-gray-950/[0.10] dark:border-white/[0.10] group">
      {visibleColumns.map(renderCell)}
    </tr>
  );
}
