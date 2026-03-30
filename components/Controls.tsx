'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { Search, Settings, RotateCcw } from 'lucide-react';
import { ColumnVisibility, ColumnKey, Filters, RsiSignalType, AssetCategory } from '@/lib/types';
import { getDefaultColumns } from '@/lib/defaults';
import { RsiFilter } from './RsiFilter';
import { PillButtonGroup, PillButtonOption, Button } from '@/components/ui';

// Quick filter types
type QuickFilter = 'all' | 'crypto' | 'stock' | 'top25' | 'meme' | 'noSpot' | 'newListed' | 'overbought' | 'oversold';

interface ControlsProps {
  columns: ColumnVisibility;
  columnOrder: ColumnKey[];
  filters: Filters;
  searchTerm: string;
  overboughtCount: number;
  oversoldCount: number;
  exchange?: 'okx' | 'hyperliquid';
  onColumnChange: (col: keyof ColumnVisibility, visible: boolean) => void;
  onColumnsPreset: (preset: 'all' | 'none' | 'default') => void;
  onFiltersChange: (filters: Filters) => void;
  onSearchChange: (term: string) => void;
  onColumnOrderChange: (order: ColumnKey[]) => void;
  onScrollToTop?: () => void;
}

export function Controls({
  columns,
  columnOrder,
  filters,
  searchTerm,
  overboughtCount,
  oversoldCount,
  exchange = 'okx',
  onColumnChange,
  onColumnsPreset,
  onFiltersChange,
  onSearchChange,
  onColumnOrderChange,
  onScrollToTop,
}: ControlsProps) {
  const [showCustomizePanel, setShowCustomizePanel] = useState(false);
  const [tempFilters, setTempFilters] = useState<Filters>(filters);
  const [customizeTab, setCustomizeTab] = useState<'columns' | 'filters'>('columns');
  const customizePanelRef = useRef<HTMLDivElement>(null);
  const customizeButtonRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const mobileSearchInputRef = useRef<HTMLInputElement>(null);

  // Sync tempFilters when external filters change (e.g. URL state, other components)
  useEffect(() => {
    setTempFilters(filters);
  }, [filters]);

  // Close panel when clicking outside
  useEffect(() => {
    if (!showCustomizePanel) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        customizePanelRef.current &&
        !customizePanelRef.current.contains(target) &&
        customizeButtonRef.current &&
        !customizeButtonRef.current.contains(target)
      ) {
        setShowCustomizePanel(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showCustomizePanel]);

  // Determine active quick filter based on current filters
  const getActiveQuickFilter = (): QuickFilter => {
    if (filters.rank === '1-25' && !filters.rsi7 && !filters.rsi14 && !filters.isMeme && !filters.hasSpot) return 'top25';
    if (filters.isMeme === 'yes' && !filters.rsi7 && !filters.rsi14) return 'meme';
    if (filters.hasSpot === 'no' && !filters.rsi7 && !filters.rsi14) return 'noSpot';
    if (filters.listAge === '<180d' && !filters.rsi7 && !filters.rsi14) return 'newListed';
    if (filters.rsi7 === '>75' && filters.rsi14 === '>75') return 'overbought';
    if (filters.rsi7 === '<25' && filters.rsi14 === '<25') return 'oversold';
    return 'all';
  };

  const handleQuickFilter = (filter: QuickFilter) => {
    // Clear search term when using quick filters
    onSearchChange('');
    // Preserve the current assetCategory when switching quick filters
    const currentCategory = filters.assetCategory;
    switch (filter) {
      case 'all':
        onFiltersChange(currentCategory ? { assetCategory: currentCategory } : {});
        setTempFilters(currentCategory ? { assetCategory: currentCategory } : {});
        break;
      case 'top25': {
        const f = { rank: '1-25' as const, ...(currentCategory ? { assetCategory: currentCategory } : {}) };
        onFiltersChange(f);
        setTempFilters(f);
        break;
      }
      case 'meme': {
        const f = { isMeme: 'yes' as const, ...(currentCategory ? { assetCategory: currentCategory } : {}) };
        onFiltersChange(f);
        setTempFilters(f);
        break;
      }
      case 'noSpot': {
        const f = { hasSpot: 'no' as const, ...(currentCategory ? { assetCategory: currentCategory } : {}) };
        onFiltersChange(f);
        setTempFilters(f);
        break;
      }
      case 'newListed': {
        const f = { listAge: '<180d' as const, ...(currentCategory ? { assetCategory: currentCategory } : {}) };
        onFiltersChange(f);
        setTempFilters(f);
        break;
      }
      case 'overbought': {
        const f = { rsi7: '>75' as const, rsi14: '>75' as const, ...(currentCategory ? { assetCategory: currentCategory } : {}) };
        onFiltersChange(f);
        setTempFilters(f);
        break;
      }
      case 'oversold': {
        const f = { rsi7: '<25' as const, rsi14: '<25' as const, ...(currentCategory ? { assetCategory: currentCategory } : {}) };
        onFiltersChange(f);
        setTempFilters(f);
        break;
      }
    }
    // Scroll table to top when filter changes
    onScrollToTop?.();
  };

  const activeQuickFilter = getActiveQuickFilter();

  // Fixed columns that are always shown and not counted
  const excludedColumns = ['favorite', 'rank', 'logo', 'symbol', 'hasSpot'];
  const visibleCount = Object.entries(columns)
    .filter(([key]) => !excludedColumns.includes(key))
    .filter(([, v]) => v).length;
  const totalCount = Object.keys(columns).length - excludedColumns.length;

  // Only count filters that have actual values (not undefined or empty string or empty array)
  // Exclude assetCategory since it's always set via the toggle and isn't a "filter"
  const hasFilters = Object.entries(filters).some(([key, v]) => {
    if (key === 'assetCategory') return false;
    if (Array.isArray(v)) return v.length > 0;
    return v !== undefined && v !== '';
  });

  // Check if columns differ from default
  const defaultColumns = getDefaultColumns();
  const hasNonDefaultColumns = Object.keys(columns).some(
    key => columns[key as keyof ColumnVisibility] !== defaultColumns[key as keyof ColumnVisibility]
  );

  const handleClearFilters = () => {
    const base = exchange === 'okx' && filters.assetCategory ? { assetCategory: filters.assetCategory } : {};
    setTempFilters(base);
    onFiltersChange(base);
  };

  const exchangeLabel = exchange === 'hyperliquid' ? 'Hyperliquid' : 'OKX';

  // Asset category tab state — derived from filters
  const activeAssetCategory: 'crypto' | 'stock' = filters.assetCategory === 'stock' ? 'stock' : 'crypto';

  // On mount, default to 'crypto' if no assetCategory is set (OKX only)
  useEffect(() => {
    if (exchange === 'okx' && !filters.assetCategory) {
      onFiltersChange({ ...filters, assetCategory: 'crypto' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAssetCategoryChange = (value: string) => {
    const category = value as 'crypto' | 'stock';
    // If clicking the same category again, reset all quick filters
    if (category === activeAssetCategory) {
      const resetFilters = { assetCategory: category as AssetCategory };
      onFiltersChange(resetFilters);
      setTempFilters(resetFilters);
    } else {
      // Switching to a different category — reset quick filters too for a clean slate
      const newFilters = { assetCategory: category as AssetCategory };
      onFiltersChange(newFilters);
      setTempFilters(newFilters);
    }
    onScrollToTop?.();
  };

  // Asset category options (Crypto / Stock toggle)
  const assetCategoryOptions: PillButtonOption<string>[] = [
    { value: 'crypto', label: 'Crypto' },
    { value: 'stock', label: 'Stock' },
  ];

  // Customize panel tab options
  const customizePanelOptions: PillButtonOption<string>[] = [
    { value: 'columns', label: hasNonDefaultColumns ? 'Columns •' : 'Columns' },
    { value: 'filters', label: hasFilters ? 'Filters •' : 'Filters' },
  ];

  // Main filter options - using PillButtonGroup template
  const mainFilterOptions = useMemo((): PillButtonOption<QuickFilter>[] => [
    {
      value: 'top25',
      label: 'Top 25',
      tooltip: `${exchangeLabel} Perp Market Cap Rank 1-25`
    },
    {
      value: 'meme',
      label: '🐸 Meme',
      activeColor: 'text-orange-500',
      tooltip: 'Meme Tokens Only'
    },
    // Only show No Spot for exchanges that have spot data
    ...(exchange !== 'hyperliquid' ? [{
      value: 'noSpot' as QuickFilter,
      label: '🚫 No Spot',
      activeColor: 'text-purple-500',
      hiddenOnMobile: true,
      tooltip: `Tokens without Spot listing on ${exchangeLabel}`
    }] : []),
    // Only show New Listed for exchanges that have listing date data
    ...(exchange !== 'hyperliquid' ? [{
      value: 'newListed' as QuickFilter,
      label: '🆕 New Listed',
      activeColor: 'text-blue-500',
      hiddenOnMobile: true,
      tooltip: 'Listed <180d'
    }] : []),
  ], [exchangeLabel, exchange]);

  // RSI filter options - using PillButtonGroup template
  const categoryLabel = exchange === 'okx'
    ? (activeAssetCategory === 'stock' ? 'Stock' : 'Crypto')
    : '';
  const scopeLabel = exchange === 'okx'
    ? `${exchangeLabel} ${categoryLabel} Perp Tokens`
    : `All ${exchangeLabel} Perp Tokens`;

  const rsiFilterOptions = useMemo((): PillButtonOption<QuickFilter>[] => [
    {
      value: 'overbought',
      label: '🔥 Overbought',
      badge: overboughtCount > 0 ? overboughtCount : undefined,
      activeColor: 'text-red-600',
      tooltip: (
        <>
          <div className="text-[11px] font-medium text-muted-foreground mb-1">Daily Overbought</div>
          <div className="text-[12px] flex flex-col gap-0.5">
            <span className="text-foreground">{scopeLabel}</span>
            <span className="text-foreground">D-RSI7 &gt; 75</span>
            <span className="text-foreground">D-RSI14 &gt; 75</span>
          </div>
        </>
      )
    },
    {
      value: 'oversold',
      label: '🧊 Oversold',
      badge: oversoldCount > 0 ? oversoldCount : undefined,
      activeColor: 'text-green-600',
      tooltip: (
        <>
          <div className="text-[11px] font-medium text-muted-foreground mb-1">Daily Oversold</div>
          <div className="text-[12px] flex flex-col gap-0.5">
            <span className="text-foreground">{scopeLabel}</span>
            <span className="text-foreground">D-RSI7 &lt; 25</span>
            <span className="text-foreground">D-RSI14 &lt; 25</span>
          </div>
        </>
      )
    },
  ], [overboughtCount, oversoldCount, scopeLabel]);

  // Column options grouped by category
  const columnGroups: { label: string; columns: { key: ColumnKey; label: string }[] }[] = [
    {
      label: 'Price & Funding',
      columns: [
        { key: 'price', label: 'Price' },
        { key: 'fundingRate', label: 'Funding Rate' },
        { key: 'fundingApr', label: 'Funding APR' },
        { key: 'fundingInterval', label: 'Funding Interval' },
        { key: 'volume24h', label: '24H Volume' },
        { key: 'marketCap', label: 'Market Cap' },
      ]
    },
    {
      label: 'Price Change',
      columns: [
        { key: 'change4h', label: '4H Change' },
        { key: 'change', label: '24H Change' },
        { key: 'change7d', label: '7D Change' },
      ]
    },
    {
      label: 'RSI Indicators',
      columns: [
        { key: 'dRsiSignal', label: 'D-RSI Avg Signal' },
        { key: 'wRsiSignal', label: 'W-RSI Avg Signal' },
        { key: 'rsi7', label: 'D-RSI7' },
        { key: 'rsi14', label: 'D-RSI14' },
        { key: 'rsiW7', label: 'W-RSI7' },
        { key: 'rsiW14', label: 'W-RSI14' },
      ]
    },
    // Only show listing date column for exchanges that have the data
    ...(exchange !== 'hyperliquid' ? [{
      label: 'Other',
      columns: [
        { key: 'listDate' as ColumnKey, label: 'List Date' },
      ]
    }] : []),
  ];

  return (
    <>
      {/* Mobile Search Row - minimal style */}
      <div className="md:hidden mb-3 w-full">
        <label className="flex items-center gap-2 w-full border-b border-border pb-2 cursor-text">
          <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <input
            ref={mobileSearchInputRef}
            type="text"
            placeholder=""
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="bg-transparent border-none outline-none text-[14px] text-foreground placeholder:text-muted-foreground flex-1"
            aria-label="Search tokens"
          />
        </label>
      </div>

      {/* Quick Filters + Controls Row - Flat structure for consistent gap */}
      <div className="flex items-center gap-4 relative z-[60]">
        {/* Crypto / Stock toggle */}
        {exchange === 'okx' && (
          <PillButtonGroup
            options={assetCategoryOptions}
            value={activeAssetCategory}
            onChange={handleAssetCategoryChange}
          />
        )}

        {/* Main Quick Filters — hidden in Stock mode */}
        {activeAssetCategory !== 'stock' && (
          <PillButtonGroup
            options={mainFilterOptions}
            value={activeQuickFilter}
            onChange={handleQuickFilter}
          />
        )}

        {/* RSI Quick Filters — always visible */}
        <PillButtonGroup
          options={rsiFilterOptions}
          value={activeQuickFilter}
          onChange={handleQuickFilter}
          className="hidden md:inline-flex"
        />

        {/* Settings icon */}
        <Button
          ref={customizeButtonRef}
          variant="ghost"
          size="icon"
          className="h-control-default w-8"
          onClick={() => setShowCustomizePanel(!showCustomizePanel)}
          aria-label="Toggle settings panel"
          aria-expanded={showCustomizePanel}
        >
          <Settings className="w-4 h-4 text-muted-foreground" />
        </Button>

        {/* Search */}
        <label className="hidden md:inline-flex items-center gap-1 cursor-text">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder=""
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="bg-transparent border-none outline-none text-[13px] text-foreground w-[60px]"
            aria-label="Search tokens"
          />
        </label>
      </div>

      {/* Sidebar Overlay */}
      {showCustomizePanel && (
        <div
          className="fixed inset-0 bg-black/20 z-[100]"
          onClick={() => setShowCustomizePanel(false)}
        />
      )}

      {/* Sidebar Panel */}
      <div
        ref={customizePanelRef}
        className={`fixed top-0 right-0 h-full w-[500px] bg-card shadow-xl z-[101] transform transition-transform duration-300 ease-in-out overflow-hidden ${
          showCustomizePanel ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-950/[0.10] dark:border-white/[0.10]">
            <PillButtonGroup
              options={customizePanelOptions}
              value={customizeTab}
              onChange={(v) => setCustomizeTab(v as 'columns' | 'filters')}
            />
            {(hasFilters || hasNonDefaultColumns) && (
              <Button
                variant="ghost"
                size="icon"
                className="h-control-default w-8"
                onClick={() => {
                  if (customizeTab === 'columns') {
                    onColumnsPreset('default');
                  } else {
                    handleClearFilters();
                  }
                }}
                title={customizeTab === 'columns' ? 'Reset columns' : 'Reset filters'}
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden p-4">

          {/* Columns tab content */}
          {customizeTab === 'columns' && (
            <div className="space-y-4">
              {columnGroups.map(group => {
                const groupKeys = group.columns.map(c => c.key);
                const activeKeys = groupKeys.filter(k => columns[k]);
                return (
                  <div key={group.label}>
                    <div className="text-[11px] text-muted-foreground font-medium mb-2">{group.label}</div>
                    <PillButtonGroup
                      options={group.columns.map(col => ({ value: col.key, label: col.label }))}
                      value={activeKeys}
                      onChange={(newKeys) => {
                        // Toggle columns based on diff
                        groupKeys.forEach(k => {
                          const wasActive = columns[k];
                          const isNowActive = newKeys.includes(k);
                          if (wasActive !== isNowActive) {
                            onColumnChange(k, isNowActive);
                          }
                        });
                      }}
                      multiSelect
                      size="sm"
                    />
                  </div>
                );
              })}
            </div>
          )}

          {/* Filters tab content */}
          {customizeTab === 'filters' && (
            <div className="space-y-4">
              {/* Market Cap Rank */}
              <div>
                <div className="text-[11px] text-muted-foreground font-medium mb-2">Market Cap Rank</div>
                <PillButtonGroup
                  options={[
                    { value: '1-20', label: 'Top 20' },
                    { value: '21-50', label: '21-50' },
                    { value: '51-100', label: '51-100' },
                    { value: '>500', label: '>500' },
                  ]}
                  value={filters.rank || ''}
                  onChange={(v) => onFiltersChange({ ...filters, rank: v || undefined })}
                  allowDeselect
                  size="sm"
                />
              </div>

              {/* Market Cap */}
              <div>
                <div className="text-[11px] text-muted-foreground font-medium mb-2">Market Cap</div>
                <PillButtonGroup
                  options={[
                    { value: '20-100', label: '$20M-$100M' },
                    { value: '100-1000', label: '$100M-$1B' },
                    { value: '1000+', label: '≥$1B' },
                  ]}
                  value={filters.marketCapMin || ''}
                  onChange={(v) => onFiltersChange({ ...filters, marketCapMin: v || undefined })}
                  allowDeselect
                  size="sm"
                />
              </div>

              {/* Funding Rate */}
              <div>
                <div className="text-[11px] text-muted-foreground font-medium mb-2">Funding Rate</div>
                <PillButtonGroup
                  options={[
                    { value: 'positive', label: 'Positive' },
                    { value: 'negative', label: 'Negative' },
                  ]}
                  value={filters.fundingRate || ''}
                  onChange={(v) => onFiltersChange({ ...filters, fundingRate: v || undefined })}
                  allowDeselect
                  size="sm"
                />
              </div>

              {/* RSI */}
              <div>
                <div className="text-[11px] text-muted-foreground font-medium mb-2">RSI Indicators</div>
                <div className="flex flex-col gap-3">
                  {/* Daily RSI Row */}
                  <div className="flex flex-wrap gap-x-4 gap-y-3">
                    <RsiFilter label="D-RSI7" value={filters.rsi7} onChange={(v) => onFiltersChange({ ...filters, rsi7: v })} />
                    <RsiFilter label="D-RSI14" value={filters.rsi14} onChange={(v) => onFiltersChange({ ...filters, rsi14: v })} />
                  </div>
                  {/* Weekly RSI Row */}
                  <div className="flex flex-wrap gap-x-4 gap-y-3">
                    <RsiFilter label="W-RSI7" value={filters.rsiW7} onChange={(v) => onFiltersChange({ ...filters, rsiW7: v })} />
                    <RsiFilter label="W-RSI14" value={filters.rsiW14} onChange={(v) => onFiltersChange({ ...filters, rsiW14: v })} />
                  </div>
                </div>
              </div>

              {/* RSI Signal Filters */}
              <div>
                <div className="text-[11px] text-muted-foreground font-medium mb-2">D-RSI Avg Signal</div>
                <PillButtonGroup<RsiSignalType>
                  options={[
                    { value: 'extreme-oversold', label: 'Extreme Oversold' },
                    { value: 'oversold', label: 'Oversold' },
                    { value: 'very-weak', label: 'Very Weak' },
                    { value: 'weak', label: 'Weak' },
                    { value: 'neutral', label: 'Neutral' },
                    { value: 'strong', label: 'Strong' },
                    { value: 'very-strong', label: 'Very Strong' },
                    { value: 'overbought', label: 'Overbought' },
                    { value: 'extreme-overbought', label: 'Extreme Overbought' },
                  ]}
                  value={filters.dRsiSignal || []}
                  onChange={(v) => onFiltersChange({ ...filters, dRsiSignal: v.length > 0 ? v : undefined })}
                  multiSelect
                  size="sm"
                />
              </div>

              <div>
                <div className="text-[11px] text-muted-foreground font-medium mb-2">W-RSI Avg Signal</div>
                <PillButtonGroup<RsiSignalType>
                  options={[
                    { value: 'extreme-oversold', label: 'Extreme Oversold' },
                    { value: 'oversold', label: 'Oversold' },
                    { value: 'very-weak', label: 'Very Weak' },
                    { value: 'weak', label: 'Weak' },
                    { value: 'neutral', label: 'Neutral' },
                    { value: 'strong', label: 'Strong' },
                    { value: 'very-strong', label: 'Very Strong' },
                    { value: 'overbought', label: 'Overbought' },
                    { value: 'extreme-overbought', label: 'Extreme Overbought' },
                  ]}
                  value={filters.wRsiSignal || []}
                  onChange={(v) => onFiltersChange({ ...filters, wRsiSignal: v.length > 0 ? v : undefined })}
                  multiSelect
                  size="sm"
                />
              </div>

              {/* Has Spot - only for exchanges with spot data */}
              {exchange !== 'hyperliquid' && (
                <div>
                  <div className="text-[11px] text-muted-foreground font-medium mb-2">Has Spot on {exchangeLabel}</div>
                  <PillButtonGroup
                    options={[
                      { value: 'yes', label: 'Yes' },
                      { value: 'no', label: 'No' },
                    ]}
                    value={filters.hasSpot || ''}
                    onChange={(v) => onFiltersChange({ ...filters, hasSpot: v || undefined })}
                    allowDeselect
                    size="sm"
                  />
                </div>
              )}

              {/* Listing Age - only for exchanges with listing date data */}
              {exchange !== 'hyperliquid' && (
                <div>
                  <div className="text-[11px] text-muted-foreground font-medium mb-2">Listing Age</div>
                  <PillButtonGroup
                    options={[
                      { value: '<30d', label: '<30d' },
                      { value: '<60d', label: '<60d' },
                      { value: '<90d', label: '<90d' },
                      { value: '<180d', label: '<180d' },
                    ]}
                    value={filters.listAge || ''}
                    onChange={(v) => onFiltersChange({ ...filters, listAge: v || undefined })}
                    allowDeselect
                    size="sm"
                  />
                </div>
              )}

            </div>
          )}
          </div>
        </div>
      </div>

    </>
  );
}
