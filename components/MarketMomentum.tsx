'use client';

import { SmallWidget } from '@/components/widgets/base';
import { TooltipList, Skeleton, ZoneGauge } from '@/components/ui';
import { cn, getRsiAvg, getRsiSignal, getRsiTextClass } from '@/lib/utils';
import { RSI, UNIVERSE } from '@/lib/constants';
import { widgetUniverseNote } from '@/lib/widget-utils';

interface MarketMomentumProps {
  avgRsi7: number | null;
  avgRsi14: number | null;
  exchangeLabel?: string;
}

// Zone segments on the 0–100 RSI scale (same breakpoints as the table meters)
const RSI_SEGMENTS = [
  { flex: RSI.OVERSOLD, className: 'bg-cold' },
  { flex: RSI.WEAK - RSI.OVERSOLD, className: 'bg-cold-soft' },
  { flex: RSI.NEUTRAL_HIGH - RSI.WEAK, className: 'bg-zone-neutral' },
  { flex: RSI.VERY_STRONG - RSI.NEUTRAL_HIGH, className: 'bg-hot-soft' },
  { flex: 100 - RSI.VERY_STRONG, className: 'bg-hot' },
];

const RSI_TICKS = [0, RSI.OVERSOLD, RSI.WEAK, RSI.NEUTRAL_HIGH, RSI.VERY_STRONG, 100].map((v) => ({
  at: v,
  label: String(v),
}));

export function MarketMomentum({ avgRsi7, avgRsi14, exchangeLabel = 'OKX' }: MarketMomentumProps) {
  const signal = getRsiSignal(avgRsi7, avgRsi14);
  const avg = getRsiAvg(avgRsi7, avgRsi14);

  const isLoading = avgRsi7 === null && avgRsi14 === null;

  return (
    <SmallWidget
      title="Market RSI"
      subtitle={`Avg daily RSI · Top ${UNIVERSE.MAX_CRYPTO} ${exchangeLabel} perps`}
      loading={isLoading}
      skeleton={
        <div className="space-y-4">
          <Skeleton className="h-10 w-32 rounded-lg" />
          <Skeleton className="h-2 w-full rounded-full" />
        </div>
      }
      tooltip={
        <TooltipList items={[
          widgetUniverseNote(exchangeLabel),
          "Market RSI = (avg D-RSI7 + avg D-RSI14) / 2",
          "≤20 Extreme oversold · ≤25 Oversold · ≤30 Very weak · ≤40 Weak",
          "≤60 Neutral · ≤70 Strong · ≤80 Very strong · ≤85 Overbought · >85 Extreme overbought",
        ]} />
      }
    >
      <div className="flex items-baseline gap-2.5 mb-4">
        <span className="text-[2.75rem] leading-none font-semibold tracking-[-0.03em] tabular-nums">
          {avg != null ? avg.toFixed(1) : '--'}
        </span>
        <span className={cn('inline-flex items-center h-[22px] px-2.5 rounded-full text-xs font-semibold', signal.pillStyle)}>
          {signal.label}
        </span>
      </div>

      <ZoneGauge
        segments={RSI_SEGMENTS}
        position={avg}
        ticks={RSI_TICKS}
        label={avg != null ? `Market RSI ${avg.toFixed(1)}, ${signal.label}` : undefined}
      />

      <div className="flex items-center justify-between mt-3 pt-3 hairline-t text-xs text-muted-foreground tabular-nums">
        <span>
          Avg D-RSI7{' '}
          <span className={cn('font-semibold', getRsiTextClass(avgRsi7))}>{avgRsi7 != null ? avgRsi7.toFixed(1) : '--'}</span>
        </span>
        <span>
          Avg D-RSI14{' '}
          <span className={cn('font-semibold', getRsiTextClass(avgRsi14))}>{avgRsi14 != null ? avgRsi14.toFixed(1) : '--'}</span>
        </span>
      </div>
    </SmallWidget>
  );
}
