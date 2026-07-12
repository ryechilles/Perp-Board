'use client';

import { memo } from 'react';
import { MarketStore } from '@/lib/store/marketStore';
import {
  useTicker,
  useRsi,
  useFunding,
  useMarketCap,
} from '@/hooks/useMarketSelectors';
import { TokenAvatar } from '@/components/ui';
import {
  formatPrice,
  formatFundingApr,
  getFundingAprClass,
  getRsiSignal,
  getTdDisplay,
} from '@/lib/utils';
import { ChangeWithSparkline } from '@/components/Sparkline';

interface TokenCardProps {
  /** External store instance — each card subscribes to its own instrument slice. */
  marketStore: MarketStore;
  instId: string;
  baseSymbol: string;
  index: number;
  exchange?: 'okx' | 'hyperliquid';
  isFavorite: boolean;
  onToggleFavorite: (instId: string) => void;
}

/**
 * Mobile token card — the per-instrument unit shown below the `lg` breakpoint
 * in place of the (too-wide) desktop table row. Curated fixed fields: rank,
 * logo, symbol, price + 24h change, funding APR, and the daily/weekly RSI
 * signal pills. Subscribes to the same per-instrument store slices as TableRow
 * so a price tick re-renders only this card. The virtualizer measures a wrapper
 * around this card (see ExchangeBoard), so this component carries no ref.
 */
export const TokenCard = memo(function TokenCard({
  marketStore,
  instId,
  baseSymbol,
  index,
  exchange = 'okx',
  isFavorite,
  onToggleFavorite,
}: TokenCardProps) {
  const ticker = useTicker(marketStore, instId);
  const rsi = useRsi(marketStore, instId);
  const fundingRate = useFunding(marketStore, instId);
  const marketCap = useMarketCap(marketStore, baseSymbol);

  const parts = instId.split('-');
  const base = parts[0];
  const quote = parts[1] || (exchange === 'hyperliquid' ? 'USDC' : 'USDT');

  if (!ticker) return null;

  const dSignal = getRsiSignal(rsi?.rsi7 ?? null, rsi?.rsi14 ?? null);
  const wSignal = getRsiSignal(rsi?.rsiW7 ?? null, rsi?.rsiW14 ?? null);
  // Mobile card: only show TD pill on a completed 9/13 signal (space is tight)
  const tdSignal = rsi?.td?.signal;
  const td = getTdDisplay(tdSignal ? rsi!.td : null);

  return (
    <div className="bg-card rounded-xl border border-gray-950/[0.08] dark:border-white/[0.08] px-3 py-2.5">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => onToggleFavorite(instId)}
            className={`text-base leading-none rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${isFavorite ? 'text-yellow-400' : 'text-muted-foreground/50'}`}
            aria-label={isFavorite ? `Remove ${base} from favorites` : `Add ${base} to favorites`}
            aria-pressed={isFavorite}
          >
            {isFavorite ? '★' : '☆'}
          </button>
          <span className="text-[0.6875rem] text-muted-foreground w-4 text-right tabular-nums">
            {index + 1}
          </span>
          <TokenAvatar symbol={base} logo={marketCap?.logo} size="lg" />
          <span className="font-semibold text-[0.9375rem] truncate" translate="no">
            {base}
            <span className="text-muted-foreground font-normal text-[0.75rem]">/{quote}</span>
          </span>
          <div className="ml-auto text-right">
            <div className="font-medium text-[0.9375rem] tabular-nums leading-tight">
              {formatPrice(ticker.priceNum)}
            </div>
            <div className="text-[0.75rem] leading-tight">
              <ChangeWithSparkline change={ticker.changeNum} showSparkline={false} />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 mt-2.5">
          <span className="text-[0.75rem] text-muted-foreground whitespace-nowrap">
            APR{' '}
            <span className={`font-medium tabular-nums ${getFundingAprClass(fundingRate?.fundingRate)}`}>
              {formatFundingApr(fundingRate?.fundingRate, fundingRate?.settlementInterval)}
            </span>
          </span>
          <span className="flex gap-1.5 flex-wrap justify-end">
            {tdSignal && (
              <span className={td.className}>
                TD {td.label}
              </span>
            )}
            <span className={`inline-block px-2 py-0.5 rounded-md text-[0.6875rem] font-semibold whitespace-nowrap ${dSignal.pillStyle}`}>
              D {dSignal.label}
            </span>
            <span className={`inline-block px-2 py-0.5 rounded-md text-[0.6875rem] font-semibold whitespace-nowrap ${wSignal.pillStyle}`}>
              W {wSignal.label}
            </span>
          </span>
        </div>
      </div>
  );
});
