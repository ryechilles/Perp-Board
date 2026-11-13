'use client';

import { ReactNode, useState } from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';

export const TooltipProvider = TooltipPrimitive.Provider;

interface TipProps {
  /** Tooltip body. Nothing is rendered around the child when this is empty. */
  content: ReactNode;
  children: ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  /** Controlled open state (InfoTip uses it to open on click as well as hover) */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/**
 * The one tooltip. Wrap any focusable element; it opens on hover and keyboard
 * focus, renders in a portal (never clipped by a scroll container) and flips to
 * stay on screen.
 */
export function Tip({ content, children, side = 'bottom', align = 'start', open, onOpenChange }: TipProps) {
  if (!content) return <>{children}</>;
  return (
    <TooltipPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          align={align}
          sideOffset={6}
          collisionPadding={8}
          className="z-tip max-w-72 rounded-control bg-surface-pop px-2.5 py-2 text-small text-fg-muted shadow-pop animate-in fade-in-0 zoom-in-95"
        >
          {content}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

/** Standard tooltip body: a title line and/or a list of points. */
export function TipBody({ title, items }: { title?: ReactNode; items?: ReactNode[] }) {
  return (
    <div className="flex flex-col gap-1">
      {title && <div className="font-medium text-fg">{title}</div>}
      {items?.map((item, i) => (
        <div key={i}>{item}</div>
      ))}
    </div>
  );
}

interface InfoTipProps {
  /** What the ⓘ explains — used for the accessible name ("About Market RSI") */
  label: string;
  content: ReactNode;
  align?: 'start' | 'center' | 'end';
  className?: string;
}

/** ⓘ button that explains a column or a panel. Hover, focus or click. */
export function InfoTip({ label, content, align = 'end', className }: InfoTipProps) {
  const [open, setOpen] = useState(false);
  return (
    <Tip content={content} align={align} open={open} onOpenChange={setOpen}>
      <button
        type="button"
        aria-label={`About ${label}`}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        onKeyDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        className={cn(
          'focus-ring inline-grid size-4 flex-shrink-0 place-items-center rounded-tag text-fg-faint transition-colors hover:text-fg-muted',
          className
        )}
      >
        <Info className="size-3.5" aria-hidden="true" />
      </button>
    </Tip>
  );
}
