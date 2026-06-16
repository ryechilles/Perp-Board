'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

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

/** Symbol-keyed CDN fallback (loads browser-side; covers many majors). */
function coinCapLogo(symbol: string): string {
  return `https://assets.coincap.io/assets/icons/${symbol.toLowerCase()}@2x.png`;
}

/**
 * TokenAvatar — token logo with a layered fallback chain.
 *
 * Stage 0: the provided `logo` (CoinLore / cached). Stage 1: a symbol-keyed CDN
 * (CoinCap). Stage 2: a letter avatar. Each <img> onError advances one stage,
 * so a 404 at any source degrades gracefully without a broken-image icon.
 * Images load from the browser (the user's IP), so the server-side IP block
 * that affects the market-data API does not affect logos.
 */
export function TokenAvatar({ symbol, logo, size = 'md', className }: TokenAvatarProps) {
  // 0 = primary logo, 1 = symbol CDN, 2 = letter avatar
  const [stage, setStage] = useState<0 | 1 | 2>(logo ? 0 : symbol ? 1 : 2);

  // Reset when inputs change (e.g. market-cap data arrives after first paint).
  useEffect(() => {
    setStage(logo ? 0 : symbol ? 1 : 2);
  }, [logo, symbol]);

  const src = stage === 0 ? logo : stage === 1 ? coinCapLogo(symbol) : null;

  if (src) {
    return (
      <img
        src={src}
        alt={symbol}
        loading="lazy"
        className={cn('rounded-full bg-muted', sizeClasses[size], className)}
        onError={() => setStage((s) => (s < 2 ? ((s + 1) as 0 | 1 | 2) : 2))}
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
