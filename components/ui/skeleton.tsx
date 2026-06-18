'use client';

import { cn } from '@/lib/utils';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Additional CSS classes (set width/height/rounding here) */
  className?: string;
}

/**
 * Skeleton - Shimmer placeholder block for loading states.
 *
 * A muted base with a light highlight that sweeps left→right. The highlight
 * uses `via-foreground/10`, which adapts to the theme automatically: it darkens
 * the block in light mode and lightens it in dark mode, so the sweep stays
 * visible in both.
 *
 * Size and shape are controlled via className (w-*, h-*, rounded-*).
 *
 * @example
 * <Skeleton className="h-3 w-24" />
 * <Skeleton className="h-6 w-6 rounded-full" />
 */
export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-md bg-muted/60',
        'before:absolute before:inset-0 before:-translate-x-full',
        'before:animate-shimmer',
        'before:bg-gradient-to-r before:from-transparent before:via-foreground/10 before:to-transparent',
        className
      )}
      {...props}
    />
  );
}

export default Skeleton;
