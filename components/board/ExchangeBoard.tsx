'use client';

import { useEffect, useState, useRef, useCallback, useMemo, ReactNode } from 'react';
import { BarChart3, List, Star } from 'lucide-react';
import { Button, SearchField, Tabs } from '@/components/ui';
import { Figure, Stat } from '@/components/data';
import { SortableStack } from '@/components/insights/SortableStack';
import { ColumnKey } from '@/lib/types';
import { rsiTone } from '@/lib/format';
import { cn, getRsiAvg, getRsiSignal } from '@/lib/utils';
import { useExchangeStore } from '@/hooks/useExchangeStore';
import { useUrlState } from '@/hooks/useUrlState';
import { useVirtualRows } from '@/hooks/useVirtualRows';
import { AppBar } from './AppBar';
import { Toolbar } from './Toolbar';
import { Footer } from './Footer';
import { ErrorBoundary } from './ErrorBoundary';
import { TableHeader, TableRow, TokenCard, TableRowSkeleton, TokenCardSkeleton, FIXED_COLUMNS, ROW_HEIGHT, colStyle } from './table';

/** Estimated height of a TokenCard (the list below lg), for its virtualizer. */
const CARD_HEIGHT = 56;

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
      if (vh > 0) setCardSkeletonRows(Math.max(6, Math.ceil(vh / CARD_HEIGHT)));
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
    estimateSize: CARD_HEIGHT,
    overscan: 8,
  });

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
    live: { dot: 'bg-accent live-dot', label: 'Live' },
    connecting: { dot: 'bg-fg-faint', label: 'Connecting…' },
    error: { dot: 'bg-down', label: 'Offline' },
  }[store.status];

  const statusLine = (
    <p className="flex min-w-0 items-center gap-2 text-small text-fg-muted" aria-live="polite">
      <span className="inline-flex flex-shrink-0 items-center gap-1.5">
        <span className={cn('size-1.5 rounded-full', statusMeta.dot)} aria-hidden="true" />
        {statusMeta.label}
      </span>
      {store.tickers.size > 0 && (
        <>
          <span aria-hidden="true">·</span>
          <span className="truncate">
            <Figure>{filteredData.length}</Figure> {filteredData.length === 1 ? 'perpetual' : 'perpetuals'} on {exchangeLabel}
          </span>
        </>
      )}
    </p>
  );

  // Summary strip (below lg): the three numbers worth seeing before the list.
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

  const emptyState = (
    <div className="flex flex-col items-center justify-center gap-1 px-4 py-16 text-center">
      <span className="text-title font-semibold">{watchlist ? 'Your watchlist is empty' : 'No matching tokens'}</span>
      <span className="text-fg-muted">
        {watchlist ? 'Star a token to add it here.' : 'Try another search or clear the filters.'}
      </span>
    </div>
  );

  const activeWidgets = tabWidgets[activeTab];

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-surface-0">
      {/* Skip link — first focusable element, jumps keyboard users past the bar */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-tip focus:rounded-control focus:bg-surface-pop focus:px-3 focus:py-2 focus:shadow-pop"
      >
        Skip to content
      </a>

      <div className="bar-material pt-safe relative z-bar rule-b">
        <AppBar
          status={statusLine}
          actions={<SearchField value={store.searchTerm} onChange={store.setSearchTerm} shortcut className="w-60" />}
        />
      </div>

      {/* Below lg the page scrolls; from lg up it is a fixed two-column frame */}
      <div ref={mainScrollRef} className="min-h-0 flex-1 overflow-y-auto lg:overflow-hidden">
        <div className="flex w-full flex-col lg:grid lg:h-full lg:grid-cols-[theme(spacing.sidebar)_minmax(0,1fr)]">

          {/* ── Insights ─────────────────────────── */}
          <aside
            aria-labelledby="insights-title"
            className={cn(showInsights ? 'flex' : 'hidden', 'flex-col bg-surface-2 lg:flex lg:min-h-0 lg:rule-r')}
          >
            <h2 id="insights-title" className="sr-only">Insights</h2>
            <Tabs tabs={tabs} value={activeTab} onChange={setActiveTab} label="Insights" className="flex-shrink-0 px-4" />
            <div className="flex flex-col lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
              <ErrorBoundary>
                {activeWidgets && (
                  <SortableStack key={activeTab} itemIds={activeWidgets.order} onOrderChange={activeWidgets.setOrder}>
                    {activeWidgets.order.map((id) => (
                      <div key={id}>{activeWidgets.widgets[id]}</div>
                    ))}
                  </SortableStack>
                )}
              </ErrorBoundary>
              <Footer exchange={exchange} className="mt-auto px-4 py-2" />
            </div>
          </aside>

          {/* ── Markets ──────────────────────────── */}
          <section
            id="main-content"
            aria-labelledby="markets-title"
            className={cn(showInsights ? 'hidden' : 'flex', 'flex-col bg-surface-1 lg:flex lg:min-h-0')}
          >
            <h1 id="markets-title" className="sr-only">Markets</h1>

            {/* Summary strip (below lg) — opens Insights */}
            <Button
              variant="bare"
              onClick={() => handleMobileNav('insights')}
              className="grid grid-cols-3 gap-3 px-4 py-3 text-left rule-b lg:hidden"
              aria-label="Open insights"
            >
              <Stat
                value={<Figure tone={rsiTone(marketRsi)}>{marketRsi != null ? marketRsi.toFixed(1) : '—'}</Figure>}
                label={`Market RSI · ${marketSignal.label}`}
              />
              <Stat value={<Figure>{quickFilterCounts.oversold}</Figure>} label="Oversold" />
              <Stat value={<Figure>{quickFilterCounts.overbought}</Figure>} label="Overbought" />
            </Button>

            <div className="flex-shrink-0 px-3.5 py-2 rule-b">
              <Toolbar
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

            {/* Table — lg and up */}
            <div ref={tableContainerRef} className="hidden min-h-0 flex-1 overflow-auto lg:block">
              {/* max-content + min 100%: columns never squeeze below their minimum,
                  and spare width is shared across them so the table fills the pane */}
              <table className="w-max min-w-full border-separate border-spacing-0">
                <colgroup>
                  {visibleColumns.map((key) => (
                    <col key={key} style={colStyle(key)} />
                  ))}
                </colgroup>

                <TableHeader
                  visibleColumns={visibleColumns}
                  sort={store.sort}
                  isScrolled={isScrolled}
                  totalCount={filteredData.length}
                  draggedColumn={draggedColumn}
                  dragOverColumn={dragOverColumn}
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
                        <TableRowSkeleton key={i} visibleColumns={visibleColumns} />
                      ))
                    ) : (
                      <tr>
                        <td colSpan={visibleColumns.length}>{emptyState}</td>
                      </tr>
                    )
                  ) : (
                    <>
                      {paddingTop > 0 && (
                        <tr aria-hidden>
                          <td colSpan={visibleColumns.length} style={{ height: paddingTop, padding: 0, border: 0 }} />
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
                            visibleColumns={visibleColumns}
                            exchange={exchange}
                            isFavorite={favoriteSet.has(ticker.instId)}
                            isScrolled={isScrolled}
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

            {/* List — below lg, in place of the table. Scrolls with the page
                (mainScrollRef); virtualized via a wrapper whose padding reserves
                the total list height. */}
            <div className="lg:hidden">
              <div className="px-4 py-1.5 rule-b">{statusLine}</div>
              {filteredData.length === 0 ? (
                store.tickers.size === 0 ? (
                  Array.from({ length: cardSkeletonRows }).map((_, i) => <TokenCardSkeleton key={i} />)
                ) : (
                  emptyState
                )
              ) : (
                <div ref={cardsWrapperRef} className="overflow-hidden" style={{ paddingTop: cardPaddingTop, paddingBottom: cardPaddingBottom }}>
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
              <Footer exchange={exchange} className="px-4 py-2" />
            </div>
          </section>
        </div>
      </div>

      {/* Bottom navigation — below lg */}
      <nav aria-label="Sections" className="pb-safe flex flex-shrink-0 bg-surface-0 rule-t lg:hidden">
        {mobileNav.map(({ id, label, Icon, active }) => (
          <Button
            key={id}
            variant="bare"
            onClick={() => handleMobileNav(id)}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex h-14 flex-1 flex-col items-center justify-center gap-1 text-caption transition-colors',
              active ? 'font-medium text-fg' : 'text-fg-muted'
            )}
          >
            <Icon className="size-5" strokeWidth={active ? 2 : 1.6} aria-hidden="true" />
            {label}
          </Button>
        ))}
      </nav>
    </div>
  );
}
