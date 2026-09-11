/**
 * Application-wide constants
 * Centralized configuration for all magic numbers and settings
 */

import pkg from '../package.json';

// ===========================================
// App Version (auto-synced from package.json)
// ===========================================
export const APP_VERSION = pkg.version;

// ===========================================
// Active Universe Cap
// ===========================================
// Hard cap on the instrument universe processed and displayed across the board
// (table rows, RSI fetches, funding fan-out). Only the top-N crypto perps by
// market-cap rank are kept; stock perps (STOCK_SYMBOLS, which have no CoinLore
// rank) are always kept. Crypto without a rank is dropped. Tune in one place.
export const UNIVERSE = {
  MAX_CRYPTO: 50,
  // Symbols removed from the universe entirely (before the rank cut, so they
  // don't occupy a top-N slot). Stablecoins have no price action to track —
  // only USDC is an OKX perp today; the rest are here so a new listing can't
  // slip in.
  EXCLUDED_SYMBOLS: new Set(['USDC', 'USDT', 'DAI', 'FDUSD', 'USDE', 'PYUSD', 'TUSD', 'RLUSD', 'USD1', 'USDS']),
};

// ===========================================
// API Endpoints
// ===========================================
export const API = {
  OKX_WS_PUBLIC: 'wss://ws.okx.com:8443/ws/v5/public',
  OKX_REST_BASE: 'https://www.okx.com/api/v5',
  HYPERLIQUID_REST: 'https://api.hyperliquid.xyz/info',
  HYPERLIQUID_WS: 'wss://api.hyperliquid.xyz/ws',
} as const;

// ===========================================
// Timing Configuration (in milliseconds)
// ===========================================
export const TIMING = {
  // RSI refresh intervals (tiered by market cap rank)
  RSI_REFRESH_TOP50: 2 * 60 * 1000,      // 2 minutes
  RSI_REFRESH_TIER2: 5 * 60 * 1000,      // 5 minutes
  RSI_REFRESH_TIER3: 10 * 60 * 1000,     // 10 minutes

  // RSI stale thresholds
  RSI_STALE_TOP50: 2 * 60 * 1000,        // 2 minutes
  RSI_STALE_TIER2: 5 * 60 * 1000,        // 5 minutes
  RSI_STALE_TIER3: 10 * 60 * 1000,       // 10 minutes

  // Data refresh intervals
  MARKET_CAP_REFRESH: 5 * 60 * 1000,     // 5 minutes
  FUNDING_RATES_REFRESH: 5 * 60 * 1000,  // 5 minutes
  REST_POLLING_INTERVAL: 5 * 1000,       // 5 seconds
  INITIAL_DATA_RETRY_BASE: 15 * 1000,    // 15s, doubled per attempt (15/30/60s)

  // Initial delays
  INITIAL_RSI_FETCH_DELAY: 2000,         // 2 seconds
  UNIVERSE_FALLBACK_DELAY: 8000,         // cold start: degrade the universe if market cap / spot haven't loaded
  API_BATCH_DELAY: 100,                  // 100ms between API batches

  // RSI fetch delays per tier
  RSI_DELAY_TOP50: 150,                  // 150ms
  RSI_DELAY_TIER2: 300,                  // 300ms
  RSI_DELAY_TIER3: 500,                  // 500ms

  // WebSocket
  WS_RECONNECT_DELAY: 3000,              // 3 seconds
  WS_RECONNECT_FALLBACK: 5000,           // 5 seconds
  WS_PING_INTERVAL: 25000,               // 25 seconds

  // Cache durations
  CACHE_RSI: 30 * 60 * 1000,             // 30 minutes
  CACHE_MARKET_CAP: 30 * 60 * 1000,      // 30 minutes
  CACHE_SPOT_SYMBOLS: 24 * 60 * 60 * 1000, // 24 hours (spot listings change rarely; refetched every load)
  CACHE_LOGO: 7 * 24 * 60 * 60 * 1000,   // 7 days

  // Debounce
  RSI_CACHE_SAVE_DEBOUNCE: 2000,         // 2 seconds
  MA_FLOW_CACHE_SAVE_DEBOUNCE: 2000,     // 2 seconds
} as const;

// ===========================================
// Rate Limiting
// ===========================================
export const RATE_LIMIT = {
  MAX_REQUESTS_PER_SECOND: 8,
  WINDOW_MS: 1000,
  API_BATCH_SIZE: 20,
} as const;

// ===========================================
// RSI Configuration
// ===========================================
export const RSI = {
  // Zone thresholds (9-state system matching pill colors)
  EXTREME_OVERSOLD: 20,
  OVERSOLD: 25,
  VERY_WEAK: 30,
  WEAK: 40,
  NEUTRAL_HIGH: 60,
  STRONG: 70,
  VERY_STRONG: 80,
  OVERBOUGHT: 85,
} as const;

// ===========================================
// Funding Rate Configuration
// ===========================================
export const FUNDING = {
  // APR threshold for "killer" alerts
  KILLER_APR_THRESHOLD: 20,               // 20% APR

  // Funding rate thresholds (as decimal)
  POSITIVE_THRESHOLD: 0.0001,
  NEGATIVE_THRESHOLD: -0.0001,

  // Default settlement interval
  DEFAULT_INTERVAL_HOURS: 8,
} as const;

// ===========================================
// Widget Configuration
// ===========================================
export const WIDGET = {
  // Top N selection for widgets — follows the universe cap
  TOP_TOKENS_COUNT: UNIVERSE.MAX_CRYPTO,

  // Display limits
  DISPLAY_LIMIT: 5,          // Max items to show in small widgets
} as const;

