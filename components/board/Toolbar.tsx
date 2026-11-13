'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { ColumnVisibility, Filters, AssetCategory } from '@/lib/types';
import { getDefaultColumns } from '@/lib/defaults';
import { UNIVERSE } from '@/lib/constants';
import { Button, Chips, ChipOption, SearchField, Segmented, SegmentedOption, TipBody } from '@/components/ui';
import { CustomizeDrawer } from './CustomizeDrawer';

type QuickFilter = 'all' | 'top25' | 'meme' | 'overbought' | 'oversold';
type Category = 'crypto' | 'stock' | 'all';

interface ToolbarProps {
  columns: ColumnVisibility;
  filters: Filters;
  searchTerm: string;
  overboughtCount: number;
  oversoldCount: number;
  exchange?: 'okx' | 'hyperliquid';
  onColumnChange: (col: keyof ColumnVisibility, visible: boolean) => void;
  onColumnsPreset: (preset: 'all' | 'none' | 'default') => void;
  onFiltersChange: (filters: Filters) => void;
  onSearchChange: (term: string) => void;
  onScrollToTop?: () => void;
}

/** Which quick filter the current filters amount to. */
function activeQuickFilter(filters: Filters): QuickFilter {
  if (filters.rank === '1-25' && !filters.rsi7 && !filters.rsi14 && !filters.isMeme) return 'top25';
  if (filters.isMeme === 'yes' && !filters.rsi7 && !filters.rsi14) return 'meme';
  if (filters.rsi7 === '>75' && filters.rsi14 === '>75') return 'overbought';
  if (filters.rsi7 === '<25' && filters.rsi14 === '<25') return 'oversold';
  return 'all';
}

const QUICK_FILTERS: Record<Exclude<QuickFilter, 'all'>, Filters> = {
  top25: { rank: '1-25' },
  meme: { isMeme: 'yes' },
  overbought: { rsi7: '>75', rsi14: '>75' },
  oversold: { rsi7: '<25', rsi14: '<25' },
};

/**
 * Table toolbar: scope (Crypto / Stocks / All), quick filters, and the
 * Customize drawer for columns and detailed filters.
 */
export function Toolbar({
  columns,
  filters,
  searchTerm,
  overboughtCount,
  oversoldCount,
  exchange = 'okx',
  onColumnChange,
  onColumnsPreset,
  onFiltersChange,
  onSearchChange,
  onScrollToTop,
}: ToolbarProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  const isOkx = exchange === 'okx';
  const exchangeLabel = isOkx ? 'OKX' : 'Hyperliquid';

  const category: Category = filters.assetCategory === 'stock' ? 'stock' : filters.assetCategory === 'crypto' ? 'crypto' : 'all';
  const quick = activeQuickFilter(filters);

  // OKX opens on Crypto
  useEffect(() => {
    if (isOkx && !filters.assetCategory) onFiltersChange({ ...filters, assetCategory: 'crypto' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The asset category is a scope, not a filter: quick filters keep it.
  const scope = (): Filters => (filters.assetCategory ? { assetCategory: filters.assetCategory } : {});

  const handleCategory = (value: Category) => {
    onSearchChange(''); // a leftover search would mask the new scope
    onFiltersChange(value === 'all' ? {} : { assetCategory: value as AssetCategory });
    onScrollToTop?.();
  };

  /** `next` is undefined when the active chip is clicked again (toggle off). */
  const handleQuick = (next: QuickFilter | undefined) => {
    onSearchChange('');
    if (next === 'all') onFiltersChange({});
    else onFiltersChange(next ? { ...QUICK_FILTERS[next], ...scope() } : scope());
    onScrollToTop?.();
  };

  // assetCategory is always set via the scope switch — it is not a "filter"
  const hasFilters = Object.entries(filters).some(([key, v]) => {
    if (key === 'assetCategory') return false;
    return Array.isArray(v) ? v.length > 0 : v !== undefined && v !== '';
  });
  const hasNonDefaultColumns = useMemo(() => {
    const defaults = getDefaultColumns();
    return (Object.keys(columns) as (keyof ColumnVisibility)[]).some((k) => columns[k] !== defaults[k]);
  }, [columns]);

  const categoryOptions: SegmentedOption<Category>[] = [
    { value: 'crypto', label: 'Crypto', tooltip: `Top ${UNIVERSE.MAX_CRYPTO} tokens by market cap` },
    { value: 'stock', label: 'Stocks' },
    { value: 'all', label: 'All' },
  ];

  const scopeLabel = isOkx && category !== 'all' ? `${exchangeLabel} ${category === 'stock' ? 'stock' : 'crypto'} perps` : `All ${exchangeLabel} perps`;

  const quickOptions: ChipOption<QuickFilter>[] = [
    // OKX has "All" in the scope switch already
    ...(isOkx ? [] : [{ value: 'all' as const, label: 'All', tooltip: `All ${exchangeLabel} perps` }]),
    ...(category === 'stock'
      ? []
      : [
          { value: 'top25' as const, label: 'Top 25', tooltip: 'Market cap rank 1–25' },
          { value: 'meme' as const, label: 'Meme', tooltip: 'Meme tokens only' },
        ]),
    {
      value: 'overbought',
      label: 'Overbought',
      dot: 'hot',
      count: overboughtCount,
      tooltip: <TipBody title="Daily overbought" items={[scopeLabel, 'D-RSI7 > 75 and D-RSI14 > 75']} />,
    },
    {
      value: 'oversold',
      label: 'Oversold',
      dot: 'cold',
      count: oversoldCount,
      tooltip: <TipBody title="Daily oversold" items={[scopeLabel, 'D-RSI7 < 25 and D-RSI14 < 25']} />,
    },
  ];

  return (
    <>
      {/* Below md the search field lives here; from md up it is in the app bar */}
      <SearchField value={searchTerm} onChange={onSearchChange} className="mb-2 h-control-lg w-full md:hidden" />

      <div className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto p-0.5">
          {isOkx && (
            <>
              <Segmented label="Asset class" options={categoryOptions} value={category} onChange={handleCategory} />
              <span className="mx-1 h-4 w-px flex-shrink-0 bg-line-strong" aria-hidden="true" />
            </>
          )}
          <Chips label="Quick filters" nowrap options={quickOptions} value={quick === 'all' && isOkx ? undefined : quick} onChange={handleQuick} />
        </div>

        <Button
          className="hidden flex-shrink-0 md:inline-flex"
          onClick={() => setDrawerOpen(true)}
          aria-label="Customize columns and filters"
          aria-expanded={drawerOpen}
        >
          <SlidersHorizontal className="size-3.5" aria-hidden="true" />
          Customize
          {(hasFilters || hasNonDefaultColumns) && <span className="size-1.5 rounded-full bg-accent" aria-hidden="true" />}
        </Button>
      </div>

      <CustomizeDrawer
        open={drawerOpen}
        onClose={closeDrawer}
        exchange={exchange}
        columns={columns}
        filters={filters}
        hasFilters={hasFilters}
        hasNonDefaultColumns={hasNonDefaultColumns}
        onColumnChange={onColumnChange}
        onResetColumns={() => onColumnsPreset('default')}
        onFiltersChange={onFiltersChange}
        onClearFilters={() => onFiltersChange(isOkx && filters.assetCategory ? { assetCategory: filters.assetCategory } : {})}
      />
    </>
  );
}
