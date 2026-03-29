'use client';

import { TimeFrame } from '@/lib/widget-utils';
import { ToggleGroup, ToggleGroupItem } from './toggle-group';

interface TimeFrameSelectorProps {
  value: TimeFrame;
  onChange: (tf: TimeFrame) => void;
}

/**
 * TimeFrameSelector
 * Shared component for selecting 1h/4h/24h time frames
 * Built on shadcn/ui ToggleGroup
 */
export function TimeFrameSelector({ value, onChange }: TimeFrameSelectorProps) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(v) => v && onChange(v as TimeFrame)}
      size="sm"
      className="gap-tight"
    >
      {(['1h', '4h', '24h'] as TimeFrame[]).map((tf) => (
        <ToggleGroupItem
          key={tf}
          value={tf}
          onClick={(e) => e.stopPropagation()}
          className="h-control-compact px-2.5 text-xs data-[state=on]:bg-background data-[state=on]:shadow-sm"
        >
          {tf}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
