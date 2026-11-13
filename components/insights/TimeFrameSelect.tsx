'use client';

import { Segmented } from '@/components/ui';
import { TimeFrame } from '@/lib/widget-utils';

const OPTIONS = (['1h', '4h', '24h'] as TimeFrame[]).map((tf) => ({ value: tf, label: tf }));

/** 1h / 4h / 24h switch for a panel header. */
export function TimeFrameSelect({ value, onChange }: { value: TimeFrame; onChange: (tf: TimeFrame) => void }) {
  return <Segmented options={OPTIONS} value={value} onChange={onChange} size="sm" label="Time frame" />;
}
