/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Apple system semantics (see globals.css → Palette)
        tint: "hsl(var(--tint) / <alpha-value>)",
        segment: "hsl(var(--segment))",
        fill: {
          DEFAULT: "hsl(var(--fill))",
          strong: "hsl(var(--fill-strong))",
        },
        separator: "hsl(var(--separator))",
        faint: "hsl(var(--faint) / <alpha-value>)",
        star: "hsl(var(--star) / <alpha-value>)",
        up: {
          DEFAULT: "hsl(var(--up) / <alpha-value>)",
          ink: "hsl(var(--up-ink) / <alpha-value>)",
        },
        down: {
          DEFAULT: "hsl(var(--down) / <alpha-value>)",
          ink: "hsl(var(--down-ink) / <alpha-value>)",
        },
        cold: {
          DEFAULT: "hsl(var(--cold) / <alpha-value>)",
          soft: "hsl(var(--cold-soft) / <alpha-value>)",
          ink: "hsl(var(--cold-ink) / <alpha-value>)",
        },
        hot: {
          DEFAULT: "hsl(var(--hot) / <alpha-value>)",
          soft: "hsl(var(--hot-soft) / <alpha-value>)",
          ink: "hsl(var(--hot-ink) / <alpha-value>)",
        },
        "zone-neutral": "hsl(var(--zone-neutral) / <alpha-value>)",
      },
      borderRadius: {
        card: "14px",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      height: {
        'control-compact': 'var(--control-compact)',     /* 28px */
        'control-default': 'var(--control-default)',     /* 32px */
        'control-prominent': 'var(--control-prominent)', /* 36px */
      },
      minWidth: {
        'control-compact': 'var(--control-compact)',
        'control-default': 'var(--control-default)',
        'control-prominent': 'var(--control-prominent)',
      },
      spacing: {
        'widget-header-py': 'var(--widget-header-py)',
        'widget-header-px-sm': 'var(--widget-header-px-sm)',
        'widget-header-px-lg': 'var(--widget-header-px-lg)',
        'widget-content-sm': 'var(--widget-content-sm)',
        'widget-content-lg': 'var(--widget-content-lg)',
      },
      gap: {
        'tight': 'var(--gap-tight)',
        'control': 'var(--gap-default)',
        'section': 'var(--gap-loose)',
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "shimmer": {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "shimmer": "shimmer 1.5s infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
