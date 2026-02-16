'use client';

import { useEffect, useState, useRef, useMemo, useCallback, ReactNode } from 'react';
import { useHyperliquidStore } from '@/hooks/useHyperliquidStore';
import { useWidgetOrder } from '@/hooks/useWidgetOrder';
import { Header } from '@/components/Header';
import { Controls } from '@/components/Controls';
import { Footer } from '@/components/Footer';
import { MarketMomentum } from '@/components/MarketMomentum';
import { RsiOversold } from '@/components/RsiOversold';
import { RsiOverbought } from '@/components/RsiOverbought';
import { AltcoinTopGainers } from '@/components/AltcoinTopGainers';
import { AltcoinVsBTC } from '@/components/AltcoinVsBTC';
import { FundingMarket } from '@/components/FundingMarket';
import { FundingKiller } from '@/components/FundingKiller';
import { HLPVault } from '@/components/HLPVault';
import { Total2MiniChart } from '@/components/Total2MiniChart';
import { EthBtcRatio } from '@/components/EthBtcRatio';
import { BTCDominance } from '@/components/BTCDominance';
import { AHR999Indicator } from '@/components/AHR999Indicator';
import { TableHeader, TableRow } from '@/components/table';
import { TabContainer, WidgetGrid } from '@/components/layout';
import { Spinner } from '@/components/ui';
import { ColumnKey } from '@/lib/types';
import { COLUMN_DEFINITIONS } from '@/lib/utils';

// Fixed column configuration
const FIXED_COLUMNS: ColumnKey[] = ['favorite', 'rank', 'logo', 'symbol'];
const FIXED_WIDTHS: Record<string, number> = {
  favorite: 24,
  rank: 40,
  logo: 28,
  symbol: 95,
};

const EXCHANGE_LABEL = 'Hyperliquid';

// Hyperliquid logo for HLP tab
const HlpTabIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 144 144" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M144 71.6991C144 119.306 114.866 134.582 99.5156 120.98C86.8804 109.889 83.1211 86.4521 64.116 84.0456C39.9942 81.0113 37.9057 113.133 22.0334 113.133C3.5504 113.133 0 86.2428 0 72.4315C0 58.3063 3.96809 39.0542 19.736 39.0542C38.1146 39.0542 39.1588 66.5722 62.132 65.1073C85.0007 63.5379 85.4184 34.8689 100.247 22.6271C113.195 12.0593 144 23.4641 144 71.6991Z" />
  </svg>
);

// Bitcoin logo for BTC tab
const BtcLogo = () => (
  <img
    src="https://assets.coingecko.com/coins/images/1/small/bitcoin.png"
    alt="BTC"
    className="w-4 h-4 rounded-full"
  />
);

// Tab configuration
const TABS = [
  { id: 'rsi', label: 'RSI' },
  { id: 'funding', label: 'Funding' },
  { id: 'altcoin', label: 'Altcoin' },
  { id: 'btc', label: 'BTC', icon: <BtcLogo /> },
  { id: 'hlp', label: 'HLP', icon: <HlpTabIcon /> },
];

// Default widget order per tab
const DEFAULT_WIDGET_ORDER: Record<string, string[]> = {
  rsi: ['marketMomentum', 'rsiOversold', 'rsiOverbought'],
  funding: ['fundingMarket', 'fundingKiller'],
  altcoin: ['topGainers', 'vsBtc', 'ethBtcRatio', 'total2'],
  btc: ['btcDominance', 'ahr999'],
  hlp: ['hlpVault'],
};

