'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui';

export interface LargeWidgetProps {
  /** Widget title displayed in header */
  title: string;
  /** Optional icon displayed before title */
  icon?: ReactNode;
  /** Optional subtitle/description */
  subtitle?: string;
  /** Widget content */
  children: ReactNode;
  /** Optional header actions (buttons, dropdowns, etc.) */
  headerActions?: ReactNode;
  /** Optional footer content */
  footer?: ReactNode;
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
  /** Whether to allow content scrolling */
  scrollable?: boolean;
}

/**
 * LargeWidget - Base template for large dashboard widgets
 *
 * Standard dimensions: 400px+ width, flexible height
 * Use for: Charts, detailed tables, multi-section content
 *
 * Features:
 * - Flat card style matching PillButton aesthetic
 * - Subtle border and shadow for definition
 * - Consistent styling across all widgets
 *
 * @example
 * ```tsx
 * <LargeWidget
 *   title="Market Momentum"
 *   icon={<TrendingUp className="w-5 h-5" />}
 *   subtitle="Top movers by volume and price action"
 *   headerActions={<Button size="sm">Refresh</Button>}
 *   footer={<div>Last updated: 5m ago</div>}
 * >
 *   <div>Your content here</div>
 * </LargeWidget>
 * ```
 */
export function LargeWidget({
  title,
  icon,
  subtitle,
  children,
  headerActions,
  footer,
  className,
  padded = true,
  loading = false,
  skeleton,
  scrollable = false,
}: LargeWidgetProps) {
  return (
    <div
      className={cn(
        // Base styles - flat card matching PillButton style
        'bg-card rounded-xl',
        // Consistent border (not ring — ring gets clipped by overflow parents)
        'border border-gray-950/[0.10] dark:border-white/[0.10] shadow-sm',
        // Size constraints
        'min-w-[400px] flex-1',
        // Flex layout
        'flex flex-col',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-widget-header-px-lg py-widget-header-py border-b border-gray-950/[0.10] dark:border-white/[0.10]">
        <div className="flex items-center gap-3 min-w-0">
          {icon && (
            <span className="text-muted-foreground flex-shrink-0">{icon}</span>
          )}
          <div className="min-w-0">
            <h2 className="font-semibold text-foreground truncate text-pretty">{title}</h2>
            {subtitle && (
              <p className="text-sm text-muted-foreground truncate">{subtitle}</p>
            )}
          </div>
        </div>
        {headerActions && (
          <div className="flex items-center gap-2 flex-shrink-0 ml-3">
            {headerActions}
          </div>
        )}
      </div>

      {/* Content */}
      <div
        className={cn(
          'flex-1',
          padded && 'p-widget-content-lg',
          scrollable && 'overflow-auto'
        )}
      >
        {loading ? (
          skeleton ?? (
            <div className="space-y-3 min-h-[120px]">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-28 w-full rounded-lg" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          )
        ) : (
          children
        )}
      </div>

      {/* Footer */}
      {footer && (
        <div className="px-widget-header-px-lg py-widget-header-py border-t border-gray-950/[0.10] dark:border-white/[0.10] text-sm text-muted-foreground">
          {footer}
        </div>
      )}
    </div>
  );
}

export default LargeWidget;
