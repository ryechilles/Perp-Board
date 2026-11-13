'use client';

import { ColumnKey, SortConfig } from '@/lib/types';
import { COLUMN_DEFINITIONS, COLUMN_TOOLTIPS, cn } from '@/lib/utils';
import { InfoTip, TipBody } from '@/components/ui';
import { ColumnFlags, FIXED_WIDTHS, alignClass, cellPad, isFixed, stickyStyle } from './layout';

interface TableHeaderProps {
  visibleColumns: ColumnKey[];
  sort: SortConfig;
  isScrolled: boolean;
  totalCount: number;
  draggedColumn: ColumnKey | null;
  dragOverColumn: ColumnKey | null;
  columns: ColumnFlags;
  onSort: (column: string) => void;
  onDragStart: (e: React.DragEvent, key: ColumnKey) => void;
  onDragOver: (e: React.DragEvent, key: ColumnKey) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, key: ColumnKey) => void;
  onDragEnd: () => void;
}

/**
 * Sticky header row. Click a column to sort; drag a data column to reorder it.
 * Pinned columns (star, rank, token) are neither draggable nor reorderable.
 */
export function TableHeader({
  visibleColumns,
  sort,
  isScrolled,
  totalCount,
  draggedColumn,
  dragOverColumn,
  columns,
  onSort,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
}: TableHeaderProps) {
  return (
    <thead className="sticky top-0 z-sticky">
      <tr>
        {visibleColumns.map((key) => {
          // "Token" spans the logo + symbol cells so the label lines up with the
          // avatar (the left edge of the token column), not with the symbol text.
          const mergeLogo = columns.logo && columns.symbol;
          if (key === 'logo' && mergeLogo) return null;
          const spansLogo = key === 'symbol' && mergeLogo;

          const def = COLUMN_DEFINITIONS[key];
          const sortable = def.sortable !== false;
          const active = sort.column === key;
          const fixed = isFixed(key);
          const tooltip = COLUMN_TOOLTIPS[key];

          const style = stickyStyle(spansLogo ? 'logo' : key, columns, isScrolled && key === 'symbol', 30);
          if (style && spansLogo) {
            const width = (FIXED_WIDTHS.logo ?? 0) + (FIXED_WIDTHS.symbol ?? 0);
            Object.assign(style, { width, minWidth: width, maxWidth: width });
          }

          return (
            <th
              key={key}
              colSpan={spansLogo ? 2 : undefined}
              draggable={!fixed}
              aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : sortable ? 'none' : undefined}
              tabIndex={sortable ? 0 : undefined}
              onDragStart={(e) => onDragStart(e, key)}
              onDragOver={(e) => onDragOver(e, key)}
              onDragLeave={onDragLeave}
              onDrop={(e) => onDrop(e, key)}
              onDragEnd={onDragEnd}
              onClick={() => sortable && onSort(key)}
              onKeyDown={(e) => {
                if (sortable && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  onSort(key);
                }
              }}
              style={style}
              className={cn(
                'caps group/th h-control-lg select-none whitespace-nowrap bg-surface-1',
                spansLogo ? 'pl-0 pr-2' : cellPad(key),
                alignClass(key),
                !fixed && 'rule-b cursor-grab active:cursor-grabbing',
                sortable && 'focus-ring-inset cursor-pointer outline-none transition-colors hover:text-fg',
                active && 'text-fg',
                draggedColumn === key && 'opacity-50',
                dragOverColumn === key && 'shadow-edge-accent'
              )}
            >
              <span className="inline-flex items-center gap-1">
                {sortable && <SortGlyph active={active} direction={sort.direction} />}
                {def.label}
                {key === 'symbol' && totalCount > 0 && <span className="num font-normal text-fg-faint">{totalCount}</span>}
                {tooltip && (
                  <InfoTip
                    label={def.label}
                    content={<TipBody title={tooltip[0]} items={tooltip.slice(1)} />}
                    className="normal-case tracking-normal"
                  />
                )}
              </span>
            </th>
          );
        })}
      </tr>
    </thead>
  );
}

/** Sort chevron: solid on the sorted column, a hint on hover elsewhere. */
function SortGlyph({ active, direction }: { active: boolean; direction: SortConfig['direction'] }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 10 10"
      className={cn(
        'size-2.5 transition-opacity',
        active ? 'opacity-100' : 'opacity-0 group-hover/th:opacity-50',
        active && direction === 'asc' && 'rotate-180'
      )}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 3.5 5 6.5 8 3.5" />
    </svg>
  );
}
