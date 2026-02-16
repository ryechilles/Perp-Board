'use client';

import { SlidersHorizontal } from 'lucide-react';
import { SmallWidget } from '@/components/widgets/base';
import { TooltipList } from '@/components/ui';
import { MA_FLOW } from '@/lib/constants';

interface MAFlowThresholdProps {
  value: number;
  onChange: (value: number) => void;
}

export function MAFlowThreshold({ value, onChange }: MAFlowThresholdProps) {
  return (
    <SmallWidget
      title="Convergence Threshold"
      icon={<SlidersHorizontal className="w-4 h-4" />}
      subtitle="MA7 / MA30 / MA200 spread filter"
      tooltip={
        <TooltipList
          items={[
            'Controls the max spread % shown across all timeframes',
            'Spread = distance between the 3 moving averages',
            <>
              <span className="text-green-500">{'≤ 1%'}</span>{': Extreme convergence — breakout imminent'}
            </>,
            <>
              <span className="text-yellow-600">{'2-5%'}</span>{': Lines are converging'}
            </>,
            <>
              <span className="text-red-500">{'>5%'}</span>{': Lines still spread apart'}
            </>,
            'OKX Perp Top 50 by 24h volume',
          ]}
        />
      }
    >
      <div className="space-y-3">
        {/* Current value display */}
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">Max Spread</span>
          <span className="text-sm font-semibold tabular-nums">
            {value.toFixed(1)}%
          </span>
        </div>

        {/* Slider */}
        <div className="relative">
          <input
            type="range"
            min={MA_FLOW.THRESHOLD_MIN}
            max={MA_FLOW.THRESHOLD_MAX}
            step={MA_FLOW.THRESHOLD_STEP}
            value={value}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-muted rounded-full appearance-none cursor-pointer
              [&::-webkit-slider-thumb]:appearance-none
              [&::-webkit-slider-thumb]:w-4
              [&::-webkit-slider-thumb]:h-4
              [&::-webkit-slider-thumb]:rounded-full
              [&::-webkit-slider-thumb]:bg-primary
              [&::-webkit-slider-thumb]:cursor-pointer
              [&::-webkit-slider-thumb]:shadow-sm
              [&::-moz-range-thumb]:w-4
              [&::-moz-range-thumb]:h-4
              [&::-moz-range-thumb]:rounded-full
              [&::-moz-range-thumb]:bg-primary
              [&::-moz-range-thumb]:border-0
              [&::-moz-range-thumb]:cursor-pointer"
          />
          {/* Labels */}
          <div className="flex justify-between mt-1">
            <span className="text-[10px] text-muted-foreground">{MA_FLOW.THRESHOLD_MIN}%</span>
            <span className="text-[10px] text-muted-foreground">{MA_FLOW.THRESHOLD_MAX}%</span>
          </div>
        </div>

        {/* Quick presets */}
        <div className="flex gap-1.5">
          {[1, 3, 5, 8, 10].map((preset) => (
            <button
              key={preset}
              onClick={() => onChange(preset)}
              className={`flex-1 text-[10px] py-1 rounded-md transition-colors
                ${value === preset
                  ? 'bg-primary text-primary-foreground font-medium'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                }`}
            >
              {preset}%
            </button>
          ))}
        </div>
      </div>
    </SmallWidget>
  );
}
