'use client';

import { debouncedSelect, debouncedRangeParse, handleNumberWheel } from '@/lib/inputUtils';
import { cn } from '@/lib/utils';

interface RsiFilterProps {
  label: string;
  value: string | undefined;
  onChange: (value: string | undefined) => void;
}

/**
 * Reusable RSI Filter component - built on shadcn/ui design system
 * Supports: preset buttons (<25, 25~75, >75), custom inputs (<, ~, >)
 */
export function RsiFilter({ label, value, onChange }: RsiFilterProps) {
  const isCustomLess = value?.startsWith('<') && value !== '<25';
  const isCustomRange = value?.includes('~') && value !== '25~75';
  const isCustomGreater = value?.startsWith('>') && value !== '>75';

  const rangeMin = isCustomRange && value ? value.split('~')[0] : '';
  const rangeMax = isCustomRange && value ? value.split('~')[1] : '';

  const inputClass = "bg-transparent text-xs font-medium text-center outline-none cursor-pointer";
  const focusHandler = (e: React.FocusEvent<HTMLInputElement>) => setTimeout(() => e.target.select(), 0);
  const clickHandler = (e: React.MouseEvent<HTMLInputElement>) => setTimeout(() => (e.target as HTMLInputElement).select(), 0);

  const buttonBase = "px-2 py-1 rounded-md text-xs font-medium transition-all";
  const buttonActive = "bg-background text-foreground shadow-sm";
  const buttonInactive = "text-muted-foreground hover:text-foreground";

  return (
    <div className="inline-flex items-center gap-2">
      {/* Label + Presets */}
      <div className="inline-flex bg-muted rounded-lg p-0.5 gap-0.5 items-center">
        {/* Label */}
        <button
          onClick={() => onChange(undefined)}
          className={cn(buttonBase, "w-[66px] text-center whitespace-nowrap", !value ? buttonActive : buttonInactive)}
        >
          {label}
        </button>

        {/* Presets */}
        {['<25', '25~75', '>75'].map(preset => (
          <button
            key={preset}
            onClick={() => onChange(preset)}
            className={cn(buttonBase, value === preset ? buttonActive : buttonInactive)}
          >
            {preset}
          </button>
        ))}
      </div>

      {/* Custom < */}
      <div className="inline-flex bg-muted rounded-lg p-0.5 items-center">
        <div
          onClick={(e) => {
            if (!isCustomLess) onChange(undefined);
            e.currentTarget.querySelector('input')?.focus();
          }}
          className={cn(
            "flex items-center px-2 py-1 rounded-md text-xs font-medium transition-all cursor-pointer",
            isCustomLess
              ? buttonActive
              : cn(buttonInactive, "focus-within:bg-background focus-within:shadow-sm focus-within:text-foreground")
          )}
        >
          <span>&lt;</span>
          <input
            type="number" min="1" max="100" step="1"
            inputMode="numeric"
            aria-label={`${label} less than`}
            value={isCustomLess && value ? value.slice(1) : ''}
            onChange={(e) => {
              let val = e.target.value;
              if (val === '') { onChange(undefined); }
              else {
                if (val === '25') val = '24';
                onChange(`<${val}`);
                debouncedSelect(e.target);
              }
            }}
            onWheel={(e) => handleNumberWheel(e, isCustomLess && value ? value.slice(1) : '', 1, 100, 1, (v) => onChange(`<${v}`), [25])}
            onFocus={focusHandler} onClick={clickHandler}
            className={`w-7 ${inputClass}`}
          />
        </div>
      </div>

      {/* Custom range ~ */}
      <div className="inline-flex bg-muted rounded-lg p-0.5 items-center">
        <div
          onClick={(e) => {
            if (!isCustomRange) onChange(undefined);
            if (!(e.target instanceof HTMLInputElement)) e.currentTarget.querySelector('input')?.focus();
          }}
          className={cn(
            "flex items-center px-2 py-1 rounded-md text-xs font-medium transition-all cursor-pointer",
            isCustomRange
              ? buttonActive
              : cn(buttonInactive, "focus-within:bg-background focus-within:shadow-sm focus-within:text-foreground")
          )}
        >
          <input
            type="number" min="1" max="100" step="1"
            inputMode="numeric"
            aria-label={`${label} range minimum`}
            value={rangeMin}
            onChange={(e) => {
              const val = e.target.value;
              if (val === '' && rangeMax === '') { onChange(undefined); }
              else {
                onChange(`${val}~${rangeMax}`);
                debouncedRangeParse(e.target, val, (min, max) => onChange(`${min}~${max}`));
              }
            }}
            onWheel={(e) => handleNumberWheel(e, rangeMin, 1, 100, 1, (v) => onChange(`${v}~${rangeMax}`), [25, 75])}
            onFocus={focusHandler} onClick={clickHandler}
            className={`w-6 ${inputClass}`}
          />
          <span>~</span>
          <input
            type="number" min="1" max="100" step="1"
            inputMode="numeric"
            aria-label={`${label} range maximum`}
            value={rangeMax}
            onChange={(e) => {
              const val = e.target.value;
              if (rangeMin === '' && val === '') { onChange(undefined); }
              else {
                onChange(`${rangeMin}~${val}`);
                debouncedRangeParse(e.target, val, (min, max) => onChange(`${min}~${max}`));
              }
            }}
            onWheel={(e) => handleNumberWheel(e, rangeMax, 1, 100, 1, (v) => onChange(`${rangeMin}~${v}`), [25, 75])}
            onFocus={focusHandler} onClick={clickHandler}
            className={`w-6 ${inputClass}`}
          />
        </div>
      </div>

      {/* Custom > */}
      <div className="inline-flex bg-muted rounded-lg p-0.5 items-center">
        <div
          onClick={(e) => {
            if (!isCustomGreater) onChange(undefined);
            e.currentTarget.querySelector('input')?.focus();
          }}
          className={cn(
            "flex items-center px-2 py-1 rounded-md text-xs font-medium transition-all cursor-pointer",
            isCustomGreater
              ? buttonActive
              : cn(buttonInactive, "focus-within:bg-background focus-within:shadow-sm focus-within:text-foreground")
          )}
        >
          <span>&gt;</span>
          <input
            type="number" min="1" max="100" step="1"
            inputMode="numeric"
            aria-label={`${label} greater than`}
            value={isCustomGreater && value ? value.slice(1) : ''}
            onChange={(e) => {
              let val = e.target.value;
              if (val === '') { onChange(undefined); }
              else {
                if (val === '75') val = '76';
                onChange(`>${val}`);
                debouncedSelect(e.target);
              }
            }}
            onWheel={(e) => handleNumberWheel(e, isCustomGreater && value ? value.slice(1) : '', 1, 100, 1, (v) => onChange(`>${v}`), [75])}
            onFocus={focusHandler} onClick={clickHandler}
            className={`w-7 ${inputClass}`}
          />
        </div>
      </div>
    </div>
  );
}
