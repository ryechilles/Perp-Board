'use client';

// OKX Logo for footer
function OkxFooterLogo() {
  return (
    <svg viewBox="0 0 32 32" fill="currentColor" className="w-3.5 h-3.5" aria-hidden="true">
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
    <svg className="w-3.5 h-3.5" viewBox="0 0 144 144" fill="#97FCE4" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
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
  className?: string;
}

/** Footnote row: copyright + referral/social links (sits under the sidebar). */
export function Footer({ exchange = 'okx', className = '' }: FooterProps) {
  const currentYear = new Date().getFullYear();
  const referral = EXCHANGE_REFERRAL[exchange];
  const Logo = referral.logo;

  return (
    <footer className={`flex items-center justify-between px-1 py-1 ${className}`}>
      <span className="text-[0.6875rem] text-faint">
        © {currentYear} Perp Board
      </span>
      <div className="flex items-center gap-0.5">
        <a
          href={referral.href}
          target="_blank"
          rel="noopener noreferrer"
          className="w-7 h-7 rounded-lg flex items-center justify-center text-faint hover:text-foreground hover:bg-fill transition-colors"
          title={referral.title}
          aria-label={referral.title}
        >
          <Logo />
        </a>
        <a
          href="https://x.com/ryechilles"
          target="_blank"
          rel="noopener noreferrer"
          className="w-7 h-7 rounded-lg flex items-center justify-center text-faint hover:text-foreground hover:bg-fill transition-colors"
          title="X (Twitter)"
          aria-label="X (Twitter)"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5" aria-hidden="true">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
          </svg>
        </a>
      </div>
    </footer>
  );
}
