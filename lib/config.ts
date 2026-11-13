/**
 * Application Configuration
 *
 * Centralized configuration for the app.
 * Version is imported from constants.ts - update APP_VERSION there.
 */

import { APP_VERSION } from './constants';

export const APP_CONFIG = {
  name: 'Perp Board',
  title: 'Perp Board — OKX Perpetual Market Dashboard',
  version: APP_VERSION,
  versionDisplay: `v${APP_VERSION}`,
  description: 'Real-time OKX perpetual futures dashboard. Funding rates, RSI signals, market cap and momentum at a glance.',
  author: 'ryechilles',
  links: {
    okx: 'https://okx.com/join/95869751',
    telegram: 'https://t.me/perp_board',
    twitter: 'https://x.com/ryechilles',
    github: 'https://github.com/ryechilles/Perp-Board',
  },
} as const;

/**
 * Page-ground colour per theme, mirrored into <meta name="theme-color"> so the
 * browser chrome matches. Keep in sync with --surface-0 in app/globals.css.
 */
export const THEME_COLOR = { light: '#f3f4f6', dark: '#090a0c' } as const;

export const { name, version, versionDisplay, description } = APP_CONFIG;
