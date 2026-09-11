'use client';

import { TimeFrame } from '@/lib/widget-utils';
import { PillButtonGroup } from './PillButtonGroup';

interface TimeFrameSelectorProps {
  value: TimeFrame;
  onChange: (tf: TimeFrame) => void;
}

const OPTIONS = (['1h', '4h', '24h'] as TimeFrame[]).map((tf) => ({ value: tf, label: tf }));

/**
 * TimeFrameSelector
 * Compact segmented control for 1h/4h/24h time frames (widget headers)
 */
export function TimeFrameSelector({ value, onChange }: TimeFrameSelectorProps) {
  return <PillButtonGroup options={OPTIONS} value={value} onChange={onChange} size="sm" />;
}
