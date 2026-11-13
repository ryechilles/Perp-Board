'use client';

import { Figure, Gauge, Panel, RSI_GAUGE_TICKS, RSI_GAUGE_ZONES, Stat } from '@/components/data';
import { Skeleton, Tag, TipBody } from '@/components/ui';
import { rsiTone } from '@/lib/format';
import { getRsiAvg, getRsiSignal } from '@/lib/utils';
import { UNIVERSE } from '@/lib/constants';
import { widgetUniverseNote } from '@/lib/widget-utils';

interface MarketRsiProps {
  avgRsi7: number | null;
  avgRsi14: number | null;
  exchangeLabel?: string;
}

const fmt = (v: number | null) => (v != null ? v.toFixed(1) : '—');

/** The market's average daily RSI: headline figure, gauge, and its two inputs. */
export function MarketRsi({ avgRsi7, avgRsi14, exchangeLabel = 'OKX' }: MarketRsiProps) {
  const signal = getRsiSignal(avgRsi7, avgRsi14);
  const avg = getRsiAvg(avgRsi7, avgRsi14);
  const tone = rsiTone(avg);

  return (
    <Panel
      title="Market RSI"
      note={`Top ${UNIVERSE.MAX_CRYPTO}`}
      loading={avgRsi7 === null && avgRsi14 === null}
      skeleton={
        <div className="flex flex-col gap-4">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-1 w-full rounded-full" />
        </div>
      }
      info={
        <TipBody
          title="Market RSI = (avg D-RSI7 + avg D-RSI14) / 2"
          items={[
            widgetUniverseNote(exchangeLabel),
            '≤20 Extreme oversold · ≤25 Oversold · ≤30 Very weak · ≤40 Weak',
            '≤60 Neutral · ≤70 Strong · ≤80 Very strong · ≤85 Overbought',
          ]}
        />
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-end gap-2.5">
          <Figure className="text-display font-semibold">{fmt(avg)}</Figure>
          <Tag tone={tone} className="mb-1">{signal.label}</Tag>
        </div>
        <Gauge
          zones={RSI_GAUGE_ZONES}
          position={avg}
          ticks={RSI_GAUGE_TICKS}
          tone={tone}
          label={avg != null ? `Market RSI ${avg.toFixed(1)}, ${signal.label}` : undefined}
        />
        <div className="grid grid-cols-2 gap-3">
          <Stat value={<Figure tone={rsiTone(avgRsi7)}>{fmt(avgRsi7)}</Figure>} label="Avg daily RSI 7" />
          <Stat value={<Figure tone={rsiTone(avgRsi14)}>{fmt(avgRsi14)}</Figure>} label="Avg daily RSI 14" />
        </div>
      </div>
    </Panel>
  );
}
