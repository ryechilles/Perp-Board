'use client';

import { APP_CONFIG } from '@/lib/config';
import { HyperliquidLogo, OkxLogo, XLogo } from './logos';

// Exchange-specific referral link
const REFERRAL = {
  okx: { href: APP_CONFIG.links.okx, title: 'OKX', Logo: OkxLogo },
  hyperliquid: { href: '#', title: 'Hyperliquid', Logo: HyperliquidLogo }, // TODO: Hyperliquid referral link
} as const;

const linkClass =
  'focus-ring grid size-control-md place-items-center rounded-control text-fg-faint transition-colors hover:bg-fill hover:text-fg';

/** Footnote row: copyright + referral / social links (sits under the sidebar). */
export function Footer({ exchange = 'okx', className = '' }: { exchange?: 'okx' | 'hyperliquid'; className?: string }) {
  const { href, title, Logo } = REFERRAL[exchange];

  return (
    <footer className={`flex items-center justify-between ${className}`}>
      <span className="text-caption text-fg-faint">© {new Date().getFullYear()} Perp Board</span>
      <div className="flex items-center gap-0.5">
        <a href={href} target="_blank" rel="noopener noreferrer" className={linkClass} title={title} aria-label={title}>
          <Logo className="size-3.5" />
        </a>
        <a href={APP_CONFIG.links.twitter} target="_blank" rel="noopener noreferrer" className={linkClass} title="X (Twitter)" aria-label="X (Twitter)">
          <XLogo className="size-3.5" />
        </a>
      </div>
    </footer>
  );
}
