'use client';

import { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import type { Tone } from '@/lib/format';
import { cn } from '@/lib/utils';
import { InfoTip, Skeleton, TokenAvatar, toneFill } from '@/components/ui';

// ── Panel ────────────────────────────────────────────────────────────────

export interface PanelProps {
  title: string;
  /** Short qualifier next to the title ("Top 50") */
  note?: string;
  /** Explanation behind the ⓘ */
  info?: ReactNode;
  /** Controls at the right of the header (a Segmented, a count) */
  actions?: ReactNode;
  children: ReactNode;
  /** Let content run edge to edge (lists) — default pads it */
  flush?: boolean;
  loading?: boolean;
  /** Layout-matched placeholder shown while loading */
  skeleton?: ReactNode;
  className?: string;
}

/**
 * Panel — the one shell for a block of the Insights sidebar: caps title, an
 * optional note / ⓘ / actions, then content. Panels stack and are divided by a
 * rule; they have no card chrome of their own.
 */
export function Panel({ title, note, info, actions, children, flush = false, loading = false, skeleton, className }: PanelProps) {
  return (
    <section className={cn('flex w-full flex-col rule-b', className)}>
      <header className="flex min-h-control-md items-center gap-2 px-4 pt-3">
        <h2 className="caps flex-shrink-0">{title}</h2>
        {note && <span className="min-w-0 truncate text-small text-fg-faint">{note}</span>}
        <span className="flex-1" />
        {actions}
        {info && <InfoTip label={title} content={info} className="-mr-0.5" />}
      </header>
      <div className={cn(flush ? 'pb-2 pt-1' : 'px-4 pb-4 pt-2')}>
        {loading ? (
          <div className={cn(flush && 'px-4 pb-2 pt-1')}>
            {skeleton ?? (
              <div className="flex flex-col gap-2.5">
                <Skeleton className="h-8 w-28" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            )}
          </div>
        ) : (
          children
        )}
      </div>
    </section>
  );
}

/** Skeleton rows shaped like ListRow, for panels that load a token list. */
export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex h-control-lg items-center gap-2">
          <Skeleton className="size-5 rounded-full" />
          <Skeleton className="h-3 w-12" />
          <Skeleton className="ml-auto h-3 w-20" />
        </div>
      ))}
    </div>
  );
}

// ── Lists inside a panel (use with <Panel flush>) ────────────────────────

interface ListRowProps {
  symbol: string;
  logo?: string;
  /** Secondary value after the symbol (price) */
  detail?: ReactNode;
  /** Trailing readout (RsiReading, Delta, FundingValue…) */
  value: ReactNode;
  onClick?: () => void;
}

/** One token in a panel list. Clicking it shows the token in the table. */
export function ListRow({ symbol, logo, detail, value, onClick }: ListRowProps) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-label={`Show ${symbol} in the table`}
        className="focus-ring-inset group/row relative flex h-control-lg w-full items-center gap-2 px-4 text-left outline-none transition-colors hover:bg-fill"
      >
        <TokenAvatar symbol={symbol} logo={logo} size="md" />
        <span className="flex min-w-0 flex-1 items-baseline gap-2">
          <span className="truncate font-semibold" translate="no">{symbol}</span>
          {detail && <span className="truncate text-small text-fg-muted">{detail}</span>}
        </span>
        <span className="flex-shrink-0">{value}</span>
        {/* Hangs in the right padding: takes no space, so values end on the panel's edge */}
        <ChevronRight className="absolute right-0.5 size-3 text-fg-faint opacity-0 transition-opacity group-hover/row:opacity-100" aria-hidden="true" />
      </button>
    </li>
  );
}

export function List({ children }: { children: ReactNode }) {
  return <ul className="list-none">{children}</ul>;
}

interface ListHeadingProps {
  label: string;
  dot?: Tone;
  count?: number | string;
  /** Makes the heading a button ("show this group in the table") */
  onClick?: () => void;
}

/** Sub-heading for a group of rows inside a panel: ● Label ……… count */
export function ListHeading({ label, dot, count, onClick }: ListHeadingProps) {
  const inner = (
    <>
      {dot && <span className={cn('size-1.5 flex-shrink-0 rounded-full', toneFill[dot])} aria-hidden="true" />}
      <span className="font-medium">{label}</span>
      {count !== undefined && <span className="num ml-auto text-fg-faint">{count}</span>}
    </>
  );
  const cls = 'flex h-control-md w-full items-center gap-2 px-4 text-left text-small text-fg-muted';
  if (!onClick) return <div className={cls}>{inner}</div>;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Show ${label} in the table`}
      className={cn(cls, 'focus-ring-inset outline-none transition-colors hover:text-fg')}
    >
      {inner}
    </button>
  );
}

/** One quiet line for a list that is legitimately empty. Never a hero. */
export function EmptyLine({ children }: { children: ReactNode }) {
  return <p className="flex min-h-control-md items-center px-4 text-small text-fg-faint">{children}</p>;
}

// ── Stat ─────────────────────────────────────────────────────────────────

interface StatProps {
  /** The figure — pass a data component (Figure, Money, Percent…) */
  value: ReactNode;
  label: string;
  /** 'display' for a panel's headline figure, 'title' (default) for supporting figures */
  size?: 'title' | 'display';
  align?: 'left' | 'right';
  className?: string;
}

/** A figure with its caption underneath. */
export function Stat({ value, label, size = 'title', align = 'left', className }: StatProps) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-0.5', align === 'right' && 'items-end text-right', className)}>
      <span className={cn('font-semibold', size === 'display' ? 'text-display' : 'text-title')}>{value}</span>
      <span className="truncate text-caption text-fg-muted">{label}</span>
    </div>
  );
}
