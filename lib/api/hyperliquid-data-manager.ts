/**
 * Hyperliquid Data Manager
 * Manages WebSocket connection for real-time price updates + REST polling for full data
 *
 * Architecture:
 * - WebSocket (allMids): Real-time mid-price updates for ALL coins
 * - REST polling (metaAndAssetCtxs): Full ticker data every 5 seconds
 *   (volume, funding, open interest etc. are only available via REST)
 *
 * Key differences from OKXHybridDataManager:
 * - Hyperliquid WS only provides mid-prices (not full ticker data)
 * - All info queries use POST to a single endpoint
 * - Instrument IDs are simple coin names (e.g., "BTC" not "BTC-USDT-SWAP")
 */

import { HyperliquidMeta, HyperliquidAssetCtx, ProcessedTicker, TickerUpdateCallback, StatusUpdateCallback } from '../types';
import { processHyperliquidTicker } from './hyperliquid-rest';
import { API } from '../constants';
import { BaseDataManager } from './base-data-manager';

/** @deprecated Use TickerUpdateCallback from '../types' */
export type { TickerUpdateCallback };
/** @deprecated Use StatusUpdateCallback from '../types' */
export type StatusCallback = StatusUpdateCallback;

export class HyperliquidDataManager extends BaseDataManager {
  // Store latest meta + contexts for WS price patching
  private latestMeta: HyperliquidMeta | null = null;
  private latestContexts: HyperliquidAssetCtx[] | null = null;

  constructor(onUpdate: TickerUpdateCallback, onStatus: StatusUpdateCallback) {
    super(onUpdate, onStatus);
  }

  protected getLabel(): string { return 'Hyperliquid'; }
  protected getWebSocketUrl(): string { return API.HYPERLIQUID_WS; }

  protected sendPing(): void {
    this.ws?.send(JSON.stringify({ method: 'ping' }));
  }

  protected onWebSocketOpen(): void {
    console.log('[Hyperliquid] WebSocket connected, subscribing to allMids...');

    const subscribeMsg = {
      method: 'subscribe',
      subscription: { type: 'allMids' },
    };
    this.ws?.send(JSON.stringify(subscribeMsg));
  }

  protected onWebSocketMessage(event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data);

      // Handle subscription confirmation
      if (data.channel === 'subscriptionResponse') {
        console.log('[Hyperliquid] Subscription confirmed');
        return;
      }

