import { Star } from 'lucide-react';
import type { TDState } from '@/lib/types';
import { fundingApr, fundingTone, signOf } from '@/lib/format';
import { cn, getTdDisplay } from '@/lib/utils';
import { Tag, TokenAvatar, toneText } from '@/components/ui';

/**
 * Market-specific readouts built on the number rules: funding and TD Sequential.
 */

interface FundingProps {
  /** Per-interval funding rate as a decimal (0.0001 = 0.01%) */
  rate: number | null | undefined;
  /** Settlement interval in hours */
  interval?: number | null;
  /** 'apr' annualizes (the default); 'rate' shows the raw per-interval rate */
  show?: 'apr' | 'rate';
  className?: string;
}

/**
 * Funding. Neutral until the annualized rate reaches ±FUNDING.HIGHLIGHT_APR —
 * a column of small rates is not a column of signals.
 */
export function FundingValue({ rate, interval, show = 'apr', className }: FundingProps) {
  if (rate == null) return <span className="text-fg-faint">—</span>;
  const apr = fundingApr(rate, interval);
  const tone = fundingTone(apr);
  const shown = show === 'apr' ? apr : rate * 100;
  return (
    <span className={cn('num', tone === 'neutral' ? 'text-fg-muted' : toneText[tone], className)}>
      {signOf(shown)}
      {Math.abs(shown).toFixed(show === 'apr' ? 1 : 4)}
      <span className="num-dim-tone">%</span>
    </span>
  );
}

/**
 * TD Sequential. A completed 9 / 13 is a Tag (13 solid); a count in progress is
 * faint text, so only real signals carry weight.
 */
export function TdValue({ td }: { td: TDState | null | undefined }) {
  const d = getTdDisplay(td);
  if (d.kind === 'none') return <span className="text-fg-faint">—</span>;
  if (d.kind === 'signal') {
    return (
      <Tag tone={d.side === 'buy' ? 'up' : 'down'} solid={d.strong} title={d.title} className="num">
        {d.letter}
        {d.count}
      </Tag>
    );
  }
  return (
    <span title={d.title} className="num text-small text-fg-faint">
      {d.letter} {d.count}
    </span>
  );
}

/** Token logo + symbol. */
export function TokenCell({ symbol, logo, size = 'md' }: { symbol: string; logo?: string; size?: 'md' | 'lg' }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <TokenAvatar symbol={symbol} logo={logo} size={size} />
      <span className="truncate font-semibold" translate="no">
        {symbol}
      </span>
    </span>
  );
}

interface FavoriteButtonProps {
  symbol: string;
  active: boolean;
  onToggle: () => void;
  /** 'row' — compact, fades in on row hover (needs a `group` ancestor) · 'card' — large touch target */
  size?: 'row' | 'card';
  className?: string;
}

/** The star that adds a token to the watchlist. */
export function FavoriteButton({ symbol, active, onToggle, size = 'row', className }: FavoriteButtonProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={active ? `Remove ${symbol} from favorites` : `Add ${symbol} to favorites`}
      aria-pressed={active}
      className={cn(
        'focus-ring grid flex-shrink-0 place-items-center transition-[opacity,color]',
        size === 'row' ? 'size-5 rounded-tag' : 'size-10 rounded-control',
        active ? 'text-star' : 'text-fg-faint hover:text-star',
        !active && size === 'row' && 'opacity-50 focus-visible:opacity-100 group-hover:opacity-100',
        className
      )}
    >
      <Star className="size-3.5" fill={active ? 'currentColor' : 'none'} strokeWidth={1.6} aria-hidden="true" />
    </button>
  );
}
