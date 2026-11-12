import type { Metadata } from 'next';
import Script from 'next/script';
import { Geist, Geist_Mono } from 'next/font/google';
import { APP_CONFIG } from '@/lib/config';
import { TooltipProvider } from '@/components/ui';
import './globals.css';

const GA_MEASUREMENT_ID = 'G-VJB7B5NH29';

// Self-hosted via next/font: no render-blocking @import, font-display swap,
// preload, and zero layout shift. Geist for UI text, Geist Mono for numbers.
const geistSans = Geist({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
});
const geistMono = Geist_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: APP_CONFIG.title,
  description: APP_CONFIG.description,
  authors: [{ name: APP_CONFIG.author }],
  other: {
    version: APP_CONFIG.version,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable}`}>
      <head>
        {/* Apply saved theme before paint: prevents flash + keeps color-scheme/theme-color in sync */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');var d=t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches);var el=document.documentElement;if(d)el.classList.add('dark');el.style.colorScheme=d?'dark':'light';var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute('content',d?'#0b0c0e':'#f4f4f5');}catch(e){}})();`,
          }}
        />
        {/* Google Analytics */}
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_MEASUREMENT_ID}');
          `}
        </Script>
        {/* Preconnect to the token-logo CDN (plain <img>, so no crossOrigin). Each
            exchange's API hosts are preconnected by its own page — see BoardPreloads. */}
        <link rel="preconnect" href="https://c1.coinlore.com" />
        {/* Responsive: mobile renders a card layout, desktop the full table */}
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        {/* Version meta tag */}
        <meta name="version" content={APP_CONFIG.version} />
        {/* Standard favicon */}
        <link rel="icon" type="image/png" href="/favicon.png" />
        {/* Apple touch icon */}
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        {/* Safari pinned tab */}
        <link rel="mask-icon" href="/safari-pinned-tab.svg" color="#22B96A" />
        {/* Default matches light page background; init script + ThemeToggle keep it in sync with the active theme */}
        <meta name="theme-color" content="#f4f4f5" />
      </head>
      <body>
        <TooltipProvider>
          {children}
        </TooltipProvider>
      </body>
    </html>
  );
}
