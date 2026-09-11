'use client';

import { cn, getRsiTextClass } from '@/lib/utils';

// ===========================================
// RSI
// ===========================================

/**
 * RsiMeter — compact 0–100 track on the cold→hot zone scale with a marker
 * at the reading. Same zones as the Market RSI gauge, so a row reads at a glance.
 */
export function RsiMeter({ value, className }: { value: number; className?: string }) {
  const left = Math.min(Math.max(value, 0), 100);
  return (
    <span className={cn('relative inline-block w-[52px] h-1 rounded-full rsi-track', className)} aria-hidden="true">
      <span
        className="absolute top-1/2 w-2.5 h-2.5 -mt-[5px] -ml-[5px] rounded-full bg-card shadow-[0_0_0_1.5px_hsl(var(--foreground)),0_1px_3px_rgb(0_0_0/0.2)]"
        style={{ left: `${left}%` }}
      />
    </span>
  );
}

/** RSI number (zone-colored) followed by its meter. Renders a dash when missing. */
export function RsiReading({ value, title }: { value: number | null | undefined; title?: string }) {
  if (value == null) return <span className="text-faint">—</span>;
  return (
    <span className="inline-flex items-center gap-2.5" title={title}>
      <span className={cn('min-w-[22px] text-right text-[0.78rem] font-semibold tabular-nums', getRsiTextClass(value))}>
        {value.toFixed(0)}
      </span>
      <RsiMeter value={value} />
    </span>
  );
}

// ===========================================
// Price change
// ===========================================

export function formatSignedPercent(value: number, decimals = 2): string {
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${Math.abs(value).toFixed(decimals)}%`;
}

/** Tinted change pill (Stocks-style). */
export function ChangePill({ change, className }: { change: number | null | undefined; className?: string }) {
  if (change == null) return <span className="text-faint">—</span>;
  const up = change >= 0;
  return (
    <span
      className={cn(
        'inline-flex items-center justify-end min-w-[66px] h-6 px-2 rounded-md text-[0.78rem] font-semibold tabular-nums',
        up ? 'bg-up/[0.14] text-up-ink' : 'bg-down/[0.11] text-down-ink',
        className
      )}
    >
      {formatSignedPercent(change)}
    </span>
  );
}

// ===========================================
// Zone gauge (hero widgets)
// ===========================================

export interface ZoneSegment {
  /** Relative width of the segment */
  flex: number;
  /** Background class */
  className: string;
}

interface ZoneGaugeProps {
  segments: ZoneSegment[];
  /** Marker position, 0–100 (% of the track) */
  position: number | null;
  /** Scale labels at % positions along the track */
  ticks?: { at: number; label: string }[];
  /** Accessible description of the reading */
  label?: string;
}

/**
 * ZoneGauge — segmented zone track with a floating marker and a labeled scale.
 * Labels are placed on the same % scale as the segments.
 */
export function ZoneGauge({ segments, position, ticks, label }: ZoneGaugeProps) {
  return (
    <div role={label ? 'img' : undefined} aria-label={label}>
      <div className="relative">
        <div className="flex gap-0.5 h-2" aria-hidden="true">
          {segments.map((seg, i) => (
            <span
              key={i}
              className={cn(
                'rounded-[2px]',
                i === 0 && 'rounded-l-full',
                i === segments.length - 1 && 'rounded-r-full',
                seg.className
              )}
              style={{ flex: seg.flex }}
            />
          ))}
        </div>
        {position != null && (
          <span
            className="absolute top-1/2 w-4 h-4 -mt-2 -ml-2 rounded-full bg-card grid place-items-center shadow-[0_0_0_0.5px_rgb(0_0_0/0.08),0_2px_6px_rgb(0_0_0/0.22)] transition-[left] duration-500"
            style={{ left: `${Math.min(Math.max(position, 0), 100)}%` }}
            aria-hidden="true"
          >
            <span className="w-2 h-2 rounded-full bg-foreground" />
          </span>
        )}
      </div>
      {ticks && (
        <div className="relative h-4 mt-2 text-[0.6875rem] text-faint tabular-nums" aria-hidden="true">
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