export default function HyperliquidBoard() {
  const store = useHyperliquidStore();
  const [activeTab, setActiveTab] = useState('rsi');

  // Widget order for tabs with multiple widgets
  const [rsiWidgetOrder, setRsiWidgetOrder] = useWidgetOrder(
    'hl-rsi',
    DEFAULT_WIDGET_ORDER.rsi
  );
  const [fundingWidgetOrder, setFundingWidgetOrder] = useWidgetOrder(
    'hl-funding',
    DEFAULT_WIDGET_ORDER.funding
  );
  const [altcoinWidgetOrder, setAltcoinWidgetOrder] = useWidgetOrder(
    'hl-altcoin',
    DEFAULT_WIDGET_ORDER.altcoin
  );
  const [btcWidgetOrder, setBtcWidgetOrder] = useWidgetOrder(
    'hl-btc',
    DEFAULT_WIDGET_ORDER.btc
  );
  const [hlpWidgetOrder, setHlpWidgetOrder] = useWidgetOrder(
    'hl-hlp',
    DEFAULT_WIDGET_ORDER.hlp
  );

  // Drag state
  const [draggedColumn, setDraggedColumn] = useState<ColumnKey | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<ColumnKey | null>(null);

  // Scroll state
  const [isScrolled, setIsScrolled] = useState(false);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    store.initialize().catch((err) => {
      if (!cancelled) console.error('Failed to initialize:', err);
    });
    return () => {
      cancelled = true;
      store.cleanup();
    };
  }, []);

  // Monitor horizontal scroll for sticky column shadow
  useEffect(() => {
    const container = tableContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      setIsScrolled(container.scrollLeft > 0);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  const filteredData = store.getFilteredData();
  const { avgRsi7, avgRsi14 } = store.getRsiAverages();
  const quickFilterCounts = store.getQuickFilterCounts();

  // Show all data (no pagination)
  const displayData = filteredData;

  // Get visible columns in order
  const visibleColumns = store.columnOrder.filter((key) => store.columns[key]);

  // Get column style for colgroup
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

  // Token click handler
  const handleTokenClick = useCallback((symbol: string) => {
    store.setFilters({});
    store.setSearchTerm(symbol);
    tableContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [store]);

  const handleGroupClick = useCallback((symbols: string[]) => {
    store.setFilters({});
    store.setSearchTerm(symbols.join('|'));
    tableContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [store]);

  const handleScrollToTop = useCallback(() => {
    tableContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Widget mapping for RSI tab
  const rsiWidgets: Record<string, ReactNode> = useMemo(() => ({
    marketMomentum: (
      <MarketMomentum
        avgRsi7={avgRsi7}
        avgRsi14={avgRsi14}
        exchangeLabel={EXCHANGE_LABEL}
      />
    ),
    rsiOversold: (
      <RsiOversold
        tickers={store.tickers}
        rsiData={store.rsiData}
        marketCapData={store.marketCapData}
        onTokenClick={handleTokenClick}
        exchangeLabel={EXCHANGE_LABEL}
      />
    ),
    rsiOverbought: (
      <RsiOverbought
        tickers={store.tickers}
        rsiData={store.rsiData}
        marketCapData={store.marketCapData}
        onTokenClick={handleTokenClick}
        exchangeLabel={EXCHANGE_LABEL}
      />
    ),
  }), [avgRsi7, avgRsi14, store.tickers, store.rsiData, store.marketCapData]);

  // Widget mapping for funding tab
  const fundingWidgets: Record<string, ReactNode> = useMemo(() => ({
    fundingMarket: (
      <FundingMarket
        tickers={store.tickers}
        fundingRateData={store.fundingRateData}
        marketCapData={store.marketCapData}
        onGroupClick={handleGroupClick}
        exchangeLabel={EXCHANGE_LABEL}
      />
    ),
    fundingKiller: (
      <FundingKiller
        tickers={store.tickers}
        fundingRateData={store.fundingRateData}
        marketCapData={store.marketCapData}
        onTokenClick={handleTokenClick}
        onGroupClick={handleGroupClick}
        exchangeLabel={EXCHANGE_LABEL}
      />
    ),
  }), [store.tickers, store.fundingRateData, store.marketCapData]);

  // Widget mapping for altcoin tab
  const altcoinWidgets: Record<string, ReactNode> = useMemo(() => ({
    topGainers: (
      <AltcoinTopGainers
        tickers={store.tickers}
        rsiData={store.rsiData}
        marketCapData={store.marketCapData}
        onTokenClick={handleTokenClick}
        exchangeLabel={EXCHANGE_LABEL}
      />
    ),
    vsBtc: (
      <AltcoinVsBTC
        tickers={store.tickers}
        rsiData={store.rsiData}
        marketCapData={store.marketCapData}
        onTokenClick={handleTokenClick}
        onTopNClick={handleGroupClick}
        exchangeLabel={EXCHANGE_LABEL}
      />
    ),
    ethBtcRatio: <EthBtcRatio />,
    total2: <Total2MiniChart />,
  }), [store.tickers, store.rsiData, store.marketCapData]);

  // Widget mapping for BTC tab (shared components, no exchange-specific data)
  const btcWidgets: Record<string, ReactNode> = useMemo(() => ({
    btcDominance: <BTCDominance />,
    ahr999: <AHR999Indicator />,
  }), []);

  // Widget mapping for HLP tab
  const hlpWidgets: Record<string, ReactNode> = useMemo(() => ({
    hlpVault: <HLPVault />,
  }), []);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-muted">
      {/* ===================================================================
          SECTION 1: Header (Logo + Title + Version + Exchange Buttons)
          =================================================================== */}
      <div className="bg-card shadow-sm">
        <Header />
      </div>

      {/* ===================================================================
          SECTION 2: Main Content
          =================================================================== */}
      <div className="flex-1 flex flex-col px-4 sm:px-6 pt-4 pb-4 overflow-hidden">
        <div className="max-w-[1600px] mx-auto w-full flex flex-col flex-1 overflow-hidden">

          {/* -----------------------------------------------------------------
              ROW 1: Tabs (left) + Controls (right) - Mobile stacked
              ----------------------------------------------------------------- */}
          <div className="flex flex-col lg:flex-row lg:items-center gap-4 mb-4">
            {/* Tabs - Same width as widget sidebar */}
            <div className="lg:w-[320px] flex-shrink-0">
              <TabContainer
                tabs={TABS}
                activeTab={activeTab}
                onTabChange={setActiveTab}
                variant="sidebar"
              />
            </div>

            {/* Controls - Aligns with table */}
            <Controls
              exchange="hyperliquid"
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

          {/* -----------------------------------------------------------------
              ROW 2: Widgets (left) + Table (right) - TOP ALIGNED
              ----------------------------------------------------------------- */}
          <div className="flex flex-col lg:flex-row flex-1 gap-4 overflow-hidden">
            {/* Widgets - Desktop: fixed width sidebar, Mobile: above table */}
            <div className="lg:w-[320px] flex-shrink-0 lg:overflow-y-auto lg:pr-2 space-y-4">
              {/* RSI Tab Widgets - Sortable */}
              {activeTab === 'rsi' && (
                <WidgetGrid
                  variant="vertical"
                  gap="md"
                  sortable
                  itemIds={rsiWidgetOrder}
                  onOrderChange={setRsiWidgetOrder}
                >
                  {rsiWidgetOrder.map((id) => (
                    <div key={id}>{rsiWidgets[id]}</div>
                  ))}
                </WidgetGrid>
              )}

              {/* Funding Tab Widgets - Sortable */}
              {activeTab === 'funding' && (
                <WidgetGrid
                  variant="vertical"
                  gap="md"
                  sortable
                  itemIds={fundingWidgetOrder}
                  onOrderChange={setFundingWidgetOrder}
                >
                  {fundingWidgetOrder.map((id) => (
                    <div key={id}>{fundingWidgets[id]}</div>
                  ))}
                </WidgetGrid>
              )}

              {/* Altcoin Tab Widgets - Sortable */}
              {activeTab === 'altcoin' && (
                <WidgetGrid
                  variant="vertical"
                  gap="md"
                  sortable
                  itemIds={altcoinWidgetOrder}
                  onOrderChange={setAltcoinWidgetOrder}
                >
                  {altcoinWidgetOrder.map((id) => (
                    <div key={id}>{altcoinWidgets[id]}</div>
                  ))}
                </WidgetGrid>
              )}

              {/* BTC Tab Widgets - Sortable */}
              {activeTab === 'btc' && (
                <WidgetGrid
                  variant="vertical"
                  gap="md"
                  sortable
                  itemIds={btcWidgetOrder}
                  onOrderChange={setBtcWidgetOrder}
                >
                  {btcWidgetOrder.map((id) => (
                    <div key={id}>{btcWidgets[id]}</div>
                  ))}
                </WidgetGrid>
              )}

              {/* HLP Tab Widgets - Sortable */}
              {activeTab === 'hlp' && (
                <WidgetGrid
                  variant="vertical"
                  gap="md"
                  sortable
                  itemIds={hlpWidgetOrder}
                  onOrderChange={setHlpWidgetOrder}
                >
                  {hlpWidgetOrder.map((id) => (
                    <div key={id}>{hlpWidgets[id]}</div>
                  ))}
                </WidgetGrid>
              )}
            </div>

            {/* Data Table - flex-1 to fill remaining space */}
            <div className="bg-card rounded-xl border flex flex-col flex-1 overflow-hidden">
              {/* Scrollable Table Container */}
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
                      displayData.map((ticker, index) => (
                        <TableRow
                          key={ticker.instId}
                          ticker={ticker}
                          index={index}
                          currentPage={1}
                          pageSize={displayData.length}
                          visibleColumns={visibleColumns}
                          rsi={store.rsiData.get(ticker.instId)}
                          fundingRate={store.fundingRateData.get(ticker.instId)}
                          listingData={undefined}
                          marketCap={store.marketCapData.get(ticker.baseSymbol)}
                          hasSpot={store.spotSymbols.has(ticker.baseSymbol)}
                          exchange="hyperliquid"
                          isFavorite={store.favorites.includes(ticker.instId)}
                          isScrolled={isScrolled}
                          fixedColumns={FIXED_COLUMNS}
                          fixedWidths={FIXED_WIDTHS}
                          columns={store.columns}
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

      {/* ===================================================================
          SECTION 3: Footer
          =================================================================== */}
      <div className="px-6 flex-shrink-0">
        <div className="max-w-[1600px] mx-auto w-full">
          <Footer exchange="hyperliquid" />
        </div>
      </div>
    </div>
  );
}
