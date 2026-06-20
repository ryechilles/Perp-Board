'use client';

import { useEffect, useState, useRef, useCallback, useMemo, ReactNode } from 'react';
import { Header } from '@/components/Header';
import { Controls } from '@/components/Controls';
import { Footer } from '@/components/Footer';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { TableHeader, TableRow, TokenCard, TableRowSkeleton, TokenCardSkeleton } from '@/components/table';
import { TabContainer, WidgetGrid } from '@/components/layout';
import { ColumnKey, ProcessedTicker } from '@/lib/types';
import { COLUMN_DEFINITIONS } from '@/lib/utils';
import { useExchangeStore } from '@/hooks/useExchangeStore';
import { useUrlState } from '@/hooks/useUrlState';
import { useVirtualRows } from '@/hooks/useVirtualRows';

// Fixed column configuration (shared across exchanges)
const FIXED_COLUMNS: ColumnKey[] = ['favorite', 'rank', 'logo', 'symbol'];
const FIXED_WIDTHS: Record<string, number> = {
  favorite: 24,
  rank: 40,
  logo: 28,
  symbol: 95,
};

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
      if (tableH > 0) setTableSkeletonRows(Math.max(8, Math.ceil(tableH / 44)));
      const vh = typeof window !== 'undefined' ? window.innerHeight : 0;
      if (vh > 0) setCardSkeletonRows(Math.max(6, Math.ceil(vh / 76)));
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
    estimateSize: 44,
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
    estimateSize: 76,
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

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-muted">
      {/* Header */}
      <div className="bg-card border-b border-gray-950/[0.05] dark:border-white/[0.05] pt-safe">
        <Header />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col px-safe pt-4 pb-safe overflow-hidden">
        <div className="max-w-[1600px] mx-auto w-full flex flex-col flex-1 overflow-hidden">

          {/* Main grid: 4 sections with responsive order
               Mobile (flex-col):  Tabs → Widgets → Controls → Table
               Desktop (lg grid):  [Tabs     | Controls]
                                   [Widgets  | Table   ]  */}
          <div ref={mainScrollRef} className="flex flex-col lg:grid lg:grid-cols-[320px_1fr] lg:grid-rows-[auto_1fr] gap-4 flex-1 overflow-y-auto lg:overflow-hidden">
            {/* Tabs — mobile: 1st, desktop: top-left */}
            <div className="order-1 lg:order-none flex-shrink-0 lg:self-center">
              <TabContainer
                tabs={tabs}
                activeTab={activeTab}
                onTabChange={setActiveTab}
                variant="sidebar"
              />
            </div>

            {/* Controls — mobile: 3rd, desktop: top-right */}
            <div className="order-3 lg:order-none flex-shrink-0 lg:self-center">
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

            {/* Widgets sidebar — mobile: 2nd, desktop: bottom-left */}
            <div className="order-2 lg:order-none lg:overflow-y-auto lg:min-h-0 lg:pr-2 space-y-4">
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
            </div>

            {/* Data Table — desktop only (mobile uses the card list below) */}
            <div className="order-4 lg:order-none bg-card rounded-xl border border-gray-950/[0.10] dark:border-white/[0.10] shadow-sm hidden lg:flex flex-col lg:min-h-0 overflow-hidden">
              <div
                ref={tableContainerRef}
                className="flex-1 overflow-auto"
                style={{ WebkitOverflowScrolling: 'touch' }}
              >
                <table
                  className="border-collapse"
                  style={{ width: 'max-content', minWidth: '100%' }}
                >
                  <colgroup>
                    {visibleColumns.map((key) => (
                      <col key={key} style={getColStyle(key)} />
                    ))}
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
                          <td colSpan={visibleColumns.length}>
                            <div className="flex items-center justify-center py-16 text-muted-foreground">
                              No data found
                            </div>
                          </td>
                        </tr>
                      )
                    ) : (
                      <>
                        {paddingTop > 0 && (
                          <tr aria-hidden>
                            <td colSpan={visibleColumns.length} style={{ height: paddingTop, padding: 0, border: 0 }} />
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
                            <td colSpan={visibleColumns.length} style={{ height: paddingBottom, padding: 0, border: 0 }} />
                          </tr>
                        )}
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile card list — shown below lg in place of the table.
                Scrolls with the page (mainScrollRef); virtualized via a wrapper
                whose padding reserves total list height. */}
            <div className="order-4 lg:hidden">
              {filteredData.length === 0 ? (
                store.tickers.size === 0 ? (
                  <div className="space-y-2">
                    {Array.from({ length: cardSkeletonRows }).map((_, i) => (
                      <TokenCardSkeleton key={i} />
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-16 text-muted-foreground">
                    No data found
                  </div>
                )
              ) : (
                <div
                  ref={cardsWrapperRef}
                  style={{ paddingTop: cardPaddingTop, paddingBottom: cardPaddingBottom }}
                >
                  {cardVirtualRows.map(({ index }) => {
                    const ticker = filteredData[index];
                    return (
                      <div key={ticker.instId} ref={measureCard} data-index={index} className="pb-2">
                        <TokenCard
                          marketStore={store.marketStore}
                          instId={ticker.instId}
                          baseSymbol={ticker.baseSymbol}
                          index={index}
                          exchange={exchange}
                          isFavorite={favoriteSet.has(ticker.instId)}
                          onToggleFavorite={store.toggleFavorite}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 flex-shrink-0">
        <div className="max-w-[1600px] mx-auto w-full">
          <Footer exchange={exchange} />
        </div>
      </div>
    </div>
  );
}
