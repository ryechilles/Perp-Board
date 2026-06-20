'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { Button } from './button';

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
      ?.setAttribute('content', next ? '#0a0a0a' : '#fafafa');
  };

  if (!mounted) {
    // Render invisible placeholder to prevent layout shift
    return <Button variant="secondary" size="sm" aria-label="Toggle dark mode" className="invisible"><Moon className="w-4 h-4" /></Button>;
  }

  return (
    <Button variant="secondary" size="sm" onClick={toggle} aria-label="Toggle dark mode">
      {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </Button>
  );
}
