'use client';

import { ReactNode, useState } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from './badge';

// Single button option
export interface PillButtonOption<T extends string = string> {
  /** Unique value for this option */
  value: T;
  /** Display label */
  label: string;
  /** Optional icon/emoji before label */
  icon?: ReactNode;
  /** Optional badge/count after label */
  badge?: string | number;
  /** Disabled state */
  disabled?: boolean;
  /** Hidden on mobile (show only on md+) */
  hiddenOnMobile?: boolean;
  /** Custom active color class (e.g., 'text-red-500', 'text-green-500') */
  activeColor?: string;
  /** Tooltip content (string or ReactNode) */
  tooltip?: ReactNode;
}

// Base props shared by single and multi-select
interface PillButtonGroupBaseProps<T extends string = string> {
  /** Available options */
  options: PillButtonOption<T>[];
  /** Additional CSS classes for container */
  className?: string;
  /** Size variant: 'sm' for compact, 'md' for default */
  size?: 'sm' | 'md';
  /** Scroll horizontally instead of wrapping (ideal for tab bars) */
  scrollable?: boolean;
}

// Single-select props (default)
interface PillButtonGroupSingleProps<T extends string = string> extends PillButtonGroupBaseProps<T> {
  /** Multi-select mode disabled (default) */
  multiSelect?: false;
  /** Currently selected value */
  value: T;
  /** Callback when selection changes */
  onChange: (value: T) => void;
  /** Allow deselecting (clicking active item clears selection) */
  allowDeselect?: boolean;
}

// Multi-select props
interface PillButtonGroupMultiProps<T extends string = string> extends PillButtonGroupBaseProps<T> {
  /** Enable multi-select mode */
  multiSelect: true;
  /** Currently selected values */
  value: T[];
  /** Callback when selection changes */
  onChange: (value: T[]) => void;
  /** Not applicable in multi-select */
  allowDeselect?: never;
}

// Union type for props
export type PillButtonGroupProps<T extends string = string> =
  | PillButtonGroupSingleProps<T>
  | PillButtonGroupMultiProps<T>;

/**
 * PillButtonGroup - Segmented control built on shadcn/ui design system
 *
 * A group of toggle buttons with pill/rounded style.
 * Supports both single-select and multi-select modes.
 */
export function PillButtonGroup<T extends string = string>(props: PillButtonGroupProps<T>) {
  const {
    options,
    value,
    onChange,
    className,
    size = 'md',
    multiSelect = false,
    scrollable = false,
  } = props;

  const allowDeselect = !multiSelect && (props as PillButtonGroupSingleProps<T>).allowDeselect;

  const [hoveredValue, setHoveredValue] = useState<T | null>(null);

  // Size-based styles using design token heights
  const sizeStyles = {
    sm: 'h-control-compact px-2.5 text-xs',
    md: 'h-control-default px-3 text-sm',
  };

  // Check if a value is active
  const isActive = (optionValue: T): boolean => {
    if (multiSelect) {
      return (value as T[]).includes(optionValue);
    }
    return value === optionValue;
  };

  // Handle click
  const handleClick = (optionValue: T) => {
    if (multiSelect) {
      const currentValues = value as T[];
      const newValues = currentValues.includes(optionValue)
        ? currentValues.filter(v => v !== optionValue)
        : [...currentValues, optionValue];
      (onChange as (value: T[]) => void)(newValues);
    } else {
      if (allowDeselect && value === optionValue) {
        (onChange as (value: T) => void)(undefined as unknown as T);
      } else {
        (onChange as (value: T) => void)(optionValue);
      }
    }
  };

  return (
    <div
      className={cn(
        'items-center rounded-lg bg-muted p-1 gap-0.5',
        scrollable
          ? 'inline-flex flex-nowrap flex-shrink-0'
          : 'inline-flex flex-wrap',
        className
      )}
    >
      {options.map((option) => {
        const active = isActive(option.value);
        const isHovered = hoveredValue === option.value;

        return (
          <div
            key={option.value}
            data-active={active || undefined}
            className={cn('relative', option.hiddenOnMobile && 'hidden md:block')}
            onMouseEnter={() => setHoveredValue(option.value)}
            onMouseLeave={() => setHoveredValue(null)}
          >
            <button
              onClick={() => !option.disabled && handleClick(option.value)}
              disabled={option.disabled}
              className={cn(
                // Base styles - shadcn button-like
                'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-medium',
                'ring-offset-background transition-all',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                sizeStyles[size],
                // Active state
                active
                  ? cn(
                      'bg-background text-foreground shadow-sm',
                      option.activeColor
                    )
                  : 'text-muted-foreground hover:text-foreground hover:bg-black/[0.06] dark:hover:bg-white/[0.08]',
                // Disabled state
                option.disabled && 'pointer-events-none opacity-50'
              )}
            >
              {option.icon}
              {option.label}
              {option.badge !== undefined && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                  {option.badge}
                </Badge>
              )}
            </button>

            {/* Tooltip - using shadcn card-like styling */}
            {option.tooltip && isHovered && (
              <div className="absolute top-full left-0 mt-2 z-50 rounded-md border border-gray-950/[0.10] dark:border-white/[0.10] bg-popover p-3 text-popover-foreground shadow-md whitespace-nowrap animate-in fade-in-0 zoom-in-95">
                {typeof option.tooltip === 'string' ? (
                  <>
                    <div className="text-[11px] font-medium text-muted-foreground mb-1">Filter Criteria</div>
                    <div className="text-xs">{option.tooltip}</div>
                  </>
                ) : (
                  option.tooltip
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default PillButtonGroup;
