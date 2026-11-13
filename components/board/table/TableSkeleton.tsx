'use client';

import { ColumnKey } from '@/lib/types';
import { Skeleton } from '@/components/ui';
import { cellPad, colStyle } from './layout';

// Per-column placeholder, matching the real cell's content geometry.
function CellSkeleton({ col }: { col: ColumnKey }) {
  switch (col) {
    case 'favorite':
      return <Skeleton className="size-3.5" />;
    case 'rank':
      return <Skeleton className="h-3 w-3" />;
    case 'logo':
      return <Skeleton className="size-5 rounded-full" />;
    case 'symbol':
      return <Skeleton className="h-3 w-10" />;
    case 'change7d':
    case 'dRsiSignal':
    case 'wRsiSignal':
      return <Skeleton className="ml-auto h-3 w-20" />;
    case 'tdSeq':
      return <Skeleton className="ml-auto h-3 w-6" />;
    default:
      return <Skeleton className="ml-auto h-3 w-14" />;
  }
}

/** Placeholder row for the table — same columns and widths as a real row. */
export function TableRowSkeleton({ visibleColumns }: { visibleColumns: ColumnKey[] }) {
  return (
    <tr>
      {visibleColumns.map((col) => (
        <td key={col} className={`h-row align-middle rule-b ${cellPad(col)}`} style={colStyle(col)}>
          <CellSkeleton col={col} />
        </td>
      ))}
    </tr>
  );
}

/** Placeholder for a TokenCard (the list shown below lg). */
export function TokenCardSkeleton() {
  return (
    <div className="flex min-h-14 items-center gap-3 px-4 py-2 rule-b">
      <Skeleton className="size-3.5" />
      <Skeleton className="size-6 rounded-full" />
      <div className="flex flex-1 flex-col gap-1.5">
        <Skeleton className="h-3 w-14" />
        <Skeleton className="h-3 w-32" />
      </div>
      <div className="flex flex-col items-end gap-1.5">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-12" />
      </div>
    </div>
  );
}
