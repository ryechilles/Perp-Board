'use client';

import { ReactNode } from 'react';
import type { Tone } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Tip } from './Tooltip';
import { toneFill } from './tone';

export interface ChipOption<T extends string = string> {
  value: T;
  label: string;
  /** Leading colour dot */
  dot?: Tone;
  /** Trailing count */
  count?: number;
  tooltip?: ReactNode;
}

interface ChipsBase<T extends string> {
  options: ChipOption<T>[];
  size?: 'sm' | 'md';
  /** Accessible name for the group */
  label?: string;
  /** Keep on one line (toolbars) instead of wrapping (drawers) */
  nowrap?: boolean;
  className?: string;
}
interface ChipsSingle<T extends string> extends ChipsBase<T> {
  multiple?: false;
  /** The selected value; anything not in `options` (or undefined) selects nothing */
  value: T | undefined;
  /** Receives undefined when the active chip is clicked again */
  onChange: (value: T | undefined) => void;
}
interface ChipsMulti<T extends string> extends ChipsBase<T> {
  multiple: true;
  value: T[];
  onChange: (value: T[]) => void;
}
export type ChipsProps<T extends string> = ChipsSingle<T> | ChipsMulti<T>;

/** Filters you switch on and off. Single-select chips toggle; multi-select accumulate. */
export function Chips<T extends string>(props: ChipsProps<T>) {
  const { options, size = 'md', label, nowrap = false, className } = props;

  const isActive = (v: T) => (props.multiple ? props.value.includes(v) : props.value === v);
  const toggle = (v: T) => {
    if (props.multiple) {
      props.onChange(props.value.includes(v) ? props.value.filter((x) => x !== v) : [...props.value, v]);
    } else {
      props.onChange(props.value === v ? undefined : v);
    }
  };

  return (
    <div
      role="group"
      aria-label={label}
      className={cn('inline-flex items-center gap-1.5', nowrap ? 'flex-shrink-0 flex-nowrap' : 'flex-wrap', className)}
    >
      {options.map((option) => {
        const active = isActive(option.value);
        return (
          <Tip key={option.value} content={option.tooltip}>
            <button
              type="button"
              aria-pressed={active}
              onClick={() => toggle(option.value)}
              className={cn(
                'focus-ring inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-medium transition-colors',
                size === 'sm' ? 'h-control-sm px-2.5 text-small' : 'h-control-md px-2.5 text-body',
                active
                  ? 'bg-accent-soft text-accent shadow-edge-accent'
                  : 'text-fg-muted shadow-edge hover:bg-fill hover:text-fg'
              )}
            >
              {option.dot && <span className={cn('size-1.5 rounded-full', toneFill[option.dot])} aria-hidden="true" />}
              {option.label}
              {option.count !== undefined && (
                <span className={cn('num text-caption', active ? 'text-accent/70' : 'text-fg-faint')}>{option.count}</span>
              )}
            </button>
          </Tip>
        );
      })}
    </div>
  );
}
