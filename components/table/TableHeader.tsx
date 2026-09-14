'use client';

import { Info } from 'lucide-react';
import { ColumnKey, SortConfig } from '@/lib/types';
import { COLUMN_DEFINITIONS, COLUMN_TOOLTIPS } from '@/lib/utils';

interface TableHeaderProps {
  visibleColumns: ColumnKey[];
  sort: SortConfig;
  isScrolled: boolean;
  totalCount: number;
  draggedColumn: ColumnKey | null;
  dragOverColumn: ColumnKey | null;
  fixedColumns: ColumnKey[];
  fixedWidths: Record<string, number>;
  columns: Record<ColumnKey, boolean>;
  onSort: (column: string) => void;
  onDragStart: (e: React.DragEvent, key: ColumnKey) => void;
  onDragOver: (e: React.DragEvent, key: ColumnKey) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, key: ColumnKey) => void;
  onDragEnd: () => void;
}

export function TableHeader({
  visibleColumns,
  sort,
  isScrolled,
  totalCount,
  draggedColumn,
  dragOverColumn,
  fixedColumns,
  fixedWidths,
  columns,
  onSort,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
}: TableHeaderProps) {
  const isFixedColumn = (key: ColumnKey) => fixedColumns.includes(key);

  const isLastFixedColumn = (key: ColumnKey) => {
    const visibleFixed = fixedColumns.filter((col) => columns[col]);
    return visibleFixed[visibleFixed.length - 1] === key;
  };

  const getStickyLeftOffset = (key: ColumnKey): number => {
    if (!fixedColumns.includes(key)) return 0;
    let left = 0;
    for (const col of fixedColumns) {
      if (col === key) break;
      if (columns[col]) {
        left += fixedWidths[col] || 0;
      }
    }
    return left;
  };

  return (
    <thead className="sticky top-0 z-20">
      {/* No opaque row background: translucent th cells (.thead-material) let rows scroll underneath */}
      <tr>
        {visibleColumns.map((key) => {
          // "Token" header spans the logo + symbol cells so it lines up with the
          // avatar (the left edge of the token column), not with the name text.
          const mergeLogo = columns.logo && columns.symbol;
          if (key === 'logo' && mergeLogo) return null;
          const spansLogo = key === 'symbol' && mergeLogo;

          const def = COLUMN_DEFINITIONS[key];
          const sortable = def.sortable !== false;
          const isActive = sort.column === key;
          const isFixed = isFixedColumn(key);
          const isLastFixed = isLastFixedColumn(key);
          const stickyLeft = getStickyLeftOffset(spansLogo ? 'logo' : key);
          const fixedWidth = spansLogo ? fixedWidths.logo + fixedWidths.symbol : fixedWidths[key];
          const isDragging = draggedColumn === key;
          const isDragOver = dragOverColumn === key;

          let alignClass = 'text-left';
          if (def.align === 'right') alignClass = 'text-right';
          if (def.align === 'center') alignClass = 'text-center';
          const padClass =
            key === 'favorite' ? 'pl-3.5 pr-0'
            : key === 'rank' ? 'px-1'
            : spansLogo ? 'pl-2 pr-2'
            : key === 'price' ? 'pl-2 pr-3'
            : 'px-3';

          const stickyStyle: React.CSSProperties | undefined = isFixed
            ? {
                position: 'sticky',
                left: stickyLeft,
                zIndex: 30,
                backgroundColor: 'hsl(var(--card))',
                width: fixedWidth,
                minWidth: fixedWidth,
                maxWidth: fixedWidth,
                boxSizing: 'border-box',
                boxShadow:
                  isLastFixed && isScrolled
                    ? 'inset 0 -0.5px 0 hsl(var(--separator)), 1px 0 0 hsl(var(--separator)), 6px 0 10px -6px rgb(0 0 0 / 0.12)'
                    : 'inset 0 -0.5px 0 hsl(var(--separator))',
              }
            : undefined;

          const tooltipItems = COLUMN_TOOLTIPS[key];
          // 动态判断列是否在右半边，tooltip 向右对齐防止溢出
          const columnIndex = visibleColumns.indexOf(key);
          const isRightHalf = columnIndex > visibleColumns.length / 2;

          return (
            <th
              key={key}
              colSpan={spansLogo ? 2 : undefined}
              draggable={!isFixed}
              aria-sort={
                isActive
                  ? sort.direction === 'asc'
                    ? 'ascending'
                    : 'descending'
                  : sortable
                    ? 'none'
                    : undefined
              }
              tabIndex={sortable ? 0 : undefined}
              onDragStart={(e) => onDragStart(e, key)}
              onDragOver={(e) => onDragOver(e, key)}
              onDragLeave={onDragLeave}
              onDrop={(e) => onDrop(e, key)}
              onDragEnd={onDragEnd}
              className={`group/th h-[34px] ${padClass} text-xs whitespace-nowrap ${isActive ? 'font-semibold text-foreground' : 'font-medium text-muted-foreground'} ${isFixed ? '' : 'thead-material hairline-b'} ${alignClass} ${sortable ? 'cursor-pointer hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50' : ''} ${!isFixed ? 'cursor-grab active:cursor-grabbing' : ''} ${isDragging ? 'opacity-50' : ''} ${isDragOver ? 'shadow-[inset_2px_0_0_hsl(var(--tint))]' : ''} select-none`}
              style={stickyStyle}
              onClick={() => sortable && onSort(key)}
              onKeyDown={(e) => {
                if (sortable && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  onSort(key);
                }
              }}
            >
              <span className="inline-flex items-center gap-1">
                {sortable && def.align !== 'left' && <SortGlyph active={isActive} direction={sort.direction} />}
                <span className="inline-flex items-center gap-1">
                  {def.label}
                {key === 'symbol' && totalCount > 0 && (
                  <span className="text-faint font-normal tabular-nums">{totalCount}</span>
                )}
                {tooltipItems && (
                  <button
                    type="button"
                    aria-label={`${def.label} info`}
                    className="relative group/tooltip ml-0.5 inline-flex items-center focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-sm"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    <Info className="w-3 h-3 text-faint hover:text-muted-foreground cursor-pointer" aria-hidden="true" />
                    <div className={`absolute top-full mt-2 z-50 hidden group-hover/tooltip:block group-focus-within/tooltip:block pointer-events-none ${isRightHalf ? 'right-0' : 'left-0'}`}>
                      <div className="bg-popover border border-separator rounded-xl px-3 py-2.5 shadow-lg min-w-[220px] text-left font-normal pointer-events-auto">
                        <div className="text-xs text-foreground font-semibold mb-1.5">{tooltipItems[0]}</div>
                        <div className="text-[0.6875rem] text-muted-foreground space-y-0.5">
                          {tooltipItems.slice(1).map((item, i) => (
                            <div key={i}>• {item}</div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </button>
                )}
                </span>
                {sortable && def.align === 'left' && <SortGlyph active={isActive} direction={sort.direction} />}
              </span>
            </th>
          );
        })}
        <th aria-hidden="true" className="thead-material hairline-b p-0" />
      </tr>
    </thead>
  );
}

/** Sort chevron: solid when this column is sorted, faint on hover otherwise. */
function SortGlyph({ active, direction }: { active: boolean; direction: SortConfig['direction'] }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 10 10"
      className={`w-2.5 h-2.5 transition-opacity ${active ? 'opacity-100' : 'opacity-0 group-hover/th:opacity-50'} ${active && direction === 'asc' ? 'rotate-180' : ''}`}
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
