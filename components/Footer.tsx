'use client';

// P Logo SVG Component - matches the new flat minimal logo design
function PerpLogo({ className = "w-4 h-4" }: { className?: string }) {
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

// OKX Logo for footer
function OkxFooterLogo() {
  return (
    <svg viewBox="0 0 32 32" fill="currentColor" className="w-4 h-4">
      <path d="M19.67 12.33h-7.34c-.18 0-.33.15-.33.33v7.34c0 .18.15.33.33.33h7.34c.18 0 .33-.15.33-.33v-7.34c0-.18-.15-.33-.33-.33z"/>
      <path d="M11.67 4h-7.34c-.18 0-.33.15-.33.33v7.34c0 .18.15.33.33.33h7.34c.18 0 .33-.15.33-.33V4.33c0-.18-.15-.33-.33-.33z"/>
      <path d="M27.67 4h-7.34c-.18 0-.33.15-.33.33v7.34c0 .18.15.33.33.33h7.34c.18 0 .33-.15.33-.33V4.33c0-.18-.15-.33-.33-.33z"/>
      <path d="M11.67 20h-7.34c-.18 0-.33.15-.33.33v7.34c0 .18.15.33.33.33h7.34c.18 0 .33-.15.33-.33v-7.34c0-.18-.15-.33-.33-.33z"/>
      <path d="M27.67 20h-7.34c-.18 0-.33.15-.33.33v7.34c0 .18.15.33.33.33h7.34c.18 0 .33-.15.33-.33v-7.34c0-.18-.15-.33-.33-.33z"/>
    </svg>
  );
}

// Hyperliquid Logo for footer (official brand color #97FCE4)
function HyperliquidFooterLogo() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 144 144" fill="#97FCE4" xmlns="http://www.w3.org/2000/svg">
      <path d="M144 71.6991C144 119.306 114.866 134.582 99.5156 120.98C86.8804 109.889 83.1211 86.4521 64.116 84.0456C39.9942 81.0113 37.9057 113.133 22.0334 113.133C3.5504 113.133 0 86.2428 0 72.4315C0 58.3063 3.96809 39.0542 19.736 39.0542C38.1146 39.0542 39.1588 66.5722 62.132 65.1073C85.0007 63.5379 85.4184 34.8689 100.247 22.6271C113.195 12.0593 144 23.4641 144 71.6991Z" />
    </svg>
  );
}

// Exchange-specific referral config
const EXCHANGE_REFERRAL: Record<string, { href: string; title: string; logo: () => JSX.Element }> = {
  okx: {
    href: 'https://okx.com/join/95869751',
    title: 'OKX',
    logo: OkxFooterLogo,
  },
  hyperliquid: {
    href: '#', // TODO: Add Hyperliquid referral link
    title: 'Hyperliquid',
    logo: HyperliquidFooterLogo,
  },
};

interface FooterProps {
  exchange?: 'okx' | 'hyperliquid';
}

export function Footer({ exchange = 'okx' }: FooterProps) {
  const currentYear = new Date().getFullYear();
  const referral = EXCHANGE_REFERRAL[exchange];
  const Logo = referral.logo;

  return (
    <div className="border-t border-gray-950/[0.10] dark:border-white/[0.10] py-4 flex items-center justify-between">
      <span className="text-xs text-muted-foreground">
        Copyright © {currentYear}
      </span>
      <div className="flex items-center gap-4">
        <a
          href={referral.href}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          title={referral.title}
        >
          <Logo />
        </a>
        <a
          href="https://t.me/perp_board"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          title="Telegram"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
            <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
          </svg>
        </a>
        <a
          href="https://x.com/ryechilles"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          title="X (Twitter)"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
          </svg>
        </a>
        <a
          href="https://github.com/ryechilles/Perp-Board"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          title="GitHub"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
          </svg>
        </a>
      </div>
    </div>
  );
}
