// OKX Ticker data from REST API
export interface OKXTicker {
  instId: string;
  last: string;
  sodUtc8: string;
  open24h?: string;
  high24h?: string;
  low24h?: string;
  vol24h?: string;
  volCcy24h?: string;
  ts: string;
}

// ===========================================
// Hyperliquid Types
// ===========================================

// Hyperliquid asset from meta endpoint
export interface HyperliquidAsset {
  name: string;
  szDecimals: number;
  maxLeverage: number;
  onlyIsolated?: boolean;
}

// Hyperliquid meta response
export interface HyperliquidMeta {
  universe: HyperliquidAsset[];
}

// Hyperliquid asset context (pricing, volume, funding)
export interface HyperliquidAssetCtx {
  funding: string;
  openInterest: string;
  prevDayPx: string;
  dayNtlVlm: string;
  premium?: string;
  oraclePx: string;
  markPx: string;
  midPx?: string;
  impactPxs?: string[];
}

// Hyperliquid raw ticker data (stored in ProcessedTicker.rawData)
export interface HyperliquidRawTicker {
  coin: string;
  markPx: string;
  oraclePx: string;
  prevDayPx: string;
  dayNtlVlm: string;
  funding: string;
  openInterest: string;
  maxLeverage: number;
}

// Hyperliquid candle data
export interface HyperliquidCandle {
  t: number;  // open time ms
  T: number;  // close time ms
  s: string;  // coin
  i: string;  // interval
  o: string;  // open
  c: string;  // close
  h: string;  // high
  l: string;  // low
  v: string;  // volume (base)
  n: number;  // number of trades
}

// OKX Instrument data
export interface OKXInstrument {
  instId: string;
  instType: string;
  uly?: string;
  instFamily?: string;
  baseCcy?: string;
  quoteCcy?: string;
  settleCcy?: string;
  ctVal?: string;
  ctMult?: string;
  ctValCcy?: string;
  optType?: string;
  stk?: string;
  listTime: string; // Listing timestamp in milliseconds
  expTime?: string;
  lever?: string;
  tickSz?: string;
  lotSz?: string;
  minSz?: string;
  ctType?: string;
  instCategory?: string; // 'Stocks' for equity perpetuals, undefined/other for crypto
  state: string;
}

// Asset category type
export type AssetCategory = 'crypto' | 'stock';

// OKX Funding Rate data
export interface OKXFundingRate {
  instId: string;
  instType: string;
  fundingRate: string;
  nextFundingRate: string;
  fundingTime: string;
  nextFundingTime: string;
}

// Processed ticker data (exchange-agnostic)
export interface ProcessedTicker {
  instId: string;
  baseSymbol: string;
  priceNum: number;
  changeNum: number; // 24h change %
  volCcy24h: string; // 24h volume in currency
  rawData: OKXTicker | HyperliquidRawTicker;
}

// TD Sequential signal — only emitted when the latest candle completes
// a Setup 9 or a Countdown 13
export interface TDSignal {
  type: 'buy' | 'sell';
  count: 9 | 13;
}

// An in-progress TD count (setup streak or countdown)
export interface TDCount {
  type: 'buy' | 'sell';
  count: number;
}

// Full TD Sequential state as of the latest candle
export interface TDState {
  signal: TDSignal | null;    // Setup 9 / Countdown 13 completed on the latest candle
  setup: TDCount | null;      // in-progress setup streak (1-8) on the latest candle
  countdown: TDCount | null;  // active countdown (1-12)
}

// RSI data for a single instrument
export interface RSIData {
  rsi7: number | null;      // Daily RSI7
  rsi14: number | null;     // Daily RSI14
  rsiW7: number | null;     // Weekly RSI7
  rsiW14: number | null;    // Weekly RSI14
  change1h: number | null;  // 1-hour change %
  change4h: number | null;  // 4-hour change %
  change7d: number | null;  // 7-day change %
  sparkline7d?: number[];   // 7-day price data from daily candles (OKX)
  sparkline24h?: number[];  // 24h price data from hourly candles (OKX)
  td?: TDState | null;      // Daily TD Sequential state (optional: absent in old cached entries)
  lastUpdated: number;
}

// Funding rate data
export interface FundingRateData {
  fundingRate: number;
  nextFundingRate: number;
  fundingTime: number;
  nextFundingTime: number;
  settlementInterval: number; // in hours (1, 2, 4, 8)
  lastUpdated: number;
}

// Listing date data
export interface ListingData {
  listTime: number; // Unix timestamp in milliseconds
  instCategory?: string; // 'Stocks' for equity perpetuals
}

// Market cap data from CoinGecko
export interface MarketCapData {
  marketCap: number;
  rank: number;
  logo?: string;
  sparkline?: number[]; // 7-day price data for sparkline chart
}

// Column key type
export type ColumnKey =
  | 'favorite'
  | 'rank'
  | 'logo'
  | 'symbol'
  | 'price'
  | 'fundingRate'
  | 'fundingApr'
  | 'fundingInterval'
  | 'change4h'
  | 'change'
  | 'change7d'
  | 'volume24h'
  | 'marketCap'
  | 'dRsiSignal'
  | 'wRsiSignal'
  | 'tdSeq'
  | 'rsi7'
  | 'rsi14'
  | 'rsiW7'
  | 'rsiW14'
  | 'listDate';

