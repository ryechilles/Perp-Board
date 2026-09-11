'use client';

import { ReactNode } from 'react';
import { Check, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TokenAvatar } from '@/components/ui';

/**
 * Building blocks for the inset-grouped lists inside widgets
 * (use with `<SmallWidget padded={false}>`).
 */

interface TokenListRowProps {
  symbol: string;
  logo?: string;
  /** Secondary text after the symbol (e.g. price) */
  detail?: ReactNode;
  /** Trailing value (e.g. RSI reading, APR, change pill) */
  value: ReactNode;
  onClick?: () => void;
}

/** 44pt tappable token row; separators inset past the avatar, like iOS lists. */
export function TokenListRow({ symbol, logo, detail, value, onClick }: TokenListRowProps) {
  return (
    <li>
      <button
        type="button"
        className="group/row w-full min-h-[44px] flex items-center gap-2.5 px-4 text-left transition-colors hover:bg-foreground/[0.03] focus-visible:outline-none focus-visible:bg-foreground/[0.05]"
        onClick={onClick}
        aria-label={`Show ${symbol} in the table`}
      >
        <TokenAvatar symbol={symbol} logo={logo} size="md" className="w-[22px] h-[22px]" />
        <span className="flex-1 min-w-0 flex items-baseline gap-2">
          <span className="text-[0.8125rem] font-semibold truncate" translate="no">{symbol}</span>
          {detail && <span className="text-xs text-muted-foreground tabular-nums truncate">{detail}</span>}
        </span>
        <span className="flex-shrink-0 tabular-nums">{value}</span>
        <ChevronRight className="w-3.5 h-3.5 -mr-1 text-faint opacity-0 group-hover/row:opacity-100 transition-opacity" aria-hidden="true" />
      </button>
    </li>
  );
}

/** Wrapper for TokenListRow items. */
export function TokenList({ children, className }: { children: ReactNode; className?: string }) {
  return <ul className={cn('inset-list list-none', className)}>{children}</ul>;
}

interface SectionLabelProps {
  label: string;
  /** Background class for the leading dot */
  dot?: string;
  hint?: string;
  count?: number | string;
  /** Makes the whole label a button (e.g. "show this group in the table") */
  onClick?: () => void;
}

/** Small grouped-list section header: ● Label  hint ………… count */
export function SectionLabel({ label, dot, hint, count, onClick }: SectionLabelProps) {
  const inner = (
    <>
      {dot && <span className={cn('w-[7px] h-[7px] rounded-full flex-shrink-0', dot)} aria-hidden="true" />}
      <span className="font-medium text-muted-foreground">{label}</span>
      {hint && <span className="text-faint">{hint}</span>}
      {count !== undefined && <span className="ml-auto text-faint tabular-nums">{count}</span>}
    </>
  );
  const cls = 'w-full flex items-center gap-2 px-4 pt-3 pb-1 text-xs text-left';
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(cls, 'hover:[&>span]:text-foreground focus-visible:outline-none focus-visible:underline')}
        aria-label={`Show ${label} in the table`}
      >
        {inner}
      </button>
    );
  }
  return <div className={cls}>{inner}</div>;
}

/** Friendly empty state for lists that are legitimately empty. */
export function EmptyState({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="flex flex-col items-center gap-1 px-4 pt-3 pb-5 text-center">
      <span className="w-8 h-8 rounded-full bg-fill grid place-items-center text-muted-foreground mb-1.5" aria-hidden="true">
        <Check className="w-4 h-4" strokeWidth={2.2} />
      </span>
      <span className="text-[0.8125rem] font-semibold">{title}</span>
      {detail && <span className="text-xs text-muted-foreground">{detail}</span>}
    </div>
  );
}
