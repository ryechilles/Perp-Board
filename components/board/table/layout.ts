import type { CSSProperties } from 'react';
import { ColumnKey } from '@/lib/types';
import { COLUMN_DEFINITIONS } from '@/lib/utils';
import { FIXED_COLUMNS as FIXED_COLUMN_KEYS } from '@/lib/constants';

/**
 * Table geometry shared by the header, the rows and the skeleton, so the three
 * can never drift apart.
 */

/** Columns pinned to the left while the table scrolls sideways. */
export const FIXED_COLUMNS: ColumnKey[] = [...FIXED_COLUMN_KEYS];

/** Pinned columns have exact widths (their sticky offsets are sums of these). */
export const FIXED_WIDTHS: Partial<Record<ColumnKey, number>> = {
  favorite: 38,
  rank: 32,   // right-aligned, so 1- and 2-digit ranks share a ones column
  logo: 30,   // 20px avatar + gap to the symbol
  symbol: 76, // fits 6-char symbols; longer ones truncate
};

/** Row height in px — must equal the `h-row` token (the virtualizer estimates with it). */
export const ROW_HEIGHT = 36;

export type ColumnFlags = Record<ColumnKey, boolean>;

export const isFixed = (key: ColumnKey) => FIXED_COLUMNS.includes(key);

/** Width of a <col>: exact for pinned columns, a minimum for the rest (spare width is shared out). */
export function colStyle(key: ColumnKey): CSSProperties {
  const fixed = FIXED_WIDTHS[key];
  if (fixed) return { width: fixed, minWidth: fixed, maxWidth: fixed };
  const { width } = COLUMN_DEFINITIONS[key];
  return { width, minWidth: width };
}

/** Horizontal padding per column. The pinned group is packed tight; data columns share one rhythm. */
export function cellPad(key: ColumnKey): string {
  switch (key) {
    case 'favorite': return 'pl-3.5 pr-0';
    case 'rank': return 'pl-0 pr-3';
    case 'logo': return 'pl-0 pr-2.5';
    case 'symbol': return 'pl-0 pr-2';
    default: return 'px-3 last:pr-4';
  }
}

export function alignClass(key: ColumnKey): string {
  const { align } = COLUMN_DEFINITIONS[key];
  return align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';
}

const RULE_BOTTOM = 'inset 0 -1px 0 var(--line)';
const RULE_EDGE = '1px 0 0 var(--line-strong)';

/**
 * Inline style that pins a column. `undefined` for columns that scroll.
 * The last pinned column draws an edge once the table has scrolled sideways.
 */
export function stickyStyle(key: ColumnKey, columns: ColumnFlags, isScrolled: boolean, zIndex: number): CSSProperties | undefined {
  if (!isFixed(key)) return undefined;
  let left = 0;
  for (const col of FIXED_COLUMNS) {
    if (col === key) break;
    if (columns[col]) left += FIXED_WIDTHS[col] ?? 0;
  }
  const visible = FIXED_COLUMNS.filter((col) => columns[col]);
  const isLast = visible[visible.length - 1] === key;
  const width = FIXED_WIDTHS[key];
  return {
    position: 'sticky',
    left,
    zIndex,
    width,
    minWidth: width,
    maxWidth: width,
    boxShadow: isLast && isScrolled ? `${RULE_BOTTOM}, ${RULE_EDGE}` : RULE_BOTTOM,
  };
}
