'use client';

import { memo } from 'react';
import { MarketStore } from '@/lib/store/marketStore';
import { useTicker, useRsi, useFunding, useMarketCap } from '@/hooks/useMarketSelectors';
import { TokenAvatar } from '@/components/ui';
import { Delta, FavoriteButton, Figure, FundingValue, Price, RsiReading, Sparkline, TdValue } from '@/components/data';
import { getRsiAvg } from '@/lib/utils';

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
 * One instrument below the `lg` breakpoint, where the table does not fit:
 * symbol with RSI / funding underneath, a 7-day sparkline, price and 24h change.
 * Same data components as the table row, so the colour rules are identical.
 */
export const TokenCard = memo(function TokenCard({ marketStore, instId, baseSymbol, index, isFavorite, onToggleFavorite }: TokenCardProps) {
  const ticker = useTicker(marketStore, instId);
  const rsi = useRsi(marketStore, instId);
  const funding = useFunding(marketStore, instId);
  const marketCap = useMarketCap(marketStore, baseSymbol);

  if (!ticker) return null;

  const base = instId.split('-')[0];
  const sparkline = rsi?.sparkline7d || marketCap?.sparkline;

  return (
    <div className="flex min-h-14 items-center gap-2.5 py-2 pl-1 pr-4 rule-b">
      <FavoriteButton size="card" symbol={base} active={isFavorite} onToggle={() => onToggleFavorite(instId)} />
      <TokenAvatar symbol={base} logo={marketCap?.logo} size="lg" className="-ml-1.5" />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-title font-semibold" translate="no">{base}</span>
          <Figure className="text-caption text-fg-faint">{index + 1}</Figure>
          {/* Space is tight: only a completed 9 / 13 earns a place */}
          {rsi?.td?.signal && <TdValue td={rsi.td} />}
        </div>
        <div className="flex items-center gap-2 whitespace-nowrap text-small text-fg-muted">
          <span>
            RSI <RsiReading value={getRsiAvg(rsi?.rsi7, rsi?.rsi14)} meter={false} />
          </span>
          <span className="truncate">
            Fund <FundingValue rate={funding?.fundingRate} interval={funding?.settlementInterval} />
          </span>
        </div>
      </div>

      {rsi?.change7d != null && <Sparkline data={sparkline} change={rsi.change7d} width={52} height={22} />}

      <div className="flex flex-shrink-0 flex-col items-end">
        <Price value={ticker.priceNum} className="text-title font-medium" />
        <Delta value={ticker.changeNum} className="text-small" />
      </div>
    </div>
  );
});
