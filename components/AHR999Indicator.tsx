'use client';

import { useState, useEffect } from 'react';
import { SmallWidget } from '@/components/widgets/base';
import { TooltipList } from '@/components/ui';
import { fetchAHR999Data, getAHR999ZoneInfo, AHR999Data } from '@/lib/ahr999';
import { AHR999_ZONE_COLORS, AHR999_ZONE_LEGEND } from '@/lib/constants';

export function AHR999Indicator() {
  const [data, setData] = useState<AHR999Data | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const result = await fetchAHR999Data();
      setData(result);
      setLoading(false);
    };

    loadData();

    // Refresh every 5 minutes
    const interval = setInterval(loadData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const zoneInfo = getAHR999ZoneInfo(data?.value ?? null);

  // Calculate position percentage for the indicator (0-5 range mapped to 0-100%)
  const getPositionPercent = (value: number) => {
    return Math.min(Math.max((value / 5) * 100, 2), 98);
  };

  // BTC icon as header action
  const btcIcon = (
    <img
      src="https://assets.coingecko.com/coins/images/1/small/bitcoin.png"
      alt="BTC"
      className="w-5 h-5 rounded-full"
    />
  );

  return (
    <SmallWidget
      title="Ahr999 Index"
      icon={btcIcon}
      subtitle="BTC Accumulation Indicator"
      loading={loading}
      className="min-w-[280px] max-w-[320px] group"
      tooltip={
        <TooltipList items={[
          "BTC accumulation timing indicator",
          "Combines 200-day MA & growth curve",
          <><span className="text-green-500">&lt;0.45</span>: Strong buy zone</>,
          <><span className="text-red-500">&gt;4</span>: Consider taking profits</>,
        ]} />
      }
    >
      {/* Current Zone Display */}
      <div className={`rounded-lg px-4 py-3 mb-4 ${zoneInfo.bgColor || 'bg-muted'}`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] text-muted-foreground mb-0.5">Current Zone</div>
            <div className={`text-lg font-bold ${zoneInfo.color}`}>
              {zoneInfo.label}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[11px] text-muted-foreground mb-0.5">Value</div>
            <div className="text-lg font-bold text-foreground tabular-nums">
              {data?.value?.toFixed(2) ?? '--'}
            </div>
          </div>
        </div>
      </div>

      {/* Zone Bar */}
      <div>
        <div className="flex h-2 rounded-full overflow-hidden">
          {AHR999_ZONE_COLORS.map((zone, i) => (
            <div key={i} className={zone.color} style={{ width: zone.width }} />
          ))}
        </div>
        {/* Position indicator */}
        {data && (
          <div className="relative h-2 -mt-0.5">
            <div
              className="absolute w-0 h-0 border-l-[4px] border-r-[4px] border-b-[6px] border-l-transparent border-r-transparent border-b-foreground"
              style={{
                left: `${getPositionPercent(data.value)}%`,
                transform: 'translateX(-50%)'
              }}
            />
          </div>
        )}
      </div>

      {/* Zone Legend - Show on hover */}
      <div className="space-y-1 mt-0 max-h-0 overflow-hidden opacity-0 group-hover:mt-3 group-hover:max-h-32 group-hover:opacity-100 transition-all duration-200">
        {AHR999_ZONE_LEGEND.map((zone) => (
          <div
            key={zone.label}
            className={`flex items-center justify-between text-[11px] ${
              zoneInfo.label === zone.label ? 'font-medium' : 'opacity-60'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <span className={zone.color}>{zone.dot}</span>
              <span className="text-foreground">{zone.label}</span>
            </span>
            <span className="text-muted-foreground tabular-nums">{zone.range}</span>
          </div>
        ))}
      </div>
    </SmallWidget>
  );
}
