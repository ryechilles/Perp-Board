'use client';

import { ColumnKey } from '@/lib/types';
import { Skeleton } from '@/components/ui';

interface TableRowSkeletonProps {
  visibleColumns: ColumnKey[];
  getColStyle: (key: ColumnKey) => React.CSSProperties;
}

// Per-column skeleton shape, matching the real cell's content geometry.
function CellSkeleton({ col }: { col: ColumnKey }) {
  switch (col) {
    case 'favorite':
      return <Skeleton className="h-3.5 w-3.5 rounded-sm mx-auto" />;
    case 'rank':
      return <Skeleton className="h-3 w-4" />;
    case 'logo':
      return <Skeleton className="h-7 w-7 rounded-full" />;
    case 'symbol':
      return <Skeleton className="h-3.5 w-16" />;
    case 'dRsiSignal':
    case 'wRsiSignal':
      return <Skeleton className="h-5 w-16 rounded-md mx-auto" />;
    case 'tdSeq':
    case 'rsi7':
    case 'rsi14':
    case 'rsiW7':
    case 'rsiW14':
      return <Skeleton className="h-5 w-[42px] rounded-md" />;
    case 'hasSpot':
      return <Skeleton className="h-4 w-8 rounded ml-auto" />;
    default:
      // Numeric / text columns (price, funding, changes, market cap, volume…)
      return <Skeleton className="h-3 w-14 ml-auto" />;
  }
}

/**
 * Skeleton placeholder row for the desktop table. Mirrors the real TableRow's
 * columns and widths so the loading state lines up with the eventual data.
 */
export function TableRowSkeleton({ visibleColumns, getColStyle }: TableRowSkeletonProps) {
  return (
    <tr className="border-b border-gray-950/[0.10] dark:border-white/[0.10]">
      {visibleColumns.map((col) => (
        <td key={col} className="px-1 py-2.5 align-middle" style={getColStyle(col)}>
          <CellSkeleton col={col} />
        </td>
      ))}
    </tr>
  );
}

/**
 * Skeleton placeholder for a mobile TokenCard. Mirrors the card layout: star,
 * rank, avatar, symbol, price block, APR, and the two RSI signal pills.
 */
export function TokenCardSkeleton() {
  return (
    <div className="bg-card rounded-xl border border-gray-950/[0.08] dark:border-white/[0.08] px-3 py-2.5">
      <div className="flex items-center gap-2.5">
        <Skeleton className="h-4 w-4 rounded-sm" />
        <Skeleton className="h-3 w-3" />
        <Skeleton className="h-8 w-8 rounded-full" />
        <Skeleton className="h-4 w-20" />
        <div className="ml-auto flex flex-col items-end gap-1">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-3 w-10" />
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 mt-2.5">
        <Skeleton className="h-3 w-20" />
        <div className="flex gap-1.5">
          <Skeleton className="h-5 w-14 rounded-md" />
          <Skeleton className="h-5 w-14 rounded-md" />
        </div>
      </div>
    </div>
  );
}
