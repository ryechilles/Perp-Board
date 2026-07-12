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
      {/* No opaque row background: translucent th cells (.thead-material) must see through to scrolling content */}
      <tr>
        {visibleColumns.map((key) => {
          const def = COLUMN_DEFINITIONS[key];
          const sortable = def.sortable !== false;
          const isActive = sort.column === key;
          const isFixed = isFixedColumn(key);
          const isLastFixed = isLastFixedColumn(key);
          const stickyLeft = getStickyLeftOffset(key);
          const fixedWidth = fixedWidths[key];
          const isDragging = draggedColumn === key;
          const isDragOver = dragOverColumn === key;

          let alignClass = 'text-left';
          if (def.align === 'right') alignClass = 'text-right';
          if (def.align === 'center') alignClass = 'text-center';

          const stickyStyle: React.CSSProperties | undefined = isFixed
            ? {
                position: 'sticky',
                left: stickyLeft,
                zIndex: 30,
                backgroundColor: 'hsl(var(--secondary))',
                width: fixedWidth,
                minWidth: fixedWidth,
                maxWidth: fixedWidth,
                boxSizing: 'border-box',
                boxShadow:
                  isLastFixed && isScrolled
                    ? '4px 0 6px -2px rgba(0,0,0,0.1)'
                    : undefined,
              }
            : undefined;

          const tooltipItems = COLUMN_TOOLTIPS[key];
          // 动态判断列是否在右半边，tooltip 向右对齐防止溢出
          const columnIndex = visibleColumns.indexOf(key);
          const isRightHalf = columnIndex > visibleColumns.length / 2;

          return (
            <th
              key={key}
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
              className={`px-1 py-3 text-[0.6875rem] font-medium text-muted-foreground tracking-wide ${isFixed ? 'bg-secondary' : 'thead-material'} border-b border-gray-950/[0.10] dark:border-white/[0.10] whitespace-nowrap ${alignClass} ${sortable ? 'cursor-pointer hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring' : ''} ${!isFixed ? 'cursor-grab active:cursor-grabbing' : ''} ${isDragging ? 'opacity-50' : ''} ${isDragOver ? 'bg-accent border-l-2 border-l-primary' : ''} select-none`}
              style={stickyStyle}
              onClick={() => sortable && onSort(key)}
              onKeyDown={(e) => {
                if (sortable && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  onSort(key);
                }
              }}
            >
              <span className="inline-flex items-center gap-0.5">
                {def.label}
                {key === 'symbol' && (
                  <span className="text-[0.625rem] text-muted-foreground font-normal ml-0.5">
                    ({totalCount})
                  </span>
                )}
                {tooltipItems && (
                  <button
                    type="button"
                    aria-label={`${def.label} info`}
                    className="relative group/tooltip ml-0.5 inline-flex items-center focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-sm"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    <Info className="w-3 h-3 text-muted-foreground hover:text-muted-foreground cursor-pointer" aria-hidden="true" />
                    <div className={`absolute top-full mt-1.5 z-50 hidden group-hover/tooltip:block group-focus-within/tooltip:block pointer-events-none ${isRightHalf ? 'right-0' : 'left-0'}`}>
                      <div className="bg-popover border border-gray-950/[0.10] dark:border-white/[0.10] rounded-lg px-3 py-2.5 shadow-lg min-w-[200px] text-left pointer-events-auto">
                        <div className="text-[0.6875rem] text-muted-foreground font-medium mb-1.5">{tooltipItems[0]}</div>
                        <div className="text-[0.625rem] text-muted-foreground space-y-0.5">
                          {tooltipItems.slice(1).map((item, i) => (
                            <div key={i}>• {item}</div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </button>
                )}
                {sortable && (
                  <svg
                    aria-hidden="true"
                    className={`w-3 h-3 ml-0.5 ${isActive ? 'text-muted-foreground' : 'text-muted-foreground'}`}
                    viewBox="0 0 12 12"
                    fill="currentColor"
                  >
                    <path
                      d="M6 2L9 5H3L6 2Z"
                      className={
                        isActive && sort.direction === 'asc'
                          ? 'text-foreground'
                          : 'text-muted-foreground'
                      }
                      fill="currentColor"
                    />
                    <path
                      d="M6 10L3 7H9L6 10Z"
                      className={
                        isActive && sort.direction === 'desc'
                          ? 'text-foreground'
                          : 'text-muted-foreground'
                      }
                      fill="currentColor"
                    />
                  </svg>
                )}
              </span>
            </th>
          );
        })}
      </tr>
    </thead>
  );
}
