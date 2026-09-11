'use client';

import { useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  /** Focus the field on ⌘K / Ctrl+K */
  shortcut?: boolean;
}

/** macOS-style search field: filled, rounded, with a ⌘K hint and a clear button. */
export function SearchField({ value, onChange, className, shortcut = false }: SearchFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!shortcut) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shortcut]);

  return (
    <label
      className={cn(
        'flex items-center gap-1.5 h-8 pl-2.5 pr-2 rounded-[9px] bg-fill text-muted-foreground cursor-text',
        'focus-within:ring-[3px] focus-within:ring-ring/40 transition-shadow',
        className
      )}
    >
      <Search className="w-[15px] h-[15px] flex-shrink-0" aria-hidden="true" />
      <input
        ref={inputRef}
        type="text"
        name="search"
        inputMode="search"
        enterKeyHint="search"
        autoComplete="off"
        spellCheck={false}
        placeholder="Search tokens"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && value) {
            e.preventDefault();
            onChange('');
          }
        }}
        className="flex-1 min-w-0 bg-transparent border-none outline-none text-[0.8125rem] text-foreground placeholder:text-muted-foreground"
        aria-label="Search tokens"
      />
      {value ? (
        <button
          type="button"
          onClick={() => {
            onChange('');
            inputRef.current?.focus();
          }}
          className="w-4 h-4 rounded-full bg-faint/70 text-card grid place-items-center hover:bg-faint"
          aria-label="Clear search"
        >
          <X className="w-2.5 h-2.5" strokeWidth={3} aria-hidden="true" />
        </button>
      ) : (
        shortcut && (
          <kbd className="hidden md:inline-block font-sans text-[0.6875rem] leading-4 text-faint border border-separator rounded-[5px] px-1.5 bg-card">
            ⌘K
          </kbd>
        )
      )}
    </label>
  );
}
