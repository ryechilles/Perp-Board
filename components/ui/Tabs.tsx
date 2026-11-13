'use client';

import { cn } from '@/lib/utils';

export interface TabItem {
  id: string;
  label: string;
}

interface TabsProps {
  tabs: TabItem[];
  value: string;
  onChange: (id: string) => void;
  /** Accessible name for the tab list */
  label?: string;
  className?: string;
}

/** Underline tabs — pages inside a region (the Insights sidebar). */
export function Tabs({ tabs, value, onChange, label, className }: TabsProps) {
  return (
    <div role="tablist" aria-label={label} className={cn('flex items-stretch gap-4 overflow-x-auto rule-b', className)}>
      {tabs.map((tab) => {
        const active = tab.id === value;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={cn(
              'focus-ring-inset h-row flex-shrink-0 whitespace-nowrap font-medium outline-none transition-colors',
              active ? 'text-fg shadow-tab-accent' : 'text-fg-muted hover:text-fg'
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
