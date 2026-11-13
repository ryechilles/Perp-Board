'use client';

import { useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Kbd } from './Tag';

interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Focus the field on ⌘K / Ctrl+K */
  shortcut?: boolean;
  className?: string;
}

/** Filled search field with a ⌘K hint and a clear button. */
export function SearchField({ value, onChange, placeholder = 'Search tokens', shortcut = false, className }: SearchFieldProps) {
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
        'flex h-control-md cursor-text items-center gap-2 rounded-control bg-fill px-2 text-fg-muted transition-shadow',
        'focus-within:shadow-focus',
        className
      )}
    >
      <Search className="size-3.5 flex-shrink-0" aria-hidden="true" />
      <input
        ref={inputRef}
        type="text"
        name="search"
        inputMode="search"
        enterKeyHint="search"
        autoComplete="off"
        spellCheck={false}
        placeholder={placeholder}
        aria-label={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && value) {
            e.preventDefault();
            onChange('');
          }
        }}
        className="min-w-0 flex-1 border-none bg-transparent text-body text-fg outline-none placeholder:text-fg-faint"
      />
      {value ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            onChange('');
            inputRef.current?.focus();
          }}
          className="focus-ring grid size-4 place-items-center rounded-full bg-fill-strong text-fg-muted hover:text-fg"
        >
          <X className="size-2.5" strokeWidth={3} aria-hidden="true" />
        </button>
      ) : (
        shortcut && <Kbd>⌘K</Kbd>
      )}
    </label>
  );
}
