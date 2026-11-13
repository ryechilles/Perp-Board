'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { THEME_COLOR } from '@/lib/config';
import { IconButton } from './Button';


export function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setIsDark(document.documentElement.classList.contains('dark'));
  }, []);

  const toggle = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', next ? THEME_COLOR.dark : THEME_COLOR.light);
  };

  // Same box before hydration, so the bar does not shift
  if (!mounted) return <span className="size-control-md" aria-hidden="true" />;

  return (
    <IconButton label={isDark ? 'Switch to light mode' : 'Switch to dark mode'} onClick={toggle}>
      {isDark ? <Sun className="size-4" aria-hidden="true" /> : <Moon className="size-4" aria-hidden="true" />}
    </IconButton>
  );
}
