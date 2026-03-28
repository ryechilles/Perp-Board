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
import { withRetry } from '../concurrency';
import { API, TIMING, UI } from '../constants';

/** @deprecated Use TickerUpdateCallback from '../types' */
export type { TickerUpdateCallback };
/** @deprecated Use StatusUpdateCallback from '../types' */
export type StatusCallback = StatusUpdateCallback;

export class HyperliquidDataManager {
  private ws: WebSocket | null = null;
  private tickers: Map<string, ProcessedTicker> = new Map();
  private onUpdate: TickerUpdateCallback;
  private onStatus: StatusUpdateCallback;
  private top50Coins: string[] = [];
  private allCoins: string[] = [];
  private restPollInterval: NodeJS.Timeout | null = null;
  private wsReconnectTimeout: NodeJS.Timeout | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private isRunning = false;
  private wsConnected = false;

  // Store latest meta + contexts for WS price patching
  private latestMeta: HyperliquidMeta | null = null;
  private latestContexts: HyperliquidAssetCtx[] | null = null;

  // Throttle: buffer WS updates and flush to React at most once per animation frame
  private updateScheduled = false;
  private statusPending: { status: 'connecting' | 'live' | 'error'; time?: Date } | null = null;

  constructor(onUpdate: TickerUpdateCallback, onStatus: StatusUpdateCallback) {
    this.onUpdate = onUpdate;
    this.onStatus = onStatus;
  }

  /** Schedule a throttled flush — writes to this.tickers immediately, but only notifies React once per frame */
  private scheduleUpdate(status?: 'connecting' | 'live' | 'error', time?: Date): void {
    if (status) this.statusPending = { status, time };
    if (this.updateScheduled) return;
    this.updateScheduled = true;
    requestAnimationFrame(() => {
      this.updateScheduled = false;
      if (!this.isRunning) return;
      this.onUpdate(new Map(this.tickers));
      if (this.statusPending) {
        this.onStatus(this.statusPending.status, this.statusPending.time);
        this.statusPending = null;
      }
    });
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    this.onStatus('connecting');

    // Step 1: Fetch all data via REST for initial load
    await this.fetchAllTickers();

    // Step 2: Connect WebSocket for real-time price updates
    this.connectWebSocket();

    // Step 3: Start REST polling for full data refresh
    this.startRestPolling();
  }

  private async fetchAllTickers(): Promise<void> {
    try {
      const result = await withRetry(
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
        { maxAttempts: 3, baseDelay: 1000, label: 'Hyperliquid fetchAllTickers' }
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

      // Remove delisted tokens
      for (const coin of this.tickers.keys()) {
        if (!currentCoins.has(coin)) {
          this.tickers.delete(coin);
        }
      }

      // Sort by 24h notional volume (USD) descending
      tickersList.sort((a, b) => {
        const volA = (parseFloat(a.volCcy24h) || 0) * a.priceNum;
        const volB = (parseFloat(b.volCcy24h) || 0) * b.priceNum;
        return volB - volA;
      });

      // TOP 50 for priority data
      this.top50Coins = tickersList.slice(0, UI.TOP50_COUNT).map(t => t.instId);
      this.allCoins = tickersList.map(t => t.instId);

      this.onUpdate(new Map(this.tickers));
      this.onStatus('live', new Date());
    } catch (error) {
      console.error('[Hyperliquid] Error fetching initial tickers:', error);
      this.onStatus('error');
    }
  }

  private connectWebSocket(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    try {
      this.ws = new WebSocket(API.HYPERLIQUID_WS);

      this.ws.onopen = () => {
        console.log('[Hyperliquid] WebSocket connected, subscribing to allMids...');
        this.wsConnected = true;

        // Subscribe to allMids for real-time price updates
        const subscribeMsg = {
          method: 'subscribe',
          subscription: { type: 'allMids' },
        };
        this.ws?.send(JSON.stringify(subscribeMsg));

        // Start ping interval
        this.startPing();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // Handle subscription confirmation
          if (data.channel === 'subscriptionResponse') {
            console.log('[Hyperliquid] Subscription confirmed');
            return;
          }

          // Handle allMids updates
          if (data.channel === 'allMids' && data.data?.mids) {
            if (!this.isRunning) return; // Guard against updates after stop()
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
      };

      this.ws.onerror = (error) => {
        console.error('[Hyperliquid] WebSocket error:', error);
      };

      this.ws.onclose = () => {
        console.log('[Hyperliquid] WebSocket closed');
        this.wsConnected = false;
        this.stopPing();

        // Reconnect after delay
        if (this.isRunning) {
          this.wsReconnectTimeout = setTimeout(() => {
            this.connectWebSocket();
          }, TIMING.WS_RECONNECT_DELAY);
        }
      };
    } catch (error) {
      console.error('[Hyperliquid] Failed to create WebSocket:', error);
      if (this.isRunning) {
        this.wsReconnectTimeout = setTimeout(() => {
          this.connectWebSocket();
        }, TIMING.WS_RECONNECT_FALLBACK);
      }
    }
  }

  private startPing(): void {
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ method: 'ping' }));
      }
    }, TIMING.WS_PING_INTERVAL);
  }

  private stopPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private startRestPolling(): void {
    // Poll for full ticker data (volume, funding, OI updates)
    this.restPollInterval = setInterval(async () => {
      if (!this.isRunning) return; // Guard against updates after stop()
      try {
        const response = await fetch(API.HYPERLIQUID_REST, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'metaAndAssetCtxs' }),
        });

        if (!this.isRunning) return; // Check again after await
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
        for (const coin of this.tickers.keys()) {
          if (!currentCoins.has(coin)) {
            this.tickers.delete(coin);
            updated = true;
          }
        }

        // Update allCoins list
        this.allCoins = Array.from(currentCoins);

        if (updated) {
          this.scheduleUpdate(!this.wsConnected ? 'live' : undefined, !this.wsConnected ? new Date() : undefined);
        }
      } catch (error) {
        console.error('[Hyperliquid] REST polling error:', error);
      }
    }, TIMING.REST_POLLING_INTERVAL);
  }

  stop(): void {
    this.isRunning = false;

    // Stop WebSocket
    this.stopPing();
    if (this.wsReconnectTimeout) {
      clearTimeout(this.wsReconnectTimeout);
      this.wsReconnectTimeout = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    // Stop REST polling
    if (this.restPollInterval) {
      clearInterval(this.restPollInterval);
      this.restPollInterval = null;
    }
  }

  getTickers(): Map<string, ProcessedTicker> {
    return new Map(this.tickers);
  }

  getTop50Coins(): string[] {
    return [...this.top50Coins];
  }

  getAllCoins(): string[] {
    return [...this.allCoins];
  }
}