// Column visibility settings — auto-synced with ColumnKey
export type ColumnVisibility = Record<ColumnKey, boolean>;

// RSI Signal type (9 states)
export type RsiSignalType =
  | 'extreme-oversold'
  | 'oversold'
  | 'very-weak'
  | 'weak'
  | 'neutral'
  | 'strong'
  | 'very-strong'
  | 'overbought'
  | 'extreme-overbought';

// Filter settings
export interface Filters {
  rank?: string;
  marketCapMin?: string;  // Minimum market cap filter
  rsi7?: string;
  rsi14?: string;
  rsiW7?: string;   // Weekly RSI7 filter
  rsiW14?: string;  // Weekly RSI14 filter
  fundingRate?: string;
  isMeme?: string;   // Meme token filter
  dRsiSignal?: RsiSignalType[];  // D-RSI Avg Signal filter (multi-select)
  wRsiSignal?: RsiSignalType[];  // W-RSI Avg Signal filter (multi-select)
  assetCategory?: AssetCategory;  // 'crypto' or 'stock' filter
}

// Sort configuration
export interface SortConfig {
  column: string;
  direction: 'asc' | 'desc';
}

// ===========================================
// Widget Types (shared across widget components)
// ===========================================

// Token with RSI data for RSI widgets
export interface TokenWithRsi {
  symbol: string;
  instId: string;
  marketCap: number;
  price: number;
  avgRsi: number;
  logo?: string;
}

// Token with APR data for Funding widgets
export interface TokenWithApr {
  symbol: string;
  instId: string;
  apr: number;
  price: number;
  logo?: string;
}

// MA values for a single timeframe (shared across MA Flow components)
export interface MAValues {
  ma7: number | null;
  ma30: number | null;
  ma200: number | null;
}

// MA Flow data for a single instrument (all timeframes)
export interface MAFlowData {
  ma4h: MAValues | null;
  maDaily: MAValues | null;
  maWeekly: MAValues | null;
  maMonthly: MAValues | null;
  convergence4h: number | null;
  convergenceDaily: number | null;
  convergenceWeekly: number | null;
  convergenceMonthly: number | null;
  lastUpdated: number;
}

// ===========================================
// Exchange Adapter Types
// ===========================================

/**
 * Common data manager interface (OKXHybridDataManager / HyperliquidDataManager)
 */
export interface DataManager {
  start(): Promise<void>;
  stop(): void;
  /** Full instrument list (not universe-filtered). */
  getTickers(): Map<string, ProcessedTicker>;
  /** Only these instruments are streamed and emitted to the store. */
  setUniverse(ids: Set<string>): void;
}

/**
 * Callback types shared across data managers
 */
export type TickerUpdateCallback = (tickers: Map<string, ProcessedTicker>) => void;
export type StatusUpdateCallback = (status: 'connecting' | 'live' | 'error', time?: Date) => void;

/**
 * Exchange adapter configuration
 * Each exchange provides a thin adapter implementing this interface.
 */
export interface ExchangeAdapter {
  exchange: 'okx' | 'hyperliquid';
  createDataManager(onUpdate: TickerUpdateCallback, onStatus: StatusUpdateCallback): DataManager;
  fetchRSIBatch(
    ids: string[],
    existing: Map<string, RSIData>,
    onProgress: (text: string) => void,
    onUpdate: (id: string, data: RSIData) => void,
    tier?: 'top50' | 'tier2' | 'tier3' | 'all',
    signal?: AbortSignal
  ): Promise<void>;
  /**
   * Fetch exchange-specific, universe-independent initial data (spot symbols,
   * listings). Each part is null when its fetch failed — the controller then
   * keeps the previous store data and retries, instead of wiping columns with empties.
   */
  fetchInitialData(): Promise<{
    spotSymbols?: Set<string> | null;
    listingData?: Map<string, ListingData> | null;
  }>;
  /**
   * Fetch funding for exactly these instruments (the active universe). Present
   * only for exchanges that need a separate per-instrument funding fetch (OKX).
   * REJECTS on failure so the controller keeps the last good data.
   */
  fetchFundingRates?(instIds: Set<string>): Promise<Map<string, FundingRateData>>;
  /** Exchanges that embed funding in tickers (Hyperliquid). */
  extractFundingFromTickers?(tickers: Map<string, ProcessedTicker>): Map<string, FundingRateData>;
  /** Pre-filter tickers before the filter pipeline (e.g. OKX keeps only USDT swaps) */
  preFilterTickers(tickers: ProcessedTicker[]): ProcessedTicker[];
  spotSymbolFormat: 'base-usdt' | 'base';
  defaultSettlementInterval: number;
  features: {
    maFlow: boolean;
    listingDates: boolean;
    /** Exchange has spot data → crypto without a spot listing is cut from the universe. */
    excludeNoSpotCrypto: boolean;
  };
}
