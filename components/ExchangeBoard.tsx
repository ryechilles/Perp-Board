'use client';

import { useEffect, useState, useRef, useCallback, useMemo, ReactNode } from 'react';
import { Header } from '@/components/Header';
import { Controls } from '@/components/Controls';
import { Footer } from '@/components/Footer';
import { SearchField } from '@/components/ui';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { TableHeader, TableRow, TokenCard, TableRowSkeleton, TokenCardSkeleton } from '@/components/table';
import { TabContainer, WidgetGrid } from '@/components/layout';
import { ColumnKey } from '@/lib/types';
import { COLUMN_DEFINITIONS } from '@/lib/utils';
import { useExchangeStore } from '@/hooks/useExchangeStore';
import { useUrlState } from '@/hooks/useUrlState';
import { useVirtualRows } from '@/hooks/useVirtualRows';

// Fixed column configuration (shared across exchanges)
const FIXED_COLUMNS: ColumnKey[] = ['favorite', 'rank', 'logo', 'symbol'];
const FIXED_WIDTHS: Record<string, number> = {
  favorite: 36,
  rank: 34,
  logo: 42,   // 24px avatar + 8px/10px padding — narrower squeezes the logo
  symbol: 70, // fits 6-char symbols; longer ones truncate
};

const ROW_HEIGHT = 48;

// ===========================================
// Types
// ===========================================

export interface TabConfig {
  id: string;
  label: string;
  icon?: ReactNode;
}

export interface TabWidgetConfig {
  order: string[];
  setOrder: (order: string[]) => void;
  widgets: Record<string, ReactNode>;
}

/** Store type returned by useExchangeStore */
export type ExchangeStoreType = ReturnType<typeof useExchangeStore>;

interface ExchangeBoardProps {
  store: ExchangeStoreType;
  exchange: 'okx' | 'hyperliquid';
  tabs: TabConfig[];
  tabWidgets: Record<string, TabWidgetConfig>;
  /** Enable URL state synchronisation (OKX only) */
  enableUrlState?: boolean;
}

// ===========================================
// Component
// ===========================================

