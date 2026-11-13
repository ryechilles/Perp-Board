'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Tip } from './Tooltip';

export interface SegmentedOption<T extends string = string> {
  value: T;
  label: string;
  icon?: ReactNode;
  tooltip?: ReactNode;
}

interface SegmentedProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
  /** Accessible name for the group */
  label?: string;
  className?: string;
}

/** Mutually exclusive views of the same thing (exchange, asset class, time frame). */
export function Segmented<T extends string>({ options, value, onChange, size = 'md', label, className }: SegmentedProps<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        'inline-flex flex-shrink-0 items-center gap-0.5 rounded-control bg-fill p-0.5',
        size === 'sm' ? 'h-control-sm' : 'h-control-md',
        className
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Tip key={option.value} content={option.tooltip}>
            <button
              type="button"
              aria-pressed={active}
              onClick={() => onChange(option.value)}
              className={cn(
                'focus-ring inline-flex h-full items-center gap-1.5 whitespace-nowrap rounded-tag font-medium transition-colors',
                size === 'sm' ? 'px-2 text-small' : 'px-2.5 text-body',
                active ? 'bg-surface-1 text-fg shadow-seg' : 'text-fg-muted hover:text-fg'
              )}
            >
              {option.icon}
              {option.label}
            </button>
          </Tip>
        );
      })}
    </div>
  );
}
