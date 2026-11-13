import type { Tone } from '@/lib/format';
import { deltaTone, moneyParts, priceParts, signOf } from '@/lib/format';
import { cn } from '@/lib/utils';
import { toneText } from '@/components/ui';

/**
 * Number readouts. Every number on screen goes through one of these, so the
 * rules in DESIGN.md → Numbers hold everywhere:
 *   1. tabular figures            3. tiny prices use subscript-zero notation
 *   2. decimals / units stepped   4. colour only where the value's tone says so
 *      back (.num-dim)
 */

const Dash = () => <span className="text-fg-faint">—</span>;

// ── Price ────────────────────────────────────────────────────────────────

interface PriceProps {
  value: number | null | undefined;
  /**
   * Align on the decimal point: the integer part is right-aligned and the
   * fraction left-aligned in a fixed slot, so a column of prices lines up on the
   * dot. Use in table columns; leave off for inline prices.
   */
  aligned?: boolean;
  className?: string;
}

function Fraction({ frac, zeros }: { frac: string; zeros?: number }) {
  if (zeros != null) {
    // 0.0₅43 — the leading zeros are noise, the significant digits are not
    return (
      <>
        <span className="num-dim">
          .0<sub className="align-baseline text-[0.72em] relative top-[0.25em]">{zeros}</sub>
        </span>
        {frac}
      </>
    );
  }
  return frac ? <span className="num-dim">.{frac}</span> : null;
}

export function Price({ value, aligned = false, className }: PriceProps) {
  if (value == null) return <Dash />;
  const { int, frac, zeros } = priceParts(value);
  if (!aligned) {
    return (
      <span className={cn('num', className)}>
        {int}
        <Fraction frac={frac} zeros={zeros} />
      </span>
    );
  }
  return (
    <span className={cn('num inline-grid grid-cols-[auto_6.2ch] font-medium', className)}>
      <span className="text-right">{int}</span>
      <span className="text-left font-normal">
        <Fraction frac={frac} zeros={zeros} />
      </span>
    </span>
  );
}

// ── Percent ──────────────────────────────────────────────────────────────

interface PercentProps {
  value: number | null | undefined;
  decimals?: number;
  /** Colour. Defaults to the value's direction (deltaTone); pass 'neutral' for an uncoloured percentage. */
  tone?: Tone;
  className?: string;
}

/** Signed percentage: +3.86% / −2.59%. The % sign steps back. */
export function Percent({ value, decimals = 2, tone, className }: PercentProps) {
  if (value == null) return <Dash />;
  const t = tone ?? deltaTone(value);
  return (
    <span className={cn('num', t === 'neutral' ? 'text-fg-muted' : toneText[t], className)}>
      {signOf(value)}
      {Math.abs(value).toFixed(decimals)}
      <span className="num-dim-tone">%</span>
    </span>
  );
}

/** A price change — a Percent coloured by direction. The only place red/green appear. */
export function Delta(props: Omit<PercentProps, 'tone'>) {
  return <Percent {...props} />;
}

// ── Money ────────────────────────────────────────────────────────────────

interface MoneyProps {
  /** Dollar amount */
  value: number | null | undefined;
  decimals?: number;
  /** Show + on gains and colour by direction (PnL) */
  signed?: boolean;
  className?: string;
}

/** Compact dollar amount: $239.85B. The $ and the unit step back. */
export function Money({ value, decimals = 2, signed = false, className }: MoneyProps) {
  const parts = moneyParts(value, decimals);
  if (!parts) return <Dash />;
  const tone = signed ? deltaTone(value) : 'neutral';
  const dim = tone === 'neutral' ? 'num-dim' : 'num-dim-tone';
  const negative = parts.value.startsWith('−');
  return (
    <span className={cn('num', toneText[tone], className)}>
      {signed && value! > 0 && '+'}
      {negative && '−'}
      <span className={dim}>$</span>
      {negative ? parts.value.slice(1) : parts.value}
      {parts.unit && <span className={dim}>{parts.unit}</span>}
    </span>
  );
}

// ── Plain figure ─────────────────────────────────────────────────────────

/** Any other figure (counts, ranks, ratios): tabular, optionally toned. */
export function Figure({ children, tone = 'neutral', className }: { children: React.ReactNode; tone?: Tone; className?: string }) {
  return <span className={cn('num', toneText[tone], className)}>{children}</span>;
}
