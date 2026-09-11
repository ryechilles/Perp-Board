'use client';

import { ReactNode } from 'react';

interface TooltipContentProps {
  /** Array of tooltip items - can be strings or JSX with colored spans */
  items: ReactNode[];
}

/**
 * TooltipContent - Standard tooltip content template
 *
 * Use this inside SmallWidget's tooltip prop for consistent formatting.
 * Each item automatically gets a bullet point prefix.
 *
 * @example
 * ```tsx
 * <SmallWidget
 *   tooltip={
 *     <TooltipContent items={[
 *       "Simple text explanation",
 *       "Another point here",
 *       <><span className="text-down-ink">Keyword</span>: with explanation</>,
 *     ]} />
 *   }
 * >
 * ```
 */
export function TooltipList({ items }: TooltipContentProps) {
  return (
    <div className="space-y-1">
      {items.map((item, i) => (
        <div key={i}>• {item}</div>
      ))}
    </div>
  );
}
