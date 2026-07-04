'use client';

/**
 * Dependency-free row virtualizer for a scrollable table.
 *
 * Renders only the rows in (and near) the viewport, with top/bottom spacer
 * rows preserving total scroll height. Row heights are measured dynamically
 * via ResizeObserver — rows in this table vary in height (the symbol cell can
 * stack a "Listed <30d" sub-label), so a fixed size would clip.
 *
 * Kept intentionally minimal (no external lib) to avoid touching the lockfile.
 */

import { useCallback, useEffect, useReducer, useRef } from 'react';

export interface VirtualRow {
  index: number;
  start: number;
  size: number;
}

interface Params {
  count: number;
  getScrollElement: () => HTMLElement | null;
  /**
   * Pixels between the scroll container's content top and the first row. Needed
   * when the list does NOT start at the top of the scroll container (e.g. the
   * mobile card list scrolls with the page, below the tabs/widgets/controls).
   * Defaults to 0 — the dedicated-container case (desktop table).
   */
  getOffsetTop?: () => number;
  estimateSize?: number;
  overscan?: number;
}

export interface VirtualResult {
  virtualRows: VirtualRow[];
  totalSize: number;
  paddingTop: number;
  paddingBottom: number;
  /** ref callback for each rendered row's <tr> (which must carry data-index). */
  measureElement: (node: HTMLElement | null) => void;
}

export function useVirtualRows({
  count,
  getScrollElement,
  getOffsetTop,
  estimateSize = 44,
  overscan = 12,
}: Params): VirtualResult {
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);

  const sizesRef = useRef<number[]>([]);
  const scrollTopRef = useRef(0);
  const viewportRef = useRef(0);
  const rowObserverRef = useRef<ResizeObserver | null>(null);
  const elementByIndex = useRef(new Map<number, Element>());

  // Keep the measured-sizes array length in sync with the row count.
  if (sizesRef.current.length !== count) {
    const next = sizesRef.current.slice(0, count);
    while (next.length < count) next.push(estimateSize);
    sizesRef.current = next;
  }

  // Track scroll position + viewport height of the scroll container.
  useEffect(() => {
    const el = getScrollElement();
    if (!el) return;

    viewportRef.current = el.clientHeight;
    scrollTopRef.current = el.scrollTop;

    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        scrollTopRef.current = el.scrollTop;
        forceUpdate();
      });
    };
    el.addEventListener('scroll', onScroll, { passive: true });

    const viewportObserver = new ResizeObserver(() => {
      viewportRef.current = el.clientHeight;
      forceUpdate();
    });
    viewportObserver.observe(el);

    forceUpdate(); // initial pass once the element exists
    return () => {
      if (raf) cancelAnimationFrame(raf);
      el.removeEventListener('scroll', onScroll);
      viewportObserver.disconnect();
    };
  }, [getScrollElement]);

  // Observe individual row heights.
  useEffect(() => {
    const ro = new ResizeObserver((entries) => {
      let changed = false;
      for (const entry of entries) {
        const target = entry.target as HTMLElement;
        const attr = target.getAttribute('data-index');
        if (attr == null) continue;
        const index = Number(attr);
        const h = target.getBoundingClientRect().height;
        if (h > 0 && sizesRef.current[index] !== h) {
          sizesRef.current[index] = h;
          changed = true;
        }
      }
      if (changed) forceUpdate();
    });
    rowObserverRef.current = ro;
    return () => {
      ro.disconnect();
      rowObserverRef.current = null;
      elementByIndex.current.clear();
    };
  }, []);

  const measureElement = useCallback((node: HTMLElement | null) => {
    if (!node) return;
    const attr = node.getAttribute('data-index');
    if (attr == null) return;
    const index = Number(attr);
    const ro = rowObserverRef.current;
    const prev = elementByIndex.current.get(index);
    if (prev && prev !== node) ro?.unobserve(prev);
    elementByIndex.current.set(index, node);
    const h = node.getBoundingClientRect().height;
    if (h > 0 && sizesRef.current[index] !== h) {
      sizesRef.current[index] = h;
      forceUpdate();
    }
    ro?.observe(node);
  }, []);

  // Cumulative offsets from measured (or estimated) sizes.
  const sizes = sizesRef.current;
  const offsets = new Array<number>(count);
  let running = 0;
  for (let i = 0; i < count; i++) {
    offsets[i] = running;
    running += sizes[i] || estimateSize;
  }
  const totalSize = running;

  // Subtract any content above the list (page-scroll case) so row offsets
  // (0-based from the list top) line up with the container's scrollTop.
  const offsetTop = getOffsetTop ? getOffsetTop() : 0;
  const scrollTop = Math.max(0, scrollTopRef.current - offsetTop);
  const viewport = viewportRef.current;

  // First visible row (binary search over offsets).
  let startIndex = 0;
  if (count > 0) {
    let lo = 0;
    let hi = count - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (offsets[mid] <= scrollTop) {
        startIndex = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
  }

  // Last visible row.
  let endIndex = startIndex;
  if (count > 0) {
    const limit = scrollTop + (viewport > 0 ? viewport : estimateSize * overscan);
    while (endIndex < count - 1 && offsets[endIndex] < limit) endIndex++;
  }

  startIndex = Math.max(0, startIndex - overscan);
  endIndex = Math.min(count - 1, endIndex + overscan);

  const virtualRows: VirtualRow[] = [];
  for (let i = startIndex; i <= endIndex && count > 0; i++) {
    virtualRows.push({ index: i, start: offsets[i], size: sizes[i] || estimateSize });
  }

  const first = virtualRows[0];
  const last = virtualRows[virtualRows.length - 1];
  const paddingTop = first ? first.start : 0;
  const paddingBottom = last ? totalSize - (last.start + last.size) : 0;

  return { virtualRows, totalSize, paddingTop, paddingBottom, measureElement };
}
