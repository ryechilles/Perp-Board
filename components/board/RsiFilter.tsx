'use client';

import { debouncedSelect, debouncedRangeParse, handleNumberWheel } from '@/lib/inputUtils';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui';

interface RsiFilterProps {
  label: string;
  value: string | undefined;
  onChange: (value: string | undefined) => void;
}

const PRESETS = ['<25', '25~75', '>75'];

// One segment of the filter: a preset button or a typed-value slot.
const seg = 'inline-flex h-full items-center whitespace-nowrap rounded-tag px-1.5 text-small font-medium transition-colors';
const segOn = 'bg-surface-1 text-fg shadow-seg';
const segOff = 'text-fg-muted hover:text-fg';
const group = 'inline-flex h-control-sm items-center gap-0.5 rounded-control bg-fill p-0.5';
const input = 'num bg-transparent text-center text-small font-medium outline-none';

const selectOnFocus = (e: React.FocusEvent<HTMLInputElement>) => {
  const el = e.target;
  setTimeout(() => el.select(), 0);
};

/**
 * RSI range filter for one RSI series: clear (the label), three presets, and
 * three typed forms — below N, between N and M, above N. Scroll to step a value.
 */
export function RsiFilter({ label, value, onChange }: RsiFilterProps) {
  const isCustomLess = !!value?.startsWith('<') && value !== '<25';
  const isCustomRange = !!value?.includes('~') && value !== '25~75';
  const isCustomGreater = !!value?.startsWith('>') && value !== '>75';

  const rangeMin = isCustomRange && value ? value.split('~')[0] : '';
  const rangeMax = isCustomRange && value ? value.split('~')[1] : '';
  const lessValue = isCustomLess && value ? value.slice(1) : '';
  const greaterValue = isCustomGreater && value ? value.slice(1) : '';

  return (
    <div className="flex items-center gap-1.5">
      <div className={group} role="group" aria-label={`${label} presets`}>
        <Button variant="bare" aria-pressed={!value} onClick={() => onChange(undefined)} className={cn(seg, 'w-14 justify-center', !value ? segOn : segOff)}>
          {label}
        </Button>
        {PRESETS.map((preset) => (
          <Button key={preset} variant="bare" aria-pressed={value === preset} onClick={() => onChange(preset)} className={cn(seg, 'num', value === preset ? segOn : segOff)}>
            {preset}
          </Button>
        ))}
      </div>

      <label className={group}>
        <span className={cn(seg, 'cursor-text gap-0.5', isCustomLess ? segOn : segOff)}>
          &lt;
          <input
            type="number" min="1" max="100" step="1" inputMode="numeric"
            aria-label={`${label} less than`}
            value={lessValue}
            onChange={(e) => {
              let val = e.target.value;
              if (val === '') return onChange(undefined);
              if (val === '25') val = '24';
              onChange(`<${val}`);
              debouncedSelect(e.target);
            }}
            onWheel={(e) => handleNumberWheel(e, lessValue, 1, 100, 1, (v) => onChange(`<${v}`), [25])}
            onFocus={selectOnFocus}
            className={cn(input, 'w-5')}
          />
        </span>
      </label>

      <div className={group}>
        <span className={cn(seg, 'gap-0.5', isCustomRange ? segOn : segOff)}>
          <input
            type="number" min="1" max="100" step="1" inputMode="numeric"
            aria-label={`${label} range minimum`}
            value={rangeMin}
            onChange={(e) => {
              const val = e.target.value;
              if (val === '' && rangeMax === '') return onChange(undefined);
              onChange(`${val}~${rangeMax}`);
              debouncedRangeParse(e.target, val, (min, max) => onChange(`${min}~${max}`));
            }}
            onWheel={(e) => handleNumberWheel(e, rangeMin, 1, 100, 1, (v) => onChange(`${v}~${rangeMax}`), [25, 75])}
            onFocus={selectOnFocus}
            className={cn(input, 'w-5')}
          />
          ~
          <input
            type="number" min="1" max="100" step="1" inputMode="numeric"
            aria-label={`${label} range maximum`}
            value={rangeMax}
            onChange={(e) => {
              const val = e.target.value;
              if (rangeMin === '' && val === '') return onChange(undefined);
              onChange(`${rangeMin}~${val}`);
              debouncedRangeParse(e.target, val, (min, max) => onChange(`${min}~${max}`));
            }}
            onWheel={(e) => handleNumberWheel(e, rangeMax, 1, 100, 1, (v) => onChange(`${rangeMin}~${v}`), [25, 75])}
            onFocus={selectOnFocus}
            className={cn(input, 'w-5')}
          />
        </span>
      </div>

      <label className={group}>
        <span className={cn(seg, 'cursor-text gap-0.5', isCustomGreater ? segOn : segOff)}>
          &gt;
          <input
            type="number" min="1" max="100" step="1" inputMode="numeric"
            aria-label={`${label} greater than`}
            value={greaterValue}
            onChange={(e) => {
              let val = e.target.value;
              if (val === '') return onChange(undefined);
              if (val === '75') val = '76';
              onChange(`>${val}`);
              debouncedSelect(e.target);
            }}
            onWheel={(e) => handleNumberWheel(e, greaterValue, 1, 100, 1, (v) => onChange(`>${v}`), [75])}
            onFocus={selectOnFocus}
            className={cn(input, 'w-5')}
          />
        </span>
      </label>
    </div>
  );
}
