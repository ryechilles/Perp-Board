'use client';

import { memo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { APP_CONFIG } from '@/lib/config';
import { ThemeToggle } from '@/components/ui';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

// P Logo SVG Component - matches the new flat minimal logo design
function PerpLogo({ className = "w-7 h-7" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
      {/* Background: 3x3 grid of green squares */}
      <g id="background">
        <rect x="0" y="0" width="341.333" height="341.333" fill="#a8f0cb"/>
        <rect x="341.333" y="0" width="341.333" height="341.333" fill="#47da93"/>
        <rect x="682.667" y="0" width="341.333" height="341.333" fill="#7beab5"/>
        <rect x="0" y="341.333" width="341.333" height="341.333" fill="#38bd7b"/>
        <rect x="341.333" y="341.333" width="341.333" height="341.333" fill="#4bcd8c"/>
        <rect x="682.667" y="341.333" width="341.333" height="341.333" fill="#98edc3"/>
        <rect x="0" y="682.667" width="341.333" height="341.333" fill="#22915c"/>
        <rect x="341.333" y="682.667" width="341.333" height="341.333" fill="#32b775"/>
        <rect x="682.667" y="682.667" width="341.333" height="341.333" fill="#4ada94"/>
      </g>
      {/* Letter P: Geometric flat design */}
      <g id="letter" fill="#ffffff" fillRule="evenodd">
        <path d="
          M 295 175
          L 540 175
          C 590 175 635 185 670 210
          C 705 235 730 270 745 315
          C 760 360 760 410 745 455
          C 730 500 705 535 670 560
          C 635 585 590 595 540 595
          L 455 595
          L 455 849
          L 295 849
          L 295 175
          Z
          M 455 315
          L 455 455
          L 520 455
          C 545 455 565 450 580 435
          C 595 420 600 400 600 385
          C 600 370 595 350 580 335
          C 565 320 545 315 520 315
          L 455 315
          Z
        "/>
      </g>
    </svg>
  );
}

// OKX Logo Component
function OkxLogo({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="currentColor" className={className}>
      <path d="M19.67 12.33h-7.34c-.18 0-.33.15-.33.33v7.34c0 .18.15.33.33.33h7.34c.18 0 .33-.15.33-.33v-7.34c0-.18-.15-.33-.33-.33z"/>
      <path d="M11.67 4h-7.34c-.18 0-.33.15-.33.33v7.34c0 .18.15.33.33.33h7.34c.18 0 .33-.15.33-.33V4.33c0-.18-.15-.33-.33-.33z"/>
      <path d="M27.67 4h-7.34c-.18 0-.33.15-.33.33v7.34c0 .18.15.33.33.33h7.34c.18 0 .33-.15.33-.33V4.33c0-.18-.15-.33-.33-.33z"/>
      <path d="M11.67 20h-7.34c-.18 0-.33.15-.33.33v7.34c0 .18.15.33.33.33h7.34c.18 0 .33-.15.33-.33v-7.34c0-.18-.15-.33-.33-.33z"/>
      <path d="M27.67 20h-7.34c-.18 0-.33.15-.33.33v7.34c0 .18.15.33.33.33h7.34c.18 0 .33-.15.33-.33v-7.34c0-.18-.15-.33-.33-.33z"/>
    </svg>
  );
}

// Hyperliquid Logo Component (official brand asset, color #97FCE4)
function HyperliquidLogo({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 144 144" fill="#97FCE4" xmlns="http://www.w3.org/2000/svg">
      <path d="M144 71.6991C144 119.306 114.866 134.582 99.5156 120.98C86.8804 109.889 83.1211 86.4521 64.116 84.0456C39.9942 81.0113 37.9057 113.133 22.0334 113.133C3.5504 113.133 0 86.2428 0 72.4315C0 58.3063 3.96809 39.0542 19.736 39.0542C38.1146 39.0542 39.1588 66.5722 62.132 65.1073C85.0007 63.5379 85.4184 34.8689 100.247 22.6271C113.195 12.0593 144 23.4641 144 71.6991Z" />
    </svg>
  );
}

// Exchange navigation items
const EXCHANGES = [
  {
    id: 'okx',
    label: 'OKX',
    href: '/okx',
    logo: OkxLogo,
  },
  {
    id: 'hyperliquid',
    label: 'Hyperliquid',
    href: '/hyperliquid',
    logo: HyperliquidLogo,
  },
] as const;

export const Header = memo(function Header() {
  const pathname = usePathname();
  const router = useRouter();

  const activeExchange = EXCHANGES.find(e => pathname === e.href || pathname.startsWith(e.href + '/'))?.id ?? 'okx';

  const handleExchangeChange = (value: string) => {
    const exchange = EXCHANGES.find(e => e.id === value);
    if (exchange) {
      router.push(exchange.href);
    }
  };

  return (
    <header className="px-4 sm:px-6 py-2 flex-shrink-0">
      <div className="max-w-[1600px] mx-auto w-full flex items-center justify-between">
        {/* Left: Logo + Title + Version */}
        <div className="flex items-center gap-3">
          <PerpLogo className="w-8 h-8 rounded-lg" />
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-semibold text-foreground">{APP_CONFIG.name}</span>
            <span className="text-xs text-muted-foreground font-medium">{APP_CONFIG.versionDisplay}</span>
          </div>
        </div>

        {/* Right: Theme Toggle + Exchange Tabs */}
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Tabs value={activeExchange} onValueChange={handleExchangeChange}>
            <TabsList>
              {EXCHANGES.map((exchange) => {
                const Logo = exchange.logo;
                return (
                  <TabsTrigger key={exchange.id} value={exchange.id} className="flex items-center gap-1.5">
                    <Logo className="w-4 h-4" />
                    {exchange.label}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>
        </div>
      </div>
    </header>
  );
});
