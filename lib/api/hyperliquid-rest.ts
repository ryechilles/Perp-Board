/**
 * Hyperliquid REST API functions
 * Handles all REST API calls to Hyperliquid
 *
 * Hyperliquid API is simpler than OKX:
 * - All info queries go to POST https://api.hyperliquid.xyz/info
 * - No authentication needed for read-only data
 * - metaAndAssetCtxs returns everything in one call (meta + prices + funding + volume)
 */

import {
  HyperliquidAsset,
  HyperliquidAssetCtx,
  HyperliquidRawTicker,
  ProcessedTicker,
} from '../types';
import { API } from '../constants';

const HL_REST = API.HYPERLIQUID_REST;

// ===== Helper: POST to Hyperliquid info endpoint =====
async function hlPost<T>(body: Record<string, unknown>): Promise<T | null> {
  try {
    const response = await fetch(HL_REST, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      console.error(`[Hyperliquid] HTTP ${response.status} for type=${body.type}`);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error(`[Hyperliquid] Request failed for type=${body.type}:`, error);
    return null;
  }
}

// ===== Process Hyperliquid asset data into ProcessedTicker =====
export function processHyperliquidTicker(
  asset: HyperliquidAsset,
  ctx: HyperliquidAssetCtx
): ProcessedTicker {
  const coin = asset.name;
  const markPx = parseFloat(ctx.markPx) || 0;
  const prevDayPx = parseFloat(ctx.prevDayPx) || 0;
  const changeNum = prevDayPx > 0 ? ((markPx - prevDayPx) / prevDayPx) * 100 : 0;

  // dayNtlVlm is already in USD (notional volume)
  // Store as volume / price so formatVolume(volCcy24h, price) yields correct USD value
  const dayNtlVlm = parseFloat(ctx.dayNtlVlm) || 0;
  const volInBase = markPx > 0 ? dayNtlVlm / markPx : 0;

  const rawData: HyperliquidRawTicker = {
    coin,
    markPx: ctx.markPx,
    oraclePx: ctx.oraclePx,
    prevDayPx: ctx.prevDayPx,
    dayNtlVlm: ctx.dayNtlVlm,
    funding: ctx.funding,
    openInterest: ctx.openInterest,
    maxLeverage: asset.maxLeverage,
  };

  return {
    instId: coin, // Hyperliquid uses simple coin names (e.g., "BTC", "ETH")
    baseSymbol: coin,
    priceNum: markPx,
    changeNum,
    volCcy24h: volInBase.toString(),
    rawData,
  };
}

// ===== HLP (Hyperliquidity Provider) Vault Data =====
export interface HLPVaultDetails {
  name: string;
  vaultAddress: string;
  tvl: number;
  apr: number;
  pnlDay: number;
  pnl7d: number;
  pnl30d: number;
  pnlAllTime: number;
}

// Portfolio entry: [timeframe, { accountValueHistory, pnlHistory, vlm }]
// Each history is [[timestamp_ms, value_string], ...]
type PortfolioEntry = [string, {
  accountValueHistory?: [number, string][];
  pnlHistory?: [number, string][];
  vlm?: string;
}];

interface VaultDetailsRaw {
  name: string;
  vaultAddress: string;
  leader: string;
  portfolio: PortfolioEntry[];
  apr: number;
  [key: string]: unknown;
}

// HLP vault address (well-known)
const HLP_VAULT_ADDRESS = '0xdfc24b077bc1425ad1dea75bcb6f8158e10df303';

export async function fetchHLPVaultData(): Promise<HLPVaultDetails | null> {
  try {
    const details = await hlPost<VaultDetailsRaw>({
      type: 'vaultDetails',
      vaultAddress: HLP_VAULT_ADDRESS,
    });

    if (!details?.portfolio) {
      console.error('[HLP] Failed to fetch vault details');
      return null;
    }

    // Helper: get the latest value from a portfolio timeframe's history
    const getLatest = (timeframe: string, field: 'pnlHistory' | 'accountValueHistory'): number => {
      const entry = details.portfolio.find(p => p[0] === timeframe);
      const history = entry?.[1]?.[field];
      if (!history || history.length === 0) return 0;
      return parseFloat(history[history.length - 1][1]) || 0;
    };

    // TVL = latest account value from day portfolio
    const tvl = getLatest('day', 'accountValueHistory');

    // PnL per timeframe (each timeframe's pnlHistory shows cumulative PnL for that period)
    const pnlDay = getLatest('day', 'pnlHistory');
    const pnl7d = getLatest('week', 'pnlHistory');
    const pnl30d = getLatest('month', 'pnlHistory');
    const pnlAllTime = getLatest('allTime', 'pnlHistory');

    // APR from details (already a ratio, e.g. 1.01 = 101%)
    const apr = (details.apr || 0) * 100;

    return {
      name: details.name || 'HLP',
      vaultAddress: HLP_VAULT_ADDRESS,
      tvl,
      apr,
      pnlDay,
      pnl7d,
      pnl30d,
      pnlAllTime,
    };
  } catch (error) {
    console.error('[HLP] Failed to fetch vault data:', error);
    return null;
  }
}