// ===========================================
// AHR999 Indicator Zones
// ===========================================
// Zone colors for the bar visualization
export const AHR999_ZONE_COLORS = [
  { width: '9%', color: 'bg-up' },            // Bottom
  { width: '15%', color: 'bg-up/40' },        // DCA
  { width: '16%', color: 'bg-zone-neutral' }, // Wait
  { width: '40%', color: 'bg-down/40' },      // Take Profit
  { width: '20%', color: 'bg-down' },         // Top
] as const;

// Zone legend data
export const AHR999_ZONE_LEGEND = [
  { range: '<0.45', label: 'Bottom', color: 'bg-up' },
  { range: '0.45–1.2', label: 'DCA', color: 'bg-up/40' },
  { range: '1.2–2.0', label: 'Wait', color: 'bg-zone-neutral' },
  { range: '2.0–4.0', label: 'Take Profit', color: 'bg-down/40' },
  { range: '>4', label: 'Top', color: 'bg-down' },
] as const;

// ===========================================
// MA Flow Configuration (Three-Line Convergence)
// ===========================================
export const MA_FLOW = {
  // Fixed convergence threshold (percentage) — no user customization
  DEFAULT_THRESHOLD: 3,

  // Candle requirements per timeframe
  CANDLES_NEEDED: 200,         // For MA200

  // Refresh & stale intervals (slower than RSI since MAs change slowly)
  REFRESH_INTERVAL: 10 * 60 * 1000,   // 10 minutes
  STALE_THRESHOLD: 10 * 60 * 1000,    // 10 minutes

  // Fetch delay between instruments
  FETCH_DELAY: 200,                    // 200ms

  // Delay before starting MA fetch (after RSI)
  INITIAL_FETCH_DELAY: 8000,           // 8 seconds

  // Token pool size (Top N by market cap) — follows the universe cap
  TOKEN_COUNT: UNIVERSE.MAX_CRYPTO,

  // Display limits
  DISPLAY_LIMIT: 10,                   // Max items per widget

  // Minimum candles for valid MA calculation
  MIN_CANDLES_MA7: 7,

  // Cache TTL
  CACHE_TTL: 15 * 60 * 1000,          // 15 minutes
} as const;

// ===========================================
// UI Configuration
// ===========================================
export const UI = {
  // Pagination
  PAGE_SIZE: 25,

  // Mobile breakpoint
  MOBILE_BREAKPOINT: 768,

  // WebSocket subscription batch size
  WS_SUBSCRIBE_BATCH_SIZE: 20,
} as const;

// ===========================================
// Fixed Columns (cannot be reordered)
// ===========================================
export const FIXED_COLUMNS = ['favorite', 'rank', 'logo', 'symbol'] as const;

// ===========================================
// Cache Keys
// ===========================================
export const CACHE_KEYS = {
  APP_VERSION: 'okx-app-version',
  FAVORITES: 'okx-favorites',
  COLUMN_ORDER: 'okx-column-order',
  FILTERS: 'okx-filters',
  COLUMNS: 'okx-columns',
  RSI_CACHE: 'okx-rsi-cache',
  MARKET_CAP_CACHE: 'okx-marketcap-cache',
  SPOT_SYMBOLS_CACHE: 'okx-spot-symbols-cache',
  LOGO_CACHE: 'perp_board_logo_cache',
  MA_FLOW_CACHE: 'okx-ma-flow-cache',
  // Hyperliquid-specific cache keys
  HL_FAVORITES: 'hl-favorites',
  HL_COLUMN_ORDER: 'hl-column-order',
  HL_FILTERS: 'hl-filters',
  HL_COLUMNS: 'hl-columns',
  HL_RSI_CACHE: 'hl-rsi-cache',
} as const;

// ===========================================
// Stock (Equity Perpetual) Symbols
// OKX equity perpetual swaps — used to distinguish stock vs crypto
// ===========================================
export const STOCK_SYMBOLS = new Set([
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA', 'META',  // Mag 7
  'MSTR', 'COIN', 'HOOD', 'CRCL',                              // Crypto-adjacent
  'INTC', 'AMD', 'MU', 'SNDK', 'TSM',                          // Semiconductors
  'ORCL', 'NFLX', 'PLTR',                                       // Tech & Enterprise
  'QQQ', 'SPY',                                                  // Index ETFs
]);

// ===========================================
// Meme Tokens List
// ===========================================
export const MEME_TOKENS = new Set([
  'DOGE', 'SHIB', 'PEPE', 'FLOKI', 'BONK', 'WIF', 'MEME', 'ELON',
  'BABYDOGE', 'SAITAMA', 'AKITA', 'KISHU', 'HOGE', 'SAMO', 'CHEEMS',
  'TURBO', 'LADYS', 'AIDOGE', 'BOB', 'WOJAK', 'CHAD', 'MUMU', 'BOME',
  'SLERF', 'MEW', 'POPCAT', 'GOAT', 'PNUT', 'ACT', 'NEIRO', 'HIPPO',
  'CHILLGUY', 'BAN', 'LUCE', 'MOODENG', 'SUNDOG', 'MYRO', 'WEN',
  'PONKE', 'BODEN', 'TREMP', 'MOTHER', 'GIGA', 'SPX', 'MOG', 'BRETT',
  'TOSHI', 'MANEKI', 'KEYCAT', 'DOG', 'PIZZA', 'PEOPLE', 'COW',
  'SATS', 'RATS', 'ORDI', 'TRUMP', 'MELANIA', 'VINE', 'ANIME', 'PENGU',
  '1000PEPE', '1000SHIB', '1000BONK', '1000FLOKI', '1000SATS', '1000RATS',
]);
