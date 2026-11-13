import { ReactNode } from 'react';
import type { Tone } from '@/lib/format';
import { cn } from '@/lib/utils';
import { toneSoft, toneSolid } from './tone';

interface TagProps {
  children: ReactNode;
  tone?: Tone;
  /** Solid fill instead of a tint — reserve for the rare strongest state */
  solid?: boolean;
  title?: string;
  className?: string;
}

/** A short state label: Weak, B9, Oversold. */
export function Tag({ children, tone = 'neutral', solid = false, title, className }: TagProps) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex h-tag items-center whitespace-nowrap rounded-tag px-1.5 text-caption font-semibold',
        solid ? toneSolid[tone] : toneSoft[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

/** Keyboard shortcut hint. */
export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-tag items-center rounded-tag px-1 font-sans text-caption font-medium text-fg-muted shadow-edge">
      {children}
    </kbd>
  );
}
