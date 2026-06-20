'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { STOCK_SYMBOLS } from '@/lib/constants';

interface TokenAvatarProps {
  /** Token symbol (used for alt text, the CDN fallback, and the letter fallback) */
  symbol: string;
  /** Primary logo URL (e.g. CoinLore / cached). Optional. */
  logo?: string;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Additional CSS classes */
  className?: string;
}

const sizeClasses = {
  sm: 'w-4 h-4 text-[8px]',
  md: 'w-5 h-5 text-[9px]',
  lg: 'w-6 h-6 text-[10px]',
};

// Intrinsic pixel size per variant — set as width/height attrs to prevent CLS
const sizePx = {
  sm: 16,
  md: 20,
  lg: 24,
};

/** Crypto logo CDN, keyed by symbol (loads browser-side; covers many majors). */
function coinCapLogo(symbol: string): string {
  return `https://assets.coincap.io/assets/icons/${symbol.toLowerCase()}@2x.png`;
}

/** Equity logo CDN, keyed by ticker (Parqet). Covers US stocks + major ETFs. */
function stockLogo(symbol: string): string {
  return `https://assets.parqet.com/logos/symbol/${symbol.toUpperCase()}?format=png`;
}

/**
 * Ordered list of logo URLs to try, best source first. The token's asset class
 * picks the symbol-keyed CDN: equities (STOCK_SYMBOLS) use Parqet, everything
 * else uses CoinCap. A provided `logo` (CoinLore / cached) always takes priority.
 */
function logoSources(symbol: string, logo?: string): string[] {
  const sources: string[] = [];
  if (logo) sources.push(logo);
  if (symbol) {
    sources.push(
      STOCK_SYMBOLS.has(symbol.toUpperCase()) ? stockLogo(symbol) : coinCapLogo(symbol)
    );
  }
  return sources;
}

/**
 * TokenAvatar — token logo with a layered fallback chain.
 *
 * Tries each source from `logoSources` in order; an <img> onError advances to
 * the next, and once exhausted it renders a letter avatar — so a 404 at any
 * source degrades gracefully without a broken-image icon. Images load from the
 * browser (the user's IP), so the server-side IP block that affects the
 * market-data API does not affect logos.
 */
export function TokenAvatar({ symbol, logo, size = 'md', className }: TokenAvatarProps) {
  const sources = logoSources(symbol, logo);
  const [idx, setIdx] = useState(0);

  // Reset when inputs change (e.g. market-cap data arrives after first paint).
  useEffect(() => {
    setIdx(0);
  }, [logo, symbol]);

  const src = idx < sources.length ? sources[idx] : null;

  if (src) {
    return (
      <img
        src={src}
        alt={symbol}
        width={sizePx[size]}
        height={sizePx[size]}
        loading="lazy"
        className={cn('rounded-full bg-muted', sizeClasses[size], className)}
        onError={() => setIdx((i) => i + 1)}
      />
    );
  }

  return (
    <div
      className={cn(
        'rounded-full bg-muted flex items-center justify-center text-muted-foreground font-medium',
        sizeClasses[size],
        className
      )}
    >
      {symbol.charAt(0)}
    </div>
  );
}

export default TokenAvatar;
