/** @type {import('tailwindcss').Config} */

// The design tokens. Values live in app/globals.css as CSS variables; this file
// only gives them Tailwind names. Scales are REPLACED, not extended, so a class
// outside the system (text-sm, rounded-lg, bg-red-500…) generates nothing — and
// ESLint flags it (see eslint.config.mjs). Documented in DESIGN.md.
const rgb = (name) => `rgb(var(--${name}) / <alpha-value>)`;

module.exports = {
  darkMode: ['class'],
  content: [
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
  ],
  theme: {
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      inherit: 'inherit',
      white: '#fff',
      black: '#000',
      // Surfaces
      surface: {
        0: rgb('surface-0'), // page ground, app bar
        1: rgb('surface-1'), // panels, table
        2: rgb('surface-2'), // sidebar
        pop: rgb('surface-pop'), // tooltips, drawer
      },
      fill: {
        DEFAULT: 'var(--fill)', // control fill, hover wash
        strong: 'var(--fill-strong)',
      },
      // Text
      fg: {
        DEFAULT: rgb('fg'),
        muted: rgb('fg-muted'),
        faint: rgb('fg-faint'),
      },
      // Lines
      line: {
        DEFAULT: 'var(--line)',
        strong: 'var(--line-strong)',
      },
      // Accent — selected / live / focus. Nothing else.
      accent: {
        DEFAULT: rgb('accent'),
        soft: 'var(--accent-soft)',
      },
      'on-accent': rgb('on-accent'),
      // Data — up/down for price direction, cold/hot for RSI extremes.
      up: rgb('up'),
      down: rgb('down'),
      cold: rgb('cold'),
      hot: rgb('hot'),
      track: rgb('track'),
      star: rgb('star'),
    },
    fontFamily: {
      sans: ['var(--font-sans)', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
    },
    fontSize: {
      caption: ['0.6875rem', { lineHeight: '1rem' }],       // 11 — caps labels, tags, ticks
      small: ['0.75rem', { lineHeight: '1rem' }],           // 12 — secondary text
      body: ['0.8125rem', { lineHeight: '1.125rem' }],      // 13 — default
      title: ['0.9375rem', { lineHeight: '1.25rem', letterSpacing: '-0.01em' }], // 15 — stat values, headings
      display: ['1.875rem', { lineHeight: '2rem', letterSpacing: '-0.03em' }],   // 30 — hero numbers
    },
    fontWeight: {
      normal: '400',
      medium: '500',
      semibold: '600',
    },
    borderRadius: {
      none: '0',
      tag: '4px',
      control: '6px',
      panel: '10px',
      full: '9999px',
    },
    boxShadow: {
      none: 'none',
      seg: 'var(--shadow-seg)',                               // selected segment
      edge: 'inset 0 0 0 1px var(--line-strong)',             // control outline
      'edge-accent': 'inset 0 0 0 1px rgb(var(--accent))',    // selected chip
      'tab-accent': 'inset 0 -2px 0 rgb(var(--accent))',      // active tab underline
      focus: '0 0 0 2px rgb(var(--accent))',                  // focused field
      pop: 'var(--shadow-pop)',
      drawer: 'var(--shadow-drawer)',
    },
    extend: {
      spacing: {
        'control-sm': '1.5rem',  // 24
        'control-md': '1.75rem', // 28
        'control-lg': '2rem',    // 32
        row: '2.25rem',          // 36
        tag: '1.125rem',         // 18
        sidebar: '19rem',        // 304
        drawer: '27.5rem',       // 440
      },
      zIndex: {
        sticky: '20',   // table header
        'sticky-2': '30', // header cells of pinned columns
        bar: '70',      // app bar
        overlay: '100', // drawer scrim
        drawer: '101',
        tip: '300',
      },
      keyframes: {
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
      animation: {
        shimmer: 'shimmer 1.5s infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
