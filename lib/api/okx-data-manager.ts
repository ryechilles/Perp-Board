/**
 * OKX Hybrid Data Manager
 * Manages WebSocket connection for TOP 50 tickers + REST polling for the rest
 */

import { OKXTicker, ProcessedTicker, TickerUpdateCallback, StatusUpdateCallback } from '../types';
import { processTicker } from '../utils';
import { API, UI } from '../constants';
import { BaseDataManager } from './base-data-manager';

const OKX_WS_PUBLIC = API.OKX_WS_PUBLIC;
const OKX_REST_BASE = API.OKX_REST_BASE;

/** @deprecated Use TickerUpdateCallback from '../types' */
export type { TickerUpdateCallback };
/** @deprecated Use StatusUpdateCallback from '../types' */
export type StatusCallback = StatusUpdateCallback;

export class OKXHybridDataManager extends BaseDataManager {
  private top50Set: Set<string> = new Set(); // O(1) lookup instead of Array.includes
  private wsLastUpdateTime: Map<string, number> = new Map(); // Track WS update timestamps

  constructor(onUpdate: TickerUpdateCallback, onStatus: StatusUpdateCallback) {
    super(onUpdate, onStatus);
  }

  protected getLabel(): string { return 'OKX'; }
  protected getWebSocketUrl(): string { return OKX_WS_PUBLIC; }

  protected canConnectWebSocket(): boolean {
    return this.top50Ids.length > 0;
  }

  protected sendPing(): void {
    this.ws?.send('ping');
  }

  protected onWebSocketOpen(): void {
    console.log('WebSocket connected, subscribing to TOP 50...');

    // Subscribe to TOP 50 in batches
    const batchSize = UI.WS_SUBSCRIBE_BATCH_SIZE;
    for (let i = 0; i < this.top50Ids.length; i += batchSize) {
      const batch = this.top50Ids.slice(i, i + batchSize);
      const subscribeMsg = {
        op: 'subscribe',
        args: batch.map(instId => ({
          channel: 'tickers',
          instId: instId
        }))
      };
      this.ws?.send(JSON.stringify(subscribeMsg));
    }
  }

  protected onWebSocketMessage(event: MessageEvent): void {
    const rawData = event.data;

    // Handle pong (plain text, not JSON)
    if (rawData === 'pong') return;

    try {
      const data = JSON.parse(rawData);

      // Handle subscription confirmation
      if (data.event === 'subscribe') {
        console.log('Subscribed:', data.arg?.instId || 'batch');
        return;
      }

      // Handle error
      if (data.event === 'error') {
        console.error('WebSocket error:', data.msg);
        return;
      }

      // Handle ticker data
      if (data.arg?.channel === 'tickers' && data.data) {
        if (!this.isRunning) return;
        const now = Date.now();
        data.data.forEach((ticker: OKXTicker) => {
          const processed = processTicker(ticker);
          this.tickers.set(ticker.instId, processed);
          this.wsLastUpdateTime.set(ticker.instId, now);
        });
        this.scheduleUpdate('live', new Date());
      }
    } catch (e) {
      // Ignore parse errors for non-JSON messages
    }
  }

  protected async fetchAllTickers(): Promise<void> {
    try {
      const data = await this.fetchWithRetry(
        async () => {
          const response = await fetch(`${OKX_REST_BASE}/market/tickers?instType=SWAP`);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const json = await response.json();
          if (json.code !== '0') throw new Error(`OKX API error: ${json.code}`);
          return json;
        },
        'OKX fetchAllTickers'
      );

      if (data.data) {
        const usdtSwaps: ProcessedTicker[] = [];
        const currentInstIds = new Set<string>();

        data.data.forEach((ticker: OKXTicker) => {
          if (ticker.instId.endsWith('-USDT-SWAP')) {
            const processed = processTicker(ticker);
            this.tickers.set(ticker.instId, processed);
            usdtSwaps.push(processed);
            currentInstIds.add(ticker.instId);
          }
        });

        this.removeDelisted(currentInstIds);
        this.updateIdLists(usdtSwaps);
        this.top50Set = new Set(this.top50Ids);

        this.onUpdate(new Map(this.tickers));
        this.onStatus('live', new Date());
      }
    } catch (error) {
      console.error('Error fetching initial tickers:', error);
      this.onStatus('error');
    }
  }

  protected async pollRest(): Promise<void> {
    try {
      const response = await fetch(`${OKX_REST_BASE}/market/tickers?instType=SWAP`);
      if (!this.isRunning) return;
      const data = await response.json();

      if (data.code === '0' && data.data) {
        if (!this.isRunning) return;
        let updated = false;
        const currentInstIds = new Set<string>();

        const now = Date.now();
        data.data.forEach((ticker: OKXTicker) => {
          if (ticker.instId.endsWith('-USDT-SWAP')) {
            currentInstIds.add(ticker.instId);
            // Skip TOP 50 instruments that have recent WS updates (within last 10s)
            if (this.wsConnected && this.top50Set.has(ticker.instId)) {
              const lastWsUpdate = this.wsLastUpdateTime.get(ticker.instId) ?? 0;
              if (now - lastWsUpdate < 10000) return; // WS data is fresh, skip REST
            }
            const processed = processTicker(ticker);
            this.tickers.set(ticker.instId, processed);
            updated = true;
          }
        });

        // Remove delisted tokens
        if (this.removeDelisted(currentInstIds)) updated = true;

        // Update allIds list
        this.allIds = Array.from(currentInstIds);

        if (updated) {
          this.scheduleUpdate(!this.wsConnected ? 'live' : undefined, !this.wsConnected ? new Date() : undefined);
        }
      }
    } catch (error) {
      console.error('REST polling error:', error);
    }
  }

  // Legacy accessors (keep for backward compatibility)
  getTop50InstIds(): string[] { return this.getTop50Ids(); }
  getAllInstIds(): string[] { return this.getAllIds(); }
}