export function ExchangeBoard({
  store,
  exchange,
  tabs,
  tabWidgets,
  enableUrlState = false,
}: ExchangeBoardProps) {
  const [activeTab, setActiveTab] = useState(tabs[0]?.id ?? 'rsi');

  // Drag state
  const [draggedColumn, setDraggedColumn] = useState<ColumnKey | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<ColumnKey | null>(null);

  // Scroll state
  const [isScrolled, setIsScrolled] = useState(false);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  // Mobile card list scrolls with the page (the main grid); the card list sits
  // below the tabs/widgets/controls, so its virtualizer needs that offset.
  const mainScrollRef = useRef<HTMLDivElement>(null);
  const cardsWrapperRef = useRef<HTMLDivElement>(null);

  // Skeleton row counts — derived from the real container height so the loading
  // state has the SAME geometry as the eventual virtualized list. A fixed count
  // (e.g. 12) under-fills tall viewports, leaving a blank strip at the bottom of
  // the table card that reads as an empty trailing row. We slightly over-fill
  // (ceil) so the skeleton always reaches the bottom edge.
  const [tableSkeletonRows, setTableSkeletonRows] = useState(12);
  const [cardSkeletonRows, setCardSkeletonRows] = useState(8);
  useEffect(() => {
    const measure = () => {
      const tableH = tableContainerRef.current?.clientHeight ?? 0;
      if (tableH > 0) setTableSkeletonRows(Math.max(8, Math.ceil(tableH / ROW_HEIGHT)));
      const vh = typeof window !== 'undefined' ? window.innerHeight : 0;
      if (vh > 0) setCardSkeletonRows(Math.max(6, Math.ceil(vh / 64)));
    };
    measure();
    const el = tableContainerRef.current;
    const ro = el ? new ResizeObserver(measure) : null;
    if (el && ro) ro.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  // URL state sync — always called (Rules of Hooks), but gated by `enabled`
  useUrlState(
    {
      favorites: store.favorites,
      filters: store.filters,
      columns: store.columns,
      columnOrder: store.columnOrder,
      view: store.view,
    },
    {
      setFavorites: store.setFavoritesDirectly,
      setFilters: store.setFilters,
      setColumns: store.setColumnsDirectly,
      setColumnOrder: store.setColumnOrderDirectly,
      setView: store.setView,
    },
    enableUrlState
  );

  // Initialize / cleanup
  useEffect(() => {
    let cancelled = false;
    store.initialize().catch((err: unknown) => {
      if (!cancelled) console.error('Failed to initialize:', err);
    });
    return () => {
      cancelled = true;
      store.cleanup();
    };
  }, []);

  // Pause background acquisition while the tab is hidden (tab switch, app
  // backgrounded, screen lock), and resume + refresh when it becomes visible
  // again. Keeps a backgrounded tab at zero network/CPU and stops failed
  // background refreshes from clobbering good data. visibilitychange (not
  // focus/blur) is the right primitive — it also covers mobile backgrounding.
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        store.pause();
      } else {
        store.resume();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Scroll handler
  const handleScroll = useCallback(() => {
    const container = tableContainerRef.current;
    if (container) {
      setIsScrolled(container.scrollLeft > 0);
    }
  }, []);

  useEffect(() => {
    const container = tableContainerRef.current;
    if (!container) return;
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  // Derived data
  const filteredData = store.getFilteredData();
  const quickFilterCounts = store.getQuickFilterCounts();

  // Stable reference so memoized rows don't re-render on every store update
  const visibleColumns = useMemo(
    () => store.columnOrder.filter((key) => store.columns[key]),
    [store.columnOrder, store.columns]
  );

  // O(1) favorite lookup (was O(rows × favorites) via Array.includes)
  const favoriteSet = useMemo(() => new Set(store.favorites), [store.favorites]);

  // Row virtualization — only render rows in/near the viewport.
  const getScrollElement = useCallback(() => tableContainerRef.current, []);
  const { virtualRows, paddingTop, paddingBottom, measureElement } = useVirtualRows({
    count: filteredData.length,
    getScrollElement,
    estimateSize: ROW_HEIGHT,
    overscan: 12,
  });

  // Mobile card list virtualizer — shares the page (main grid) as its scroll
  // container, with the list's distance from the top as the offset.
  const getCardScrollElement = useCallback(() => mainScrollRef.current, []);
  const getCardsOffsetTop = useCallback(() => {
    const scroller = mainScrollRef.current;
    const wrap = cardsWrapperRef.current;
    if (!scroller || !wrap) return 0;
    return wrap.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
  }, []);
  const {
    virtualRows: cardVirtualRows,
    paddingTop: cardPaddingTop,
    paddingBottom: cardPaddingBottom,
    measureElement: measureCard,
  } = useVirtualRows({
    count: filteredData.length,
    getScrollElement: getCardScrollElement,
    getOffsetTop: getCardsOffsetTop,
    estimateSize: 64,
    overscan: 8,
  });

  const getColStyle = (key: ColumnKey) => {
    if (FIXED_WIDTHS[key]) {
      return {
        width: FIXED_WIDTHS[key],
        minWidth: FIXED_WIDTHS[key],
        maxWidth: FIXED_WIDTHS[key],
      };
    }
    const def = COLUMN_DEFINITIONS[key];
    return { width: def.width, minWidth: def.width };
  };

  // Drag handlers
  const handleDragStart = (e: React.DragEvent, key: ColumnKey) => {
    if (FIXED_COLUMNS.includes(key)) {
      e.preventDefault();
      return;
    }
    setDraggedColumn(key);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', key);
  };

  const handleDragOver = (e: React.DragEvent, key: ColumnKey) => {
    e.preventDefault();
    if (FIXED_COLUMNS.includes(key) || !draggedColumn || draggedColumn === key) return;
    setDragOverColumn(key);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = (e: React.DragEvent, targetKey: ColumnKey) => {
    e.preventDefault();
    if (!draggedColumn || FIXED_COLUMNS.includes(targetKey) || draggedColumn === targetKey) {
      setDraggedColumn(null);
      setDragOverColumn(null);
      return;
    }

    const newOrder = [...store.columnOrder];
    const dragIndex = newOrder.indexOf(draggedColumn);
    const dropIndex = newOrder.indexOf(targetKey);

    if (dragIndex !== -1 && dropIndex !== -1) {
      newOrder.splice(dragIndex, 1);
      newOrder.splice(dropIndex, 0, draggedColumn);
      store.updateColumnOrder(newOrder);
    }

    setDraggedColumn(null);
    setDragOverColumn(null);
  };

  const handleDragEnd = () => {
    setDraggedColumn(null);
    setDragOverColumn(null);
  };

  const handleScrollToTop = useCallback(() => {
    tableContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const exchangeLabel = exchange === 'hyperliquid' ? 'Hyperliquid' : 'OKX';
  const statusMeta = {
    live: { dot: 'bg-up live-dot', label: 'Live' },
    connecting: { dot: 'bg-faint', label: 'Connecting…' },
    error: { dot: 'bg-down', label: 'Offline' },
  }[store.status];

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      {/* Skip link — first focusable element, jumps keyboard users past the header */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[200] focus:rounded-lg focus:bg-card focus:px-3 focus:py-2 focus:text-sm focus:shadow-md focus:ring-2 focus:ring-ring"
      >
        Skip to content
      </a>

      {/* Toolbar */}
      <div className="material-bar hairline-b pt-safe relative z-[70]">
        <Header actions={<SearchField value={store.searchTerm} onChange={store.setSearchTerm} shortcut className="w-[220px]" />} />
      </div>

      {/* Page scroller on mobile; fixed two-column app frame on desktop */}
      <div ref={mainScrollRef} className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden">
        <div className="max-w-[1600px] mx-auto w-full px-safe pt-5 pb-safe lg:pb-6 flex flex-col gap-6 lg:h-full lg:grid lg:grid-cols-[340px_minmax(0,1fr)]">

          {/* ── Insights ─────────────────────────── */}
          <aside aria-labelledby="insights-title" className="flex flex-col gap-3.5 lg:min-h-0">
            <h2 id="insights-title" className="large-title px-1">Insights</h2>
            <TabContainer
              tabs={tabs}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              variant="sidebar"
            />
            <div className="lg:flex-1 lg:min-h-0 lg:overflow-y-auto flex flex-col gap-3.5 lg:pb-2">
              <ErrorBoundary>
                {tabs.map((tab) => {
                  if (activeTab !== tab.id) return null;
                  const config = tabWidgets[tab.id];
                  if (!config) return null;
                  return (
                    <WidgetGrid
                      key={tab.id}
                      variant="vertical"
                      gap="md"
                      sortable
                      itemIds={config.order}
                      onOrderChange={config.setOrder}
                    >
                      {config.order.map((id) => (
                        <div key={id}>{config.widgets[id]}</div>
                      ))}
                    </WidgetGrid>
                  );
                })}
              </ErrorBoundary>
              <Footer exchange={exchange} className="hidden lg:flex mt-auto" />
            </div>
          </aside>

          {/* ── Markets ──────────────────────────── */}
          <section id="main-content" aria-labelledby="markets-title" className="flex flex-col gap-3.5 lg:min-h-0">
            <div className="flex items-baseline justify-between gap-3 px-1">
              <h1 id="markets-title" className="large-title">Markets</h1>
              <p className="flex items-center gap-2 text-[0.8125rem] text-muted-foreground min-w-0" aria-live="polite">
                <span className="inline-flex items-center gap-1.5 flex-shrink-0">
                  <span className={`w-[7px] h-[7px] rounded-full ${statusMeta.dot}`} aria-hidden="true" />
                  {statusMeta.label}
                </span>
                {store.tickers.size > 0 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="truncate tabular-nums">
                      {filteredData.length} {filteredData.length === 1 ? 'perpetual' : 'perpetuals'} on {exchangeLabel}
                    </span>
                  </>
                )}
              </p>
            </div>

            {/* Table card (desktop); on mobile the controls sit on the ground above the card list */}
            <div className="flex flex-col lg:flex-1 lg:min-h-0 lg:surface-card lg:overflow-hidden">
              <div className="lg:px-3.5 lg:py-3 lg:hairline-b flex-shrink-0">
                <Controls
                  exchange={exchange}
                  columns={store.columns}
                  columnOrder={store.columnOrder}
                  filters={store.filters}
                  searchTerm={store.searchTerm}
                  overboughtCount={quickFilterCounts.overbought}
                  oversoldCount={quickFilterCounts.oversold}
                  onColumnChange={store.updateColumn}
                  onColumnsPreset={store.setColumnsPreset}
                  onFiltersChange={store.setFilters}
                  onSearchChange={store.setSearchTerm}
                  onColumnOrderChange={store.updateColumnOrder}
                  onScrollToTop={handleScrollToTop}
                />
              </div>

              {/* Data table — desktop only */}
              <div
                ref={tableContainerRef}
                className="hidden lg:block flex-1 min-h-0 overflow-auto"
                style={{ WebkitOverflowScrolling: 'touch' }}
              >
                <table
                  className="border-separate border-spacing-0"
                  style={{ width: 'max-content', minWidth: '100%' }}
                >
                  <colgroup>
                    {visibleColumns.map((key) => (
                      <col key={key} style={getColStyle(key)} />
                    ))}
                    {/* Spacer: soaks up spare width on wide screens so the data
                        columns stay packed instead of spreading apart */}
                    <col />
                  </colgroup>

                  <TableHeader
                    visibleColumns={visibleColumns}
                    sort={store.sort}
                    isScrolled={isScrolled}
                    totalCount={filteredData.length}
                    draggedColumn={draggedColumn}
                    dragOverColumn={dragOverColumn}
                    fixedColumns={FIXED_COLUMNS}
                    fixedWidths={FIXED_WIDTHS}
                    columns={store.columns}
                    onSort={store.updateSort}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onDragEnd={handleDragEnd}
                  />

                  <tbody>
                    {filteredData.length === 0 ? (
                      store.tickers.size === 0 ? (
                        Array.from({ length: tableSkeletonRows }).map((_, i) => (
                          <TableRowSkeleton
                            key={i}
                            visibleColumns={visibleColumns}
                            getColStyle={getColStyle}
                          />
                        ))
                      ) : (
                        <tr>
                          <td colSpan={visibleColumns.length + 1}>
                            <div className="flex flex-col items-center justify-center gap-1 py-20 text-center">
                              <span className="text-[0.9375rem] font-semibold">No matching tokens</span>
                              <span className="text-[0.8125rem] text-muted-foreground">Try another search or clear the filters.</span>
                            </div>
                          </td>
                        </tr>
                      )
                    ) : (
                      <>
                        {paddingTop > 0 && (
                          <tr aria-hidden>
                            <td colSpan={visibleColumns.length + 1} style={{ height: paddingTop, padding: 0, border: 0 }} />
                          </tr>
                        )}
                        {virtualRows.map(({ index }) => {
                          const ticker = filteredData[index];
                          return (
                            <TableRow
                              key={ticker.instId}
                              ref={measureElement}
                              marketStore={store.marketStore}
                              instId={ticker.instId}
                              baseSymbol={ticker.baseSymbol}
                              index={index}
                              currentPage={1}
                              pageSize={filteredData.length}
                              visibleColumns={visibleColumns}
                              exchange={exchange}
                              isFavorite={favoriteSet.has(ticker.instId)}
                              isScrolled={isScrolled}
                              fixedColumns={FIXED_COLUMNS}
                              fixedWidths={FIXED_WIDTHS}
                              columns={store.columns}
                              onToggleFavorite={store.toggleFavorite}
                            />
                          );
                        })}
                        {paddingBottom > 0 && (
                          <tr aria-hidden>
                            <td colSpan={visibleColumns.length + 1} style={{ height: paddingBottom, padding: 0, border: 0 }} />
                          </tr>
                        )}
                      </>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile card list — shown below lg in place of the table.
                  Scrolls with the page (mainScrollRef); virtualized via a wrapper
                  whose padding reserves total list height. */}
              <div className="lg:hidden mt-3">
                {filteredData.length === 0 ? (
                  store.tickers.size === 0 ? (
                    <div className="surface-card overflow-hidden">
                      {Array.from({ length: cardSkeletonRows }).map((_, i) => (
                        <TokenCardSkeleton key={i} />
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-1 py-16 text-center">
                      <span className="text-[0.9375rem] font-semibold">No matching tokens</span>
                      <span className="text-[0.8125rem] text-muted-foreground">Try another search or clear the filters.</span>
                    </div>
                  )
                ) : (
                  <div
                    ref={cardsWrapperRef}
                    className="surface-card overflow-hidden"
                    style={{ paddingTop: cardPaddingTop, paddingBottom: cardPaddingBottom }}
                  >
                    {cardVirtualRows.map(({ index }) => {
                      const ticker = filteredData[index];
                      return (
                        <div key={ticker.instId} ref={measureCard} data-index={index}>
                          <TokenCard
                            marketStore={store.marketStore}
                            instId={ticker.instId}
                            baseSymbol={ticker.baseSymbol}
                            index={index}
                            isFavorite={favoriteSet.has(ticker.instId)}
                            onToggleFavorite={store.toggleFavorite}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
                <Footer exchange={exchange} className="mt-4" />
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
