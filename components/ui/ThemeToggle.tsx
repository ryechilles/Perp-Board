'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('theme');
    if (saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      setIsDark(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggle = () => {
    const next = !isDark;
    setIsDark(next);
    const el = document.documentElement;
    el.classList.toggle('dark', next);
    el.style.colorScheme = next ? 'dark' : 'light';
    localStorage.setItem('theme', next ? 'dark' : 'light');
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', next ? '#000000' : '#f2f2f4');
  };

  const cls =
    'w-8 h-8 rounded-[9px] grid place-items-center text-muted-foreground transition-colors hover:bg-fill hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40';

  if (!mounted) {
    // Render invisible placeholder to prevent layout shift
    return <span className={`${cls} invisible`} aria-hidden="true" />;
  }

  return (
    <button type="button" className={cls} onClick={toggle} aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}>
      {isDark ? <Sun className="w-[17px] h-[17px]" /> : <Moon className="w-[17px] h-[17px]" />}
    </button>
  );
}
