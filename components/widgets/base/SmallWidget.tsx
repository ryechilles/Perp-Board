'use client';

import { ReactNode, useState } from 'react';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, Card, CardHeader, CardContent, Skeleton } from '@/components/ui';

export interface SmallWidgetProps {
  /** Widget title displayed in header */
  title: string;
  /** Optional icon displayed before title */
  icon?: ReactNode;
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
 * SmallWidget - Base template for small dashboard widgets
 *
 * Standard dimensions: 280px - 360px width
 * Use for: Quick stats, mini charts, indicators
 *
 * Features:
 * - Built on shadcn/ui Card component
 * - Subtle border and shadow for definition
 * - Consistent styling across all widgets
 * - Click info icon to show/hide explanation inline (smooth expand)
 *
 * Design Guidelines:
 * - Avoid bg-muted for small elements (badges, counters) - looks boxy
 * - Use border instead of bg-muted for toggle groups
 * - Keep functional colors (green/red) for data, shadcn vars for UI
 * - hover states: use hover:bg-muted/50 (subtle, not solid)
 *
 * Tooltip Guidelines:
 * - Use <TooltipList> component from @/components/ui
 * - Pass array of strings or JSX elements
 * - Bullet points are added automatically
 * - Use colored spans for keywords
 *
 * @example
 * ```tsx
 * import { TooltipList } from '@/components/ui';
 *
 * <SmallWidget
 *   title="RSI Overview"
 *   icon={<Activity className="w-4 h-4" />}
 *   subtitle="Daily RSI distribution"
 *   tooltip={
 *     <TooltipList items={[
 *       "Simple text explanation",
 *       "Another point here",
 *       <><span className="text-red-500">Keyword</span>: with explanation</>,
 *     ]} />
 *   }
 * >
 *   <div>Your content here</div>
 * </SmallWidget>
 * ```
 */
export function SmallWidget({
  title,
  icon,
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
    <Card
      className={cn(
        // Size constraints
        'min-w-[280px] w-full',
        // Flex behavior in grid
        'flex flex-col',
        className
      )}
    >
      {/* Header */}
      <CardHeader className="flex flex-row items-center justify-between px-widget-header-px-sm py-widget-header-py border-b border-gray-950/[0.10] dark:border-white/[0.10] space-y-0">
        <div className="flex items-center gap-2 min-w-0">
          {icon && (
            <span className="text-muted-foreground flex-shrink-0" aria-hidden="true">{icon}</span>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="font-medium text-sm truncate text-pretty">
                {title}
              </h2>
              {tooltip && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowTooltip(!showTooltip)}
                  className={cn(
                    'h-5 w-5 rounded-full text-muted-foreground hover:text-foreground',
                    showTooltip && 'text-primary'
                  )}
                  aria-label="Toggle information"
                >
                  <Info className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
            {subtitle && (
              <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
            )}
          </div>
        </div>
        {headerActions && (
          <div className="flex items-center gap-1 flex-shrink-0 ml-2">
            {headerActions}
          </div>
        )}
      </CardHeader>

      {/* Content */}
      <CardContent className={cn('flex-1', padded ? 'p-4' : 'p-0')}>
        {loading ? (
          skeleton ?? (
            <div className="space-y-2.5 min-h-[80px]">
              <Skeleton className="h-9 w-full rounded-xl" />
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          )
        ) : (
          <>
            {children}

            {/* Inline Tooltip - auto height */}
            {tooltip && showTooltip && (
              <div className="mt-4 pt-3 border-t border-gray-950/[0.10] dark:border-white/[0.10]">
                <div className="text-[0.6875rem] text-muted-foreground space-y-1">
                  {tooltip}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default SmallWidget;
