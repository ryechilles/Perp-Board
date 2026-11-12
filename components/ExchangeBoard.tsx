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
import { BarChart3, List, Star } from 'lucide-react';
import { COLUMN_DEFINITIONS, getRsiAvg, getRsiSignal, getRsiTextClass } from '@/lib/utils';
import { FIXED_COLUMNS as FIXED_COLUMN_KEYS } from '@/lib/constants';
import { useExchangeStore } from '@/hooks/useExchangeStore';
import { useUrlState } from '@/hooks/useUrlState';
import { useVirtualRows } from '@/hooks/useVirtualRows';

// Fixed column configuration (shared across exchanges)
const FIXED_COLUMNS: ColumnKey[] = [...FIXED_COLUMN_KEYS];
const FIXED_WIDTHS: Record<string, number> = {
  favorite: 36,
  rank: 34,
  logo: 42,   // 24px avatar + 8px/10px padding — narrower squeezes the logo
  symbol: 70, // fits 6-char symbols; longer ones truncate
};

const ROW_HEIGHT = 40;

// Matches Tailwind's `lg` breakpoint, where the card list gives way to the table.
const DESKTOP_QUERY = '(min-width: 1024px)';

/**
 * Which layout is on screen: true = desktop table, false = mobile cards, null =
 * not known yet (server render / first paint). Both layouts exist in the markup
 * and CSS picks one; this lets the board stop mounting the rows of the hidden
 * one, so each tick renders and subscribes one list instead of two.
 */
