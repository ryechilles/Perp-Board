'use client';

import { ReactNode, useEffect, useRef, useState } from 'react';
import { RotateCcw, X } from 'lucide-react';
import { ColumnKey, ColumnVisibility, Filters, RsiSignalType } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Button, Chips, ChipOption, IconButton, Segmented } from '@/components/ui';
import { RsiFilter } from './RsiFilter';

interface CustomizeDrawerProps {
  open: boolean;
  onClose: () => void;
  exchange: 'okx' | 'hyperliquid';
  columns: ColumnVisibility;
  filters: Filters;
  hasFilters: boolean;
  hasNonDefaultColumns: boolean;
  onColumnChange: (col: keyof ColumnVisibility, visible: boolean) => void;
  onResetColumns: () => void;
  onFiltersChange: (filters: Filters) => void;
  onClearFilters: () => void;
}

const COLUMN_GROUPS: { label: string; columns: { key: ColumnKey; label: string }[]; okxOnly?: boolean }[] = [
  {
    label: 'Price & funding',
    columns: [
      { key: 'price', label: 'Price' },
      { key: 'fundingRate', label: 'Funding rate' },
      { key: 'fundingApr', label: 'Funding APR' },
      { key: 'fundingInterval', label: 'Funding interval' },
      { key: 'volume24h', label: '24h volume' },
      { key: 'marketCap', label: 'Market cap' },
    ],
  },
  {
    label: 'Price change',
    columns: [
      { key: 'change4h', label: '4h change' },
      { key: 'change', label: '24h change' },
      { key: 'change7d', label: '7d change' },
    ],
  },
  {
    label: 'RSI',
    columns: [
      { key: 'dRsiSignal', label: 'Daily RSI' },
      { key: 'wRsiSignal', label: 'Weekly RSI' },
      { key: 'tdSeq', label: 'TD Sequential' },
      { key: 'rsi7', label: 'D-RSI7' },
      { key: 'rsi14', label: 'D-RSI14' },
      { key: 'rsiW7', label: 'W-RSI7' },
      { key: 'rsiW14', label: 'W-RSI14' },
    ],
  },
  // Only OKX has listing dates
  { label: 'Other', okxOnly: true, columns: [{ key: 'listDate', label: 'Listing date' }] },
];

const RSI_SIGNALS: ChipOption<RsiSignalType>[] = [
  { value: 'extreme-oversold', label: 'Extreme Oversold' },
  { value: 'oversold', label: 'Oversold' },
  { value: 'very-weak', label: 'Very Weak' },
  { value: 'weak', label: 'Weak' },
  { value: 'neutral', label: 'Neutral' },
  { value: 'strong', label: 'Strong' },
  { value: 'very-strong', label: 'Very Strong' },
  { value: 'overbought', label: 'Overbought' },
  { value: 'extreme-overbought', label: 'Extreme Overbought' },
];

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="text-small font-medium text-fg-muted">{label}</div>
      {children}
    </div>
  );
}

