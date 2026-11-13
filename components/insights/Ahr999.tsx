'use client';

import { useState, useEffect } from 'react';
import { Figure, Gauge, Panel } from '@/components/data';
import { Skeleton, Tag, TipBody, toneFill, toneFillSoft } from '@/components/ui';
import { cn } from '@/lib/utils';
import { fetchAHR999Data, getAHR999ZoneInfo, AHR999Data } from '@/lib/ahr999';
import { AHR999_ZONES } from '@/lib/constants';

// Module-level cache to avoid refetching on every tab switch (component remount)
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
let cachedData: AHR999Data | null = null;
let cachedAt = 0;

const TICKS = [
  { at: 0, label: '0' },
  { at: 9, label: '.45' },
  { at: 24, label: '1.2' },
  { at: 40, label: '2' },
  { at: 80, label: '4' },
  { at: 100, label: '5' },
];

/** AHR999 — BTC accumulation indicator: figure, zone gauge and the zone legend. */
export function Ahr999() {
  const [data, setData] = useState<AHR999Data | null>(cachedData);
  const [loading, setLoading] = useState(!cachedData);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const result = await fetchAHR999Data();
      cachedData = result;
      cachedAt = Date.now();
      setData(result);
      setLoading(false);
    };

    if (cachedData && Date.now() - cachedAt < CACHE_TTL) {
      setData(cachedData);
      setLoading(false);
    } else {
      loadData();
    }

    const interval = setInterval(loadData, CACHE_TTL);
    return () => clearInterval(interval);
  }, []);

  const zone = getAHR999ZoneInfo(data?.value ?? null);
  // Map the 0–5 value range onto the gauge (same linear scale as the zone widths)
  const position = data ? Math.min(Math.max((data.value / 5) * 100, 1), 99) : null;

  return (
    <Panel
      title="AHR999"
      note="BTC accumulation"
      loading={loading}
      skeleton={
        <div className="flex flex-col gap-4">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-1 w-full rounded-full" />
        </div>
      }
      info={
        <TipBody
          title="BTC accumulation timing indicator"
          items={['Combines the 200-day cost basis with the long-term growth curve', 'Below 0.45: strong buy zone', 'Above 4: consider taking profits']}
        />
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-end gap-2.5">
          <Figure className="text-display font-semibold">{data?.value?.toFixed(2) ?? '—'}</Figure>
          {zone.label !== '--' && <Tag tone={zone.tone} className="mb-1">{zone.label} zone</Tag>}
        </div>

        <Gauge
          zones={AHR999_ZONES}
          position={position}
          ticks={TICKS}
          tone={zone.tone}
          label={data ? `AHR999 ${data.value.toFixed(2)}, ${zone.label} zone` : undefined}
        />

        <ul className="flex list-none flex-col">
          {AHR999_ZONES.map((z) => (
            <li
              key={z.label}
              className={cn('flex h-control-sm items-center justify-between text-small', zone.label === z.label ? 'font-semibold text-fg' : 'text-fg-muted')}
            >
              <span className="flex items-center gap-2">
                <span
                  className={cn('size-1.5 rounded-full', z.tone === 'neutral' ? 'bg-track' : z.strong ? toneFill[z.tone] : toneFillSoft[z.tone])}
                  aria-hidden="true"
                />
                {z.label}
              </span>
              <span className="num font-normal text-fg-faint">{z.range}</span>
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  );
}
