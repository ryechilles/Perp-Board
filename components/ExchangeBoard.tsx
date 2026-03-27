'use client';

import { useEffect, useState, useRef, useCallback, ReactNode } from 'react';
import { Header } from '@/components/Header';
import { Controls } from '@/components/Controls';
import { Footer } from '@/components/Footer';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { TableHeader, TableRow } from '@/components/table';
import { TabContainer, WidgetGrid } from '@/components/layout';
import { Spinner } from '@/components/ui';
import { ColumnKey, ProcessedTicker } from '@/lib/types';
import { COLUMN_DEFINITIONS } from '@/lib/utils';
import { useExchangeStore } from '@/hooks/useExchangeStore';

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
  /** Optional URL state sync hook (OKX only) */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useUrlStateHook?: (...args: any[]) => any;
}

// ===========================================
// Component
// ===========================================

export function ExchangeBoard({
  store,
  exchange,
  tabs,
  tabWidgets,
  useUrlStateHook,
}: ExchangeBoardProps) {
  const [activeTab, setActiveTab] = useState(tabs[0]?.id ?? 'rsi');

  // Drag state
  const [draggedColumn, setDraggedColumn] = useState<ColumnKey | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<ColumnKey | null>(null);

  // Scroll state
  const [isScrolled, setIsScrolled] = useState(false);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // URL state sync (OKX only)
  if (useUrlStateHook) {
    useUrlStateHook(
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
      }
    );
  }

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

  const visibleColumns = store.columnOrder.filter((key) => store.columns[key]);

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

  // Spot symbol check based on exchange format
  const hasSpot = useCallback(
    (baseSymbol: string) => {
      const spotKey = exchange === 'okx' ? `${baseSymbol}-USDT` : baseSymbol;
      return store.spotSymbols.has(spotKey);
    },
    [exchange, store.spotSymbols]
  );

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-muted">
      {/* Header */}
      <div className="bg-card border-b border-gray-950/[0.05] dark:border-white/[0.05]">
        <Header />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col px-4 sm:px-6 pt-4 pb-4 overflow-hidden">
        <div className="max-w-[1600px] mx-auto w-full flex flex-col flex-1 overflow-hidden">

          {/* ROW 1: Tabs + Controls */}
          <div className="flex flex-col lg:flex-row lg:items-center gap-4 mb-4">
            <div className="lg:w-[320px] flex-shrink-0">
              <TabContainer
                tabs={tabs}
                activeTab={activeTab}
                onTabChange={setActiveTab}
                variant="sidebar"
              />
            </div>

            <Controls
              exchange={exchange}
              columns={store.columns as any}
              columnOrder={store.columnOrder}
              filters={store.filters as any}
              searchTerm={store.searchTerm}
              overboughtCount={quickFilterCounts.overbought}
              oversoldCount={quickFilterCounts.oversold}
              onColumnChange={store.updateColumn as any}
              onColumnsPreset={store.setColumnsPreset}
              onFiltersChange={store.setFilters as any}
              onSearchChange={store.setSearchTerm}
              onColumnOrderChange={store.updateColumnOrder}
              onScrollToTop={handleScrollToTop}
            />
          </div>

          {/* ROW 2: Widgets + Table */}
          <div className="flex flex-col lg:flex-row flex-1 gap-4 overflow-hidden">
            {/* Widgets sidebar */}
            <div className="lg:w-[320px] flex-shrink-0 lg:overflow-y-auto lg:pr-2 space-y-4">
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

            {/* Data Table */}
            <div className="bg-card rounded-xl border border-gray-950/[0.10] dark:border-white/[0.10] shadow-sm flex flex-col flex-1 overflow-hidden">
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
                    sort={store.sort as any}
                    isScrolled={isScrolled}
                    totalCount={filteredData.length}
                    draggedColumn={draggedColumn}
                    dragOverColumn={dragOverColumn}
                    fixedColumns={FIXED_COLUMNS}
                    fixedWidths={FIXED_WIDTHS}
                    columns={store.columns as any}
                    onSort={store.updateSort}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onDragEnd={handleDragEnd}
                  />

                  <tbody>
                    {filteredData.length === 0 ? (
                      <tr>
                        <td colSpan={visibleColumns.length}>
                          <div className="flex items-center justify-center py-16 text-muted-foreground">
                            {store.tickers.size === 0 ? (
                              <>
                                <Spinner size="md" className="mr-3" />
                                Loading market data...
                              </>
                            ) : (
                              'No data found'
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredData.map((ticker, index) => (
                        <TableRow
                          key={ticker.instId}
                          ticker={ticker as any}
                          index={index}
                          currentPage={1}
                          pageSize={filteredData.length}
                          visibleColumns={visibleColumns}
                          rsi={(store.rsiData as Map<string, unknown>).get(ticker.instId) as any}
                          fundingRate={(store.fundingRateData as Map<string, unknown>).get(ticker.instId) as any}
                          listingData={exchange === 'okx' ? (store.listingData as Map<string, unknown>).get(ticker.instId) as any : undefined}
                          marketCap={(store.marketCapData as Map<string, unknown>).get(ticker.baseSymbol) as any}
                          hasSpot={hasSpot(ticker.baseSymbol)}
                          exchange={exchange}
                          isFavorite={store.favorites.includes(ticker.instId)}
                          isScrolled={isScrolled}
                          fixedColumns={FIXED_COLUMNS}
                          fixedWidths={FIXED_WIDTHS}
                          columns={store.columns as any}
                          onToggleFavorite={store.toggleFavorite}
                        />
                      ))
                    )}
                  </tbody>
                </table>
              </div>
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