/** Right-hand drawer: which columns the table shows, and the detailed filters. */
export function CustomizeDrawer({
  open,
  onClose,
  exchange,
  columns,
  filters,
  hasFilters,
  hasNonDefaultColumns,
  onColumnChange,
  onResetColumns,
  onFiltersChange,
  onClearFilters,
}: CustomizeDrawerProps) {
  const [tab, setTab] = useState<'columns' | 'filters'>('columns');
  const panelRef = useRef<HTMLDivElement>(null);

  // Dialog behaviour: Escape closes, Tab is trapped, focus returns on close,
  // and the closed drawer is inert (not reachable by keyboard or AT).
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    if (!open) {
      panel.inert = true;
      return;
    }
    panel.inert = false;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusables = () =>
      panel.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])');
    focusables()[0]?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [open, onClose]);

  const canReset = tab === 'columns' ? hasNonDefaultColumns : hasFilters;

  return (
    <>
      {open && <div aria-hidden="true" className="fixed inset-0 z-overlay bg-black/30 animate-in fade-in-0" onClick={onClose} />}

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Customize columns and filters"
        className={cn(
          'fixed bottom-2 right-2 top-2 z-drawer flex w-drawer max-w-[calc(100vw-1rem)] flex-col overflow-hidden rounded-panel bg-surface-pop shadow-drawer',
          'transition-transform duration-300 ease-out',
          open ? 'translate-x-0' : 'translate-x-[calc(100%+1rem)]'
        )}
      >
        <div className="flex h-12 flex-shrink-0 items-center gap-2 px-4 rule-b">
          <Segmented
            label="Customize"
            options={[
              { value: 'columns', label: hasNonDefaultColumns ? 'Columns •' : 'Columns' },
              { value: 'filters', label: hasFilters ? 'Filters •' : 'Filters' },
            ]}
            value={tab}
            onChange={setTab}
          />
          <span className="flex-1" />
          {canReset && (
            <Button variant="ghost" onClick={tab === 'columns' ? onResetColumns : onClearFilters}>
              <RotateCcw className="size-3.5" aria-hidden="true" />
              Reset
            </Button>
          )}
          <IconButton label="Close" onClick={onClose}>
            <X className="size-4" aria-hidden="true" />
          </IconButton>
        </div>

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto overflow-x-hidden overscroll-contain px-4 py-5">
          {tab === 'columns' &&
            COLUMN_GROUPS.filter((g) => !g.okxOnly || exchange === 'okx').map((group) => {
              const keys = group.columns.map((c) => c.key);
              return (
                <Group key={group.label} label={group.label}>
                  <Chips
                    multiple
                    size="sm"
                    label={group.label}
                    options={group.columns.map((c) => ({ value: c.key, label: c.label }))}
                    value={keys.filter((k) => columns[k])}
                    onChange={(next) => {
                      keys.forEach((k) => {
                        if (columns[k] !== next.includes(k)) onColumnChange(k, next.includes(k));
                      });
                    }}
                  />
                </Group>
              );
            })}

          {tab === 'filters' && (
            <>
              <Group label="Market cap rank">
                <Chips
                  size="sm"
                  options={[
                    { value: '1-20', label: 'Top 20' },
                    { value: '21-50', label: '21-50' },
                    { value: '>500', label: '>500' },
                  ]}
                  value={filters.rank}
                  onChange={(v) => onFiltersChange({ ...filters, rank: v })}
                />
              </Group>

              <Group label="Market cap">
                <Chips
                  size="sm"
                  options={[
                    { value: '20-100', label: '$20M-$100M' },
                    { value: '100-1000', label: '$100M-$1B' },
                    { value: '1000+', label: '≥$1B' },
                  ]}
                  value={filters.marketCapMin}
                  onChange={(v) => onFiltersChange({ ...filters, marketCapMin: v })}
                />
              </Group>

              <Group label="Funding rate">
                <Chips
                  size="sm"
                  options={[
                    { value: 'positive', label: 'Positive' },
                    { value: 'negative', label: 'Negative' },
                  ]}
                  value={filters.fundingRate}
                  onChange={(v) => onFiltersChange({ ...filters, fundingRate: v })}
                />
              </Group>

              <Group label="RSI values">
                <RsiFilter label="D-RSI7" value={filters.rsi7} onChange={(v) => onFiltersChange({ ...filters, rsi7: v })} />
                <RsiFilter label="D-RSI14" value={filters.rsi14} onChange={(v) => onFiltersChange({ ...filters, rsi14: v })} />
                <RsiFilter label="W-RSI7" value={filters.rsiW7} onChange={(v) => onFiltersChange({ ...filters, rsiW7: v })} />
                <RsiFilter label="W-RSI14" value={filters.rsiW14} onChange={(v) => onFiltersChange({ ...filters, rsiW14: v })} />
              </Group>

              <Group label="Daily RSI signal">
                <Chips<RsiSignalType>
                  multiple
                  size="sm"
                  options={RSI_SIGNALS}
                  value={filters.dRsiSignal || []}
                  onChange={(v) => onFiltersChange({ ...filters, dRsiSignal: v.length > 0 ? v : undefined })}
                />
              </Group>

              <Group label="Weekly RSI signal">
                <Chips<RsiSignalType>
                  multiple
                  size="sm"
                  options={RSI_SIGNALS}
                  value={filters.wRsiSignal || []}
                  onChange={(v) => onFiltersChange({ ...filters, wRsiSignal: v.length > 0 ? v : undefined })}
                />
              </Group>
            </>
          )}
        </div>
      </div>
    </>
  );
}
