'use client';

import { memo } from 'react';
import { MarketStore } from '@/lib/store/marketStore';
import {
  useTicker,
  useRsi,
  useFunding,
  useMarketCap,
} from '@/hooks/useMarketSelectors';
import { Star } from 'lucide-react';
import { TokenAvatar, ChangePill } from '@/components/ui';
import {
  cn,
  formatPrice,
  formatFundingApr,
  getFundingAprClass,
  getRsiAvg,
  getRsiTextClass,
  getTdDisplay,
} from '@/lib/utils';

interface TokenCardProps {
  /** External store instance — each card subscribes to its own instrument slice. */
  marketStore: MarketStore;
  instId: string;
  baseSymbol: string;
  index: number;
  isFavorite: boolean;
  onToggleFavorite: (instId: string) => void;
}

/**
 * Mobile token row — the per-instrument unit shown below the `lg` breakpoint
 * in place of the (too-wide) desktop table row, laid out like a Stocks list:
 * logo + symbol with a secondary line (daily/weekly RSI, funding APR, TD signal)
 * on the left, price + 24h change pill on the right. Rows sit in one grouped
 * card with inset separators. Subscribes to the same per-instrument store
 * slices as TableRow so a price tick re-renders only this row. The virtualizer
 * measures a wrapper around this row (see ExchangeBoard), so it carries no ref.
 */
export const TokenCard = memo(function TokenCard({
  marketStore,
  instId,
  baseSymbol,
  index,
  isFavorite,
  onToggleFavorite,
}: TokenCardProps) {
  const ticker = useTicker(marketStore, instId);
  const rsi = useRsi(marketStore, instId);
  const fundingRate = useFunding(marketStore, instId);
  const marketCap = useMarketCap(marketStore, baseSymbol);

  const base = instId.split('-')[0];

  if (!ticker) return null;

  const dRsi = getRsiAvg(rsi?.rsi7, rsi?.rsi14);
  const wRsi = getRsiAvg(rsi?.rsiW7, rsi?.rsiW14);
  // Mobile: only show TD on a completed 9/13 signal (space is tight)
  const tdSignal = rsi?.td?.signal;
  const td = getTdDisplay(tdSignal ? rsi!.td : null);

  return (
    <div className="relative flex items-center gap-3 min-h-[64px] pl-2 pr-4 py-2.5 after:content-[''] after:absolute after:bottom-0 after:left-[80px] after:right-0 after:h-px after:bg-separator after:scale-y-50">
      <button
        type="button"
        onClick={() => onToggleFavorite(instId)}
        className={cn(
          'w-7 h-7 -mr-1.5 rounded-md grid place-items-center flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
          isFavorite ? 'text-star' : 'text-faint/60'
        )}
        aria-label={isFavorite ? `Remove ${base} from favorites` : `Add ${base} to favorites`}
        aria-pressed={isFavorite}
      >
        <Star className="w-3.5 h-3.5" fill={isFavorite ? 'currentColor' : 'none'} strokeWidth={1.6} aria-hidden="true" />
      </button>
      <TokenAvatar symbol={base} logo={marketCap?.logo} size="lg" className="w-8 h-8" />

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1.5">
          <span className="font-semibold text-[0.9375rem] tracking-[-0.01em] truncate" translate="no">{base}</span>
          <span className="text-[0.6875rem] text-faint tabular-nums">#{index + 1}</span>
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground whitespace-nowrap tabular-nums">
          <span>
            RSI{' '}
            <span className={cn('font-semibold', getRsiTextClass(dRsi))}>{dRsi != null ? dRsi.toFixed(0) : '—'}</span>
            <span className="text-faint"> / </span>
            <span className={cn('font-semibold', getRsiTextClass(wRsi))}>{wRsi != null ? wRsi.toFixed(0) : '—'}</span>
          </span>
          <span className="truncate">
            APR{' '}
            <span className={cn('font-medium', getFundingAprClass(fundingRate?.fundingRate))}>
              {formatFundingApr(fundingRate?.fundingRate, fundingRate?.settlementInterval)}
            </span>
          </span>
          {tdSignal && <span className={td.className}>{td.label}</span>}
        </div>
      </div>

      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <span className="font-medium text-[0.9375rem] tabular-nums leading-tight">{formatPrice(ticker.priceNum)}</span>
        <ChangePill change={ticker.changeNum} className="h-[22px] min-w-[64px] text-xs" />
      </div>
    </div>
  );
});