function useIsDesktop(): boolean | null {
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null);
  useEffect(() => {
    const mql = window.matchMedia(DESKTOP_QUERY);
    const update = () => setIsDesktop(mql.matches);
    update();
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, []);
  return isDesktop;
}

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
  const isDesktop = useIsDesktop();
  // Mobile shows one section at a time, switched from the bottom navigation.
  const [mobileView, setMobileView] = useState<'markets' | 'insights'>('markets');

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
      if (vh > 0) setCardSkeletonRows(Math.max(6, Math.ceil(vh / 56)));
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // MA Flow is only fetched while its tab is open.
  const maFlowTabOpen = activeTab === 'maflow';
  useEffect(() => {
    store.setMAFlowActive(maFlowTabOpen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maFlowTabOpen]);

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
    estimateSize: 56,
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

  const statusLine = (
    <p className="flex items-center gap-2 text-xs text-muted-foreground min-w-0" aria-live="polite">
      <span className="inline-flex items-center gap-1.5 flex-shrink-0">
        <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dot}`} aria-hidden="true" />
        {statusMeta.label}
      </span>
      {store.tickers.size > 0 && (
        <>
          <span aria-hidden="true">·</span>
          <span className="truncate">
            <span className="tabular-nums">{filteredData.length}</span>{' '}
            {filteredData.length === 1 ? 'perpetual' : 'perpetuals'} on {exchangeLabel}
          </span>
        </>
      )}
    </p>
  );

  // Mobile summary strip: the three numbers worth seeing before the list.
  const rsiAverages = store.getRsiAverages();
  const marketRsi = getRsiAvg(rsiAverages.avgRsi7, rsiAverages.avgRsi14);
  const marketSignal = getRsiSignal(rsiAverages.avgRsi7, rsiAverages.avgRsi14);

  const showInsights = mobileView === 'insights';
  const watchlist = store.view === 'favorites';
  const mobileNav = [
    { id: 'markets', label: 'Markets', Icon: List, active: !showInsights && !watchlist },
    { id: 'insights', label: 'Insights', Icon: BarChart3, active: showInsights },
    { id: 'watchlist', label: 'Watchlist', Icon: Star, active: !showInsights && watchlist },
  ] as const;
  const handleMobileNav = (id: (typeof mobileNav)[number]['id']) => {
    if (id === 'insights') {
      setMobileView('insights');
    } else {
      setMobileView('markets');
      store.setView(id === 'watchlist' ? 'favorites' : 'market');
    }
    mainScrollRef.current?.scrollTo({ top: 0 });
  };

  const emptyState = watchlist ? (
    <>
      <span className="text-[0.9375rem] font-semibold">Your watchlist is empty</span>
      <span className="text-[0.8125rem] text-muted-foreground">Tap the star next to a token to add it.</span>
    </>
  ) : (
    <>
      <span className="text-[0.9375rem] font-semibold">No matching tokens</span>
      <span className="text-[0.8125rem] text-muted-foreground">Try another search or clear the filters.</span>
    </>
  );

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
        <Header
          status={statusLine}
          actions={<SearchField value={store.searchTerm} onChange={store.setSearchTerm} shortcut className="w-[240px]" />}
        />
      </div>

      {/* Page scroller on mobile; fixed two-column app frame on desktop */}
      <div ref={mainScrollRef} className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden">
        <div className="w-full flex flex-col lg:h-full lg:grid lg:grid-cols-[340px_minmax(0,1fr)]">

          {/* ── Insights ─────────────────────────── */}
          <aside
            aria-labelledby="insights-title"
            className={`${showInsights ? 'flex' : 'hidden'} lg:flex flex-col bg-card lg:bg-transparent lg:min-h-0 lg:hairline-r`}
          >
            <h2 id="insights-title" className="sr-only">Insights</h2>
            <TabContainer
              tabs={tabs}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              variant="sidebar"
              className="px-1 lg:px-2"
            />
            <div className="flat-panels lg:flex-1 lg:min-h-0 lg:overflow-y-auto flex flex-col">
              <ErrorBoundary>
                {tabs.map((tab) => {
                  if (activeTab !== tab.id) return null;
                  const config = tabWidgets[tab.id];
                  if (!config) return null;
                  return (
                    <WidgetGrid
                      key={tab.id}
                      variant="vertical"
                      className="gap-0"
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
              <Footer exchange={exchange} className="px-4 py-3 mt-auto" />
            </div>
          </aside>

          {/* ── Markets ──────────────────────────── */}
          <section
            id="main-content"
            aria-labelledby="markets-title"
            className={`${showInsights ? 'hidden' : 'flex'} lg:flex flex-col lg:min-h-0 lg:bg-card`}
          >
            <h1 id="markets-title" className="sr-only">Markets</h1>

            {/* Mobile summary strip — opens Insights */}
            <button
              type="button"
              onClick={() => handleMobileNav('insights')}
              className="lg:hidden grid grid-cols-3 text-left hairline-b focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50"
              aria-label="Open insights"
            >
              <span className="flex flex-col gap-0.5 px-4 py-3 hairline-r min-w-0">
                <span className="label-caps truncate">Market RSI</span>
                <span className={`text-xl font-medium tabular-nums ${getRsiTextClass(marketRsi)}`}>
                  {marketRsi != null ? marketRsi.toFixed(1) : '—'}
                </span>
                <span className="text-xs text-muted-foreground truncate">{marketSignal.label}</span>
              </span>
              <span className="flex flex-col gap-0.5 px-4 py-3 hairline-r min-w-0">
                <span className="label-caps truncate">Oversold</span>
                <span className="text-xl font-medium tabular-nums text-cold-ink">{quickFilterCounts.oversold}</span>
                <span className="text-xs text-muted-foreground truncate">Daily RSI &lt; 25</span>
              </span>
              <span className="flex flex-col gap-0.5 px-4 py-3 min-w-0">
                <span className="label-caps truncate">Overbought</span>
                <span className="text-xl font-medium tabular-nums text-hot-ink">{quickFilterCounts.overbought}</span>
                <span className="text-xs text-muted-foreground truncate">Daily RSI &gt; 75</span>
              </span>
            </button>

            <div className="flex flex-col lg:flex-1 lg:min-h-0">
              <div className="px-4 py-2.5 lg:px-5 lg:py-2 lg:hairline-b flex-shrink-0">
                <Controls
                  exchange={exchange}
                  columns={store.columns}
                  filters={store.filters}
                  searchTerm={store.searchTerm}
                  overboughtCount={quickFilterCounts.overbought}
                  oversoldCount={quickFilterCounts.oversold}
                  onColumnChange={store.updateColumn}
                  onColumnsPreset={store.setColumnsPreset}
                  onFiltersChange={store.setFilters}
                  onSearchChange={store.setSearchTerm}
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
                              {emptyState}
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
                        {isDesktop !== false && virtualRows.map(({ index }) => {
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

              {/* Mobile list — shown below lg in place of the table. Scrolls with
                  the page (mainScrollRef); virtualized via a wrapper whose padding
                  reserves total list height. */}
              <div className="lg:hidden">
                <div className="flex items-center justify-between gap-3 px-4 py-1.5 hairline-b">
                  {statusLine}
                </div>
                {filteredData.length === 0 ? (
                  store.tickers.size === 0 ? (
                    <div className="bg-card overflow-hidden">
                      {Array.from({ length: cardSkeletonRows }).map((_, i) => (
                        <TokenCardSkeleton key={i} />
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-1 px-4 py-16 text-center">
                      {emptyState}
                    </div>
                  )
                ) : (
                  <div
                    ref={cardsWrapperRef}
                    className="bg-card overflow-hidden"
                    style={{ paddingTop: cardPaddingTop, paddingBottom: cardPaddingBottom }}
                  >
                    {isDesktop !== true && cardVirtualRows.map(({ index }) => {
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
                <Footer exchange={exchange} className="px-4 py-3" />
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Mobile bottom navigation */}
      <nav aria-label="Sections" className="lg:hidden flex-shrink-0 flex bg-background hairline-t pb-[env(safe-area-inset-bottom)]">
        {mobileNav.map(({ id, label, Icon, active }) => (
          <button
            key={id}
            type="button"
            onClick={() => handleMobileNav(id)}
            aria-current={active ? 'page' : undefined}
            className={`flex-1 h-14 flex flex-col items-center justify-center gap-1 text-[0.6875rem] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50 ${
              active ? 'text-foreground font-medium' : 'text-muted-foreground'
            }`}
          >
            <Icon className="w-5 h-5" strokeWidth={active ? 2 : 1.6} aria-hidden="true" />
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}
