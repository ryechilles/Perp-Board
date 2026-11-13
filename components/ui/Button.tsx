'use client';

import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'solid' | 'outline' | 'ghost' | 'bare';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * solid — the one primary action · outline — standard · ghost — low emphasis ·
   * bare — no chrome at all: a focus ring and nothing else, for custom hit areas
   * (stat blocks, list rows). Lay a bare button out with className.
   */
  variant?: Variant;
  size?: Size;
}

const base =
  'focus-ring inline-flex items-center justify-center gap-1.5 whitespace-nowrap font-medium rounded-control ' +
  'transition-colors disabled:pointer-events-none disabled:opacity-50';

const variants: Record<Exclude<Variant, 'bare'>, string> = {
  solid: 'bg-fg text-surface-1 hover:bg-fg/85',
  outline: 'text-fg shadow-edge hover:bg-fill',
  ghost: 'text-fg-muted hover:bg-fill hover:text-fg',
};

const sizes: Record<Size, string> = {
  sm: 'h-control-sm px-2 text-small',
  md: 'h-control-md px-2.5 text-body',
  lg: 'h-control-lg px-3 text-body',
};

/** The button. Every clickable action in the app is one of these (or an IconButton). */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'outline', size = 'md', className, type = 'button', ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={
        variant === 'bare'
          ? cn('focus-ring disabled:pointer-events-none', className)
          : cn(base, variants[variant], sizes[size], className)
      }
      {...props}
    />
  );
});

export interface IconButtonProps extends Omit<ButtonProps, 'aria-label' | 'variant'> {
  /** Accessible name — required, an icon alone says nothing to a screen reader */
  label: string;
  variant?: 'outline' | 'ghost';
}

const iconSizes: Record<Size, string> = {
  sm: 'size-control-sm',
  md: 'size-control-md',
  lg: 'size-control-lg',
};

/** Square, icon-only button. Pass the icon as children (size it with size-3.5 / size-4). */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, variant = 'ghost', size = 'md', className, type = 'button', ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      className={cn(base, variants[variant], iconSizes[size], 'px-0', className)}
      {...props}
    />
  );
});