      // Handle allMids updates
      if (data.channel === 'allMids' && data.data?.mids) {
        if (!this.isRunning) return;
        const mids: Record<string, string> = data.data.mids;

        let updated = false;
        for (const [coin, midPx] of Object.entries(mids)) {
          const existing = this.tickers.get(coin);
          if (existing) {
            const newPrice = parseFloat(midPx);
            if (newPrice > 0 && newPrice !== existing.priceNum) {
              // Recalculate 24h change with new price
              const rawData = existing.rawData as { prevDayPx?: string };
              const prevDayPx = parseFloat(rawData.prevDayPx || '0') || 0;
              const changeNum = prevDayPx > 0
                ? ((newPrice - prevDayPx) / prevDayPx) * 100
                : existing.changeNum;

              this.tickers.set(coin, {
                ...existing,
                priceNum: newPrice,
                changeNum,
              });
              updated = true;
            }
          }
        }

        if (updated) {
          this.scheduleUpdate('live', new Date());
        }
      }
    } catch (e) {
      // Ignore parse errors
    }
  }

  protected async fetchAllTickers(): Promise<void> {
    try {
      const result = await this.fetchWithRetry(
        async () => {
          const response = await fetch(API.HYPERLIQUID_REST, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'metaAndAssetCtxs' }),
          });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const json = await response.json();
          if (!Array.isArray(json) || json.length < 2) throw new Error('Invalid response format');
          return json;
        },
        'Hyperliquid fetchAllTickers'
      );

      const meta = result[0] as HyperliquidMeta;
      const contexts = result[1] as HyperliquidAssetCtx[];
      this.latestMeta = meta;
      this.latestContexts = contexts;

      const universe = meta.universe;
      if (!universe || !contexts || universe.length !== contexts.length) {
        console.error('[Hyperliquid] Universe/context length mismatch');
        return;
      }

      const tickersList: ProcessedTicker[] = [];
      const currentCoins = new Set<string>();

      for (let i = 0; i < universe.length; i++) {
        const asset = universe[i];
        const ctx = contexts[i];
        const markPx = parseFloat(ctx.markPx);
        if (!markPx || markPx <= 0) continue;

        const processed = processHyperliquidTicker(asset, ctx);
        this.tickers.set(asset.name, processed);
        tickersList.push(processed);
        currentCoins.add(asset.name);
      }

      this.removeDelisted(currentCoins);
      this.updateIdLists(tickersList);

      // By reference — store keeps its own diffed copy (see scheduleUpdate)
      this.onUpdate(this.tickers);
      this.onStatus('live', new Date());
    } catch (error) {
      console.error('[Hyperliquid] Error fetching initial tickers:', error);
      this.onStatus('error');
    }
  }

  protected async pollRest(): Promise<void> {
    try {
      const response = await fetch(API.HYPERLIQUID_REST, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'metaAndAssetCtxs' }),
      });

      if (!this.isRunning) return;
      if (!response.ok) return;

      const result = await response.json();
      if (!this.isRunning) return;
      if (!Array.isArray(result) || result.length < 2) return;

      const meta = result[0] as HyperliquidMeta;
      const contexts = result[1] as HyperliquidAssetCtx[];
      this.latestMeta = meta;
      this.latestContexts = contexts;

      const universe = meta.universe;
      if (!universe || universe.length !== contexts.length) return;

      let updated = false;
      const currentCoins = new Set<string>();

      for (let i = 0; i < universe.length; i++) {
        const asset = universe[i];
        const ctx = contexts[i];
        const markPx = parseFloat(ctx.markPx);
        if (!markPx || markPx <= 0) continue;

        currentCoins.add(asset.name);

        // If WS is connected, only update non-price fields for top coins
        // (WS handles price updates for all coins via allMids)
        const existing = this.tickers.get(asset.name);
        if (this.wsConnected && existing) {
          // Update volume, funding, OI from REST but keep WS price
          const dayNtlVlm = parseFloat(ctx.dayNtlVlm) || 0;
          const volInBase = existing.priceNum > 0 ? dayNtlVlm / existing.priceNum : 0;

          this.tickers.set(asset.name, {
            ...existing,
            volCcy24h: volInBase.toString(),
            rawData: {
              coin: asset.name,
              markPx: ctx.markPx,
              oraclePx: ctx.oraclePx,
              prevDayPx: ctx.prevDayPx,
              dayNtlVlm: ctx.dayNtlVlm,
              funding: ctx.funding,
              openInterest: ctx.openInterest,
              maxLeverage: asset.maxLeverage,
            },
          });
          updated = true;
        } else {
          // Full update for new or WS-disconnected coins
          const processed = processHyperliquidTicker(asset, ctx);
          this.tickers.set(asset.name, processed);
          updated = true;
        }
      }

      // Remove delisted tokens
      if (this.removeDelisted(currentCoins)) updated = true;

      // Update allIds list
      this.allIds = Array.from(currentCoins);

      if (updated) {
        this.scheduleUpdate(!this.wsConnected ? 'live' : undefined, !this.wsConnected ? new Date() : undefined);
      }
    } catch (error) {
      console.error('[Hyperliquid] REST polling error:', error);
    }
  }

  // Legacy accessors
  getTop50Coins(): string[] { return this.getTop50Ids(); }
  getAllCoins(): string[] { return this.getAllIds(); }
}
