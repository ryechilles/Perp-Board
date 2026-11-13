'use client';

import { memo, ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { APP_CONFIG } from '@/lib/config';
import { Segmented, ThemeToggle } from '@/components/ui';
import { HyperliquidLogo, OkxLogo, PerpLogo } from './logos';

const EXCHANGES = [
  { id: 'okx', label: 'OKX', href: '/okx', Logo: OkxLogo },
  { id: 'hyperliquid', label: 'Hyperliquid', href: '/hyperliquid', Logo: HyperliquidLogo },
] as const;

type ExchangeId = (typeof EXCHANGES)[number]['id'];

interface AppBarProps {
  /** Connection status, shown beside the exchange switch from lg up */
  status?: ReactNode;
  /** Right-side content (the search field), from md up */
  actions?: ReactNode;
}

/** App bar: brand, exchange switch and status on the left; search and theme on the right. */
export const AppBar = memo(function AppBar({ status, actions }: AppBarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const active: ExchangeId = EXCHANGES.find((e) => pathname === e.href || pathname.startsWith(e.href + '/'))?.id ?? 'okx';

  return (
    <header className="px-safe flex h-11 flex-shrink-0 items-center gap-3.5">
      <div className="flex min-w-0 items-center gap-2" title={APP_CONFIG.versionDisplay}>
        <PerpLogo className="size-5 flex-shrink-0 rounded-tag" />
        <span className="sr-only font-semibold sm:not-sr-only" translate="no">{APP_CONFIG.name}</span>
      </div>

      <nav aria-label="Exchange">
        <Segmented
          options={EXCHANGES.map(({ id, label, Logo }) => ({ value: id, label, icon: <Logo className="size-3.5" /> }))}
          value={active}
          onChange={(id) => {
            const next = EXCHANGES.find((e) => e.id === id);
            if (next && next.id !== active) router.push(next.href);
          }}
        />
      </nav>

      {status && <div className="hidden min-w-0 lg:block">{status}</div>}

      <div className="ml-auto flex items-center gap-1.5">
        {actions && <div className="hidden md:block">{actions}</div>}
        <ThemeToggle />
      </div>
    </header>
  );
});
