'use client';

import { ReactNode, useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

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
  /** Background class for a small leading color dot (e.g. 'bg-hot') */
  dot?: string;
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
  /**
   * 'segmented' — Apple segmented control (shared track, raised selection).
   * 'chips' — free-standing toggle pills; selection inverts (filters, pickers).
   */
  variant?: 'segmented' | 'chips';
  /** Stretch segments to fill the container width (segmented only) */
  fullWidth?: boolean;
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
 * PillButton - Individual button with portal-based tooltip
 * Portal renders tooltip at document.body level to escape overflow:hidden/auto containers.
 */
function PillButton<T extends string = string>({
  option,
  active,
  isHovered,
  size,
  variant,
  fullWidth,
  onMouseEnter,
  onMouseLeave,
  onClick,
}: {
  option: PillButtonOption<T>;
  active: boolean;
  isHovered: boolean;
  size: 'sm' | 'md';
  variant: 'segmented' | 'chips';
  fullWidth: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onClick: () => void;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (isHovered && option.tooltip && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setTooltipPos({
        top: rect.bottom + 8,
        left: rect.left,
      });
    } else {
      setTooltipPos(null);
    }
  }, [isHovered, option.tooltip]);

  return (
    <div
      data-active={active || undefined}
      className={cn('relative', fullWidth && 'flex-1 min-w-0', option.hiddenOnMobile && 'hidden md:block')}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <button
        ref={buttonRef}
        type="button"
        onClick={onClick}
        onFocus={onMouseEnter}
        onBlur={onMouseLeave}
        disabled={option.disabled}
        aria-pressed={active}
        className={cn(
          'inline-flex items-center justify-center gap-1.5 whitespace-nowrap font-medium text-foreground',
          'transition-[color,background-color,box-shadow] duration-200',
          'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40',
          fullWidth && 'w-full',
          variant === 'segmented'
            ? cn(
                size === 'sm' ? 'h-6 px-2.5 text-xs rounded-md' : 'h-7 px-3.5 text-[0.8125rem] rounded-[7px]',
                fullWidth && 'px-1.5',
                active ? 'segment-on font-semibold' : 'hover:bg-fill'
              )
            : cn(
                size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-7 px-3 text-[0.8125rem]',
                'rounded-full',
                active ? 'bg-foreground text-background' : 'bg-fill hover:bg-fill-strong'
              ),
          option.disabled && 'pointer-events-none opacity-50'
        )}
      >
        {option.dot && <span className={cn('w-[7px] h-[7px] rounded-full flex-shrink-0', option.dot)} aria-hidden="true" />}
        {option.icon}
        {option.label}
        {option.badge !== undefined && (
          <span className={cn('tabular-nums font-medium', active && variant === 'chips' ? 'text-background/60' : 'text-faint')}>
            {option.badge}
          </span>
        )}
      </button>

      {/* Tooltip via portal — escapes overflow:auto containers */}
      {option.tooltip && isHovered && tooltipPos &&
        createPortal(
          <div
            className="fixed z-[9999] rounded-xl border border-separator bg-popover px-3 py-2.5 text-popover-foreground shadow-lg whitespace-nowrap animate-in fade-in-0 zoom-in-95"
            style={{ top: tooltipPos.top, left: tooltipPos.left }}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
          >
            {typeof option.tooltip === 'string' ? (
              <>
                <div className="text-[0.6875rem] font-medium text-muted-foreground mb-1">Filter criteria</div>
                <div className="text-xs">{option.tooltip}</div>
              </>
            ) : (
              option.tooltip
            )}
          </div>,
          document.body
        )
      }
    </div>
  );
}

/**
 * PillButtonGroup - Apple-style segmented control / toggle chips
 *
 * Supports both single-select and multi-select modes.
 */
export function PillButtonGroup<T extends string = string>(props: PillButtonGroupProps<T>) {
  const {
    options,
    value,
    onChange,
    className,
    size = 'md',
    variant = 'segmented',
    fullWidth = false,
    multiSelect = false,
    scrollable = false,
  } = props;

  const allowDeselect = !multiSelect && (props as PillButtonGroupSingleProps<T>).allowDeselect;

  const [hoveredValue, setHoveredValue] = useState<T | null>(null);

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
      role="group"
      className={cn(
        'items-center',
        variant === 'segmented' ? 'rounded-[9px] bg-fill p-0.5 gap-0.5' : 'gap-1',
        fullWidth
          ? 'flex w-full'
          : scrollable
            ? 'inline-flex flex-nowrap flex-shrink-0'
            : 'inline-flex flex-wrap',
        className
      )}
    >
      {options.map((option) => {
        const active = isActive(option.value);
        const isHovered = hoveredValue === option.value;

        return (
          <PillButton
            key={option.value}
            option={option}
            active={active}
            isHovered={isHovered}
            size={size}
            variant={variant}
            fullWidth={fullWidth}
            onMouseEnter={() => setHoveredValue(option.value)}
            onMouseLeave={() => setHoveredValue(null)}
            onClick={() => !option.disabled && handleClick(option.value)}
          />
        );
      })}
    </div>
  );
}

export default PillButtonGroup;
