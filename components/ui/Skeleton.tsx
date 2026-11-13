import { cn } from '@/lib/utils';

/**
 * Loading placeholder with a sweeping highlight. Size and shape come from
 * className: <Skeleton className="h-3 w-24" />, <Skeleton className="size-5 rounded-full" />
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'relative overflow-hidden rounded-tag bg-fill',
        'before:absolute before:inset-0 before:-translate-x-full before:animate-shimmer',
        'before:bg-gradient-to-r before:from-transparent before:via-fill-strong before:to-transparent',
        className
      )}
    />
  );
}
