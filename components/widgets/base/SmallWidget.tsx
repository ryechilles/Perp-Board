'use client';

import { ReactNode, useState } from 'react';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui';

export interface SmallWidgetProps {
  /** Widget title displayed in header */
  title: string;
  /** Optional subtitle/description */
  subtitle?: string;
  /** Tooltip content - shows info icon, click to expand inline */
  tooltip?: ReactNode;
  /** Widget content */
  children: ReactNode;
  /** Optional header actions (buttons, etc.) */
  headerActions?: ReactNode;
  /** Additional CSS classes */
  className?: string;
  /** Content area padding - default: true */
  padded?: boolean;
  /** Loading state */
  loading?: boolean;
  /**
   * Custom skeleton shown while `loading`. When omitted, a generic shimmer
   * placeholder is rendered. Pass a layout-matched skeleton for the best fit.
   */
  skeleton?: ReactNode;
}

/**
 * SmallWidget - Base template for sidebar widgets
 *
 * An inset-grouped card (iOS Settings style): white surface, hairline shadow,
 * 14px corners, a title + secondary subtitle header, no header rule.
 *
 * - `padded={false}` lets list content run edge to edge (see TokenListRow)
 * - `tooltip` adds an ⓘ button that expands an explanation inline
 * - Keep semantic colors (up/down, cold/hot) for data, neutrals for chrome
 */
export function SmallWidget({
  title,
  subtitle,
  tooltip,
  children,
  headerActions,
  className,
  padded = true,
  loading = false,
  skeleton,
}: SmallWidgetProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <section className={cn('surface-card w-full min-w-[280px] flex flex-col', className)}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2 px-4 pt-3.5">
        <div className="min-w-0">
          <h2 className="text-[0.9375rem] leading-5 font-semibold tracking-[-0.015em] truncate">{title}</h2>
          {subtitle && (
            <p className="text-xs text-muted-foreground truncate mt-px">{subtitle}</p>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0 -mr-1">
          {headerActions}
          {tooltip && (
            <button
              type="button"
              onClick={() => setShowTooltip(!showTooltip)}
              className={cn(
                'w-6 h-6 rounded-full grid place-items-center text-faint transition-colors',
                'hover:bg-fill hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40',
                showTooltip && 'text-tint hover:text-tint'
              )}
              aria-label={`About ${title}`}
              aria-expanded={showTooltip}
            >
              <Info className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className={cn('flex-1', padded ? 'px-4 pt-3 pb-4' : 'pt-1.5 pb-1.5')}>
        {loading ? (
          <div className={cn(!padded && 'px-4 pt-1.5 pb-2.5')}>
            {skeleton ?? (
              <div className="space-y-2.5 min-h-[80px]">
                <Skeleton className="h-9 w-full rounded-xl" />
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            )}
          </div>
        ) : (
          <>
            {children}

            {/* Inline explanation */}
            {tooltip && showTooltip && (
              <div className={cn('mt-3 pt-3 hairline-t', !padded && 'mx-4 mb-2.5')}>
                <div className="text-[0.6875rem] text-muted-foreground space-y-1">
                  {tooltip}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

export default SmallWidget;
