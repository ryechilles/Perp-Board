'use client';

import { useState, useEffect } from 'react';
import { SmallWidget } from '@/components/widgets/base';
import { TooltipList, ZoneGauge, Skeleton } from '@/components/ui';
import { cn } from '@/lib/utils';
import { fetchAHR999Data, getAHR999ZoneInfo, AHR999Data } from '@/lib/ahr999';
import { AHR999_ZONE_COLORS, AHR999_ZONE_LEGEND } from '@/lib/constants';

// Module-level cache to avoid refetching on every tab switch (component remount)
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
let cachedData: AHR999Data | null = null;
let cachedAt = 0;

export function AHR999Indicator() {
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

    // Use cache if still fresh
    if (cachedData && Date.now() - cachedAt < CACHE_TTL) {
      setData(cachedData);
      setLoading(false);
    } else {
      loadData();
    }

    // Refresh every 5 minutes
    const interval = setInterval(loadData, CACHE_TTL);
    return () => clearInterval(interval);
  }, []);

  const zoneInfo = getAHR999ZoneInfo(data?.value ?? null);

  // Map the 0–5 value range onto the gauge (same linear scale as the zone widths)
  const position = data ? Math.min(Math.max((data.value / 5) * 100, 1), 99) : null;

  return (
    <SmallWidget
      title="AHR999"
      subtitle="BTC accumulation indicator"
      loading={loading}
      className="group"
      skeleton={
        <div className="space-y-4">
          <Skeleton className="h-10 w-32 rounded-lg" />
          <Skeleton className="h-2 w-full rounded-full" />
        </div>
      }
      tooltip={
        <TooltipList items={[
          "BTC accumulation timing indicator",
          "Combines 200-day MA & growth curve",
          <><span className="text-up-ink">&lt;0.45</span>: Strong buy zone</>,
          <><span className="text-down-ink">&gt;4</span>: Consider taking profits</>,
        ]} />
      }
    >
      <div className="flex items-baseline gap-2.5 mb-4">
        <span className="text-[2.75rem] leading-none font-semibold tracking-[-0.03em] tabular-nums">
          {data?.value?.toFixed(2) ?? '--'}
        </span>
        <span className={cn('inline-flex items-center h-[22px] px-2.5 rounded-full text-xs font-semibold', zoneInfo.bgColor)}>
          {zoneInfo.label === '--' ? '--' : `${zoneInfo.label} zone`}
        </span>
      </div>

      <ZoneGauge
        segments={AHR999_ZONE_COLORS.map((z) => ({ flex: parseFloat(z.width), className: z.color }))}
        position={position}
        ticks={[
          { at: 0, label: '0' },
          { at: 9, label: '.45' },
          { at: 24, label: '1.2' },
          { at: 40, label: '2' },
          { at: 80, label: '4' },
          { at: 100, label: '5' },
        ]}
        label={data ? `AHR999 ${data.value.toFixed(2)}, ${zoneInfo.label} zone` : undefined}
      />

      {/* Zone legend */}
      <div className="mt-3 pt-3 hairline-t space-y-1">
        {AHR999_ZONE_LEGEND.map((zone) => (
          <div
            key={zone.label}
            className={cn(
              'flex items-center justify-between text-xs',
              zoneInfo.label === zone.label ? 'font-semibold text-foreground' : 'text-muted-foreground'
            )}
          >
            <span className="flex items-center gap-2">
              <span className={cn('w-[7px] h-[7px] rounded-full', zone.color)} aria-hidden="true" />
              {zone.label}
            </span>
            <span className="tabular-nums text-faint">{zone.range}</span>
          </div>
        ))}
      </div>
    </SmallWidget>
  );
}
