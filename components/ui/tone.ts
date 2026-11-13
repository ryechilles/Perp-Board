import type { Tone } from '@/lib/format';

/**
 * The only place a Tone becomes a colour. Class names are written out in full
 * so Tailwind can see them.
 */

/** Text colour. Neutral adds nothing — the element keeps its own colour. */
export const toneText: Record<Tone, string> = {
  neutral: '',
  up: 'text-up',
  down: 'text-down',
  cold: 'text-cold',
  hot: 'text-hot',
};

/** Tinted surface + matching text (tags). */
export const toneSoft: Record<Tone, string> = {
  neutral: 'bg-fill text-fg-muted',
  up: 'bg-up/10 text-up',
  down: 'bg-down/10 text-down',
  cold: 'bg-cold/10 text-cold',
  hot: 'bg-hot/10 text-hot',
};

/** Solid surface with knocked-out text (the strongest tag). */
export const toneSolid: Record<Tone, string> = {
  neutral: 'bg-fg-muted text-surface-1',
  up: 'bg-up text-surface-1',
  down: 'bg-down text-surface-1',
  cold: 'bg-cold text-surface-1',
  hot: 'bg-hot text-surface-1',
};

/** Solid fill (dots, meter markers, bars). */
export const toneFill: Record<Tone, string> = {
  neutral: 'bg-fg-muted',
  up: 'bg-up',
  down: 'bg-down',
  cold: 'bg-cold',
  hot: 'bg-hot',
};

/** Faded fill (gauge zones). */
export const toneFillSoft: Record<Tone, string> = {
  neutral: 'bg-track',
  up: 'bg-up/40',
  down: 'bg-down/40',
  cold: 'bg-cold/40',
  hot: 'bg-hot/40',
};
