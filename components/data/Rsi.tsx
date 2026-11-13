import type { Tone } from '@/lib/format';
import { rsiTone } from '@/lib/format';
import { RSI } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { toneFill, toneFillSoft, toneText } from '@/components/ui';

const clamp = (v: number) => Math.min(Math.max(v, 0), 100);

/**
 * Meter — a neutral 0–100 track with one dot at the reading. The dot takes the
 * reading's tone, so in a column of meters only the extremes carry colour.
 */
export function Meter({ value, tone = 'neutral', className }: { value: number; tone?: Tone; className?: string }) {
  return (
    <span className={cn('relative block h-[3px] w-12 flex-shrink-0 rounded-full bg-track', className)} aria-hidden="true">
      <span
        className={cn('absolute top-1/2 size-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-surface-1', toneFill[tone])}
        style={{ left: `${clamp(value)}%` }}
      />
    </span>
  );
}

interface RsiReadingProps {
  value: number | null | undefined;
  /** Decimal places for the number */
  decimals?: number;
  /** Show the meter next to the number */
  meter?: boolean;
  title?: string;
}

/** RSI number + meter. Neutral in the middle, cold at ≤25, hot at ≥75. */
export function RsiReading({ value, decimals = 0, meter = true, title }: RsiReadingProps) {
  if (value == null) return <span className="text-fg-faint">—</span>;
  const tone = rsiTone(value);
  return (
    <span className="inline-flex items-center gap-2" title={title}>
      <span className={cn('num min-w-5 text-right', tone === 'neutral' ? 'text-fg' : cn('font-medium', toneText[tone]))}>
        {value.toFixed(decimals)}
      </span>
      {meter && <Meter value={value} tone={tone} />}
    </span>
  );
}

// ── Gauge (hero readouts) ────────────────────────────────────────────────

export interface GaugeZone {
  /** Share of the track, in the same units as the others (they are normalised) */
  width: number;
  tone: Tone;
  /** Full-strength fill instead of the faded one */
  strong?: boolean;
}

interface GaugeProps {
  /** Marker position, 0–100 (% of the track). null hides the marker. */
  position: number | null;
  /** Zones along the track. Omit for a plain neutral track. */
  zones?: readonly GaugeZone[];
  /** Scale labels at % positions */
  ticks?: { at: number; label: string }[];
  /** Tone of the marker */
  tone?: Tone;
  /** Accessible description of the reading */
  label?: string;
}

/** Wide track with a marker and a labelled scale, for a panel's headline figure. */
export function Gauge({ position, zones, ticks, tone = 'neutral', label }: GaugeProps) {
  return (
    <div role={label ? 'img' : undefined} aria-label={label}>
      <div className="relative">
        <div className="flex h-1 gap-px overflow-hidden rounded-full" aria-hidden="true">
          {zones ? (
            zones.map((z, i) => (
              <span key={i} className={z.tone === 'neutral' ? 'bg-track' : z.strong ? toneFill[z.tone] : toneFillSoft[z.tone]} style={{ flex: z.width }} />
            ))
          ) : (
            <span className="flex-1 bg-track" />
          )}
        </div>
        {position != null && (
          <span
            className={cn(
              'absolute top-1/2 size-[11px] -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-surface-2 transition-[left] duration-500',
              tone === 'neutral' ? 'bg-fg' : toneFill[tone]
            )}
            style={{ left: `${clamp(position)}%` }}
            aria-hidden="true"
          />
        )}
      </div>
      {ticks && (
        <div className="num relative mt-1.5 h-4 text-caption text-fg-faint" aria-hidden="true">
          {ticks.map((t, i) => (
            <span
              key={t.at}
              className="absolute"
              style={{
                left: `${t.at}%`,
                transform: i === 0 ? 'none' : i === ticks.length - 1 ? 'translateX(-100%)' : 'translateX(-50%)',
              }}
            >
              {t.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** RSI zones for a Gauge: a cold end, a hot end, neutral between. */
export const RSI_GAUGE_ZONES: GaugeZone[] = [
  { width: RSI.TONE_COLD, tone: 'cold' },
  { width: RSI.TONE_HOT - RSI.TONE_COLD, tone: 'neutral' },
  { width: 100 - RSI.TONE_HOT, tone: 'hot' },
];
export const RSI_GAUGE_TICKS = [0, RSI.TONE_COLD, 50, RSI.TONE_HOT, 100].map((v) => ({ at: v, label: String(v) }));
