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
      return <Skeleton className="h-3.5 w-3.5 rounded-sm" />;
    case 'rank':
      return <Skeleton className="h-3 w-4 mx-auto" />;
    case 'logo':
      return <Skeleton className="h-6 w-6 rounded-full" />;
    case 'symbol':
      return <Skeleton className="h-3.5 w-12" />;
    case 'change':
    case 'change4h':
      return <Skeleton className="h-6 w-[66px] rounded-md ml-auto" />;
    case 'change7d':
      return <Skeleton className="h-5 w-28 ml-auto" />;
    case 'dRsiSignal':
    case 'wRsiSignal':
      return <Skeleton className="h-3 w-20 ml-auto" />;
    case 'tdSeq':
      return <Skeleton className="h-[22px] w-9 rounded-md mx-auto" />;
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
    <tr>
      {visibleColumns.map((col) => (
        <td
          key={col}
          className={`h-12 align-middle hairline-b ${col === 'favorite' ? 'pl-3.5 pr-0' : col === 'rank' ? 'px-1' : col === 'logo' ? 'pl-2 pr-2.5' : col === 'symbol' ? 'pl-0 pr-3' : 'px-3'}`}
          style={getColStyle(col)}
        >
          <CellSkeleton col={col} />
        </td>
      ))}
    </tr>
  );
}

/**
 * Skeleton placeholder for a mobile TokenCard row: star, avatar, symbol +
 * secondary line, price + change pill.
 */
export function TokenCardSkeleton() {
  return (
    <div className="flex items-center gap-3 min-h-[64px] pl-3.5 pr-4 py-2.5 hairline-b">
      <Skeleton className="h-3.5 w-3.5 rounded-sm" />
      <Skeleton className="h-8 w-8 rounded-full" />
      <div className="flex-1 flex flex-col gap-1.5">
        <Skeleton className="h-3.5 w-14" />
        <Skeleton className="h-3 w-32" />
      </div>
      <div className="flex flex-col items-end gap-1.5">
        <Skeleton className="h-3.5 w-16" />
        <Skeleton className="h-[22px] w-16 rounded-md" />
      </div>
    </div>
  );
}
