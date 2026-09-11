/**
 * OKX Hybrid Data Manager
 * WebSocket for the active universe (what the board shows) + a single REST
 * poll of all tickers — the full list feeds universe selection, but only
 * universe members reach the store.
 */

import { OKXTicker, TickerUpdateCallback, StatusUpdateCallback } from '../types';
import { processTicker } from '../utils';
import { API, UI } from '../constants';
import { BaseDataManager } from './base-data-manager';
import { okxFetch } from './okx-gateway';

const OKX_WS_PUBLIC = API.OKX_WS_PUBLIC;
const OKX_REST_BASE = API.OKX_REST_BASE;

/** @deprecated Use TickerUpdateCallback from '../types' */
export type { TickerUpdateCallback };
/** @deprecated Use StatusUpdateCallback from '../types' */
export type StatusCallback = StatusUpdateCallback;

export class OKXHybridDataManager extends BaseDataManager {
  private wsLastUpdateTime: Map<string, number> = new Map(); // Track WS update timestamps

  constructor(onUpdate: TickerUpdateCallback, onStatus: StatusUpdateCallback) {
    super(onUpdate, onStatus);
  }

  protected getLabel(): string { return 'OKX'; }
  protected getWebSocketUrl(): string { return OKX_WS_PUBLIC; }

  protected canConnectWebSocket(): boolean {
    return !!this.universe && this.universe.size > 0;
  }

  protected sendPing(): void {
    this.ws?.send('ping');
  }

  protected onWebSocketOpen(): void {
    const ids = Array.from(this.universe ?? []);
    console.log(`WebSocket connected, subscribing to ${ids.length} universe instruments...`);
    this.sendTickerSubscription('subscribe', ids);
  }

  /** (Un)subscribe the tickers channel in batches. */
  private sendTickerSubscription(op: 'subscribe' | 'unsubscribe', instIds: string[]): void {
    const batchSize = UI.WS_SUBSCRIBE_BATCH_SIZE;
    for (let i = 0; i < instIds.length; i += batchSize) {
      const batch = instIds.slice(i, i + batchSize);
      this.ws?.send(JSON.stringify({
        op,
        args: batch.map(instId => ({ channel: 'tickers', instId })),
      }));
    }
  }

  /**
   * Keep the WS subscription equal to the universe. An open socket gets the
   * diff; a socket still connecting subscribes the current universe on open;
   * with no socket yet (cold start: universe was unknown at start()), connect.
   */
  protected onUniverseChange(prev: Set<string> | null, next: Set<string>): void {
    if (!this.isRunning) return;
    if (this.ws?.readyState === WebSocket.OPEN) {
      const added = Array.from(next).filter(id => !prev?.has(id));
      const removed = prev ? Array.from(prev).filter(id => !next.has(id)) : [];
      if (removed.length > 0) this.sendTickerSubscription('unsubscribe', removed);
      if (added.length > 0) this.sendTickerSubscription('subscribe', added);
      removed.forEach(id => this.wsLastUpdateTime.delete(id));
    } else if (!this.ws && !this.wsReconnectTimeout) {
      this.connectWebSocket();
    }
  }

  protected onWebSocketMessage(event: MessageEvent): void {
    const rawData = event.data;

    // Handle pong (plain text, not JSON)
    if (rawData === 'pong') return;

    try {
      const data = JSON.parse(rawData);

      // Handle subscription confirmation
      if (data.event === 'subscribe' || data.event === 'unsubscribe') {
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
        let visible = false;
        data.data.forEach((ticker: OKXTicker) => {
          const processed = processTicker(ticker);
          this.tickers.set(ticker.instId, processed);
          this.wsLastUpdateTime.set(ticker.instId, now);
          // In-flight pushes for just-unsubscribed instruments must not flush.
          if (this.inUniverse(ticker.instId)) visible = true;
        });
        if (visible) this.scheduleUpdate('live', new Date());
      }
    } catch (e) {
      // Ignore parse errors for non-JSON messages
    }
  }

  protected async fetchAllTickers(): Promise<void> {
    try {
      const data = await this.fetchWithRetry(
        async () => {
          const response = await okxFetch(`${OKX_REST_BASE}/market/tickers?instType=SWAP`);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const json = await response.json();
          if (json.code !== '0') throw new Error(`OKX API error: ${json.code}`);
          return json;
        },
        'OKX fetchAllTickers'
      );

      if (data.data) {
        const currentInstIds = new Set<string>();

        data.data.forEach((ticker: OKXTicker) => {
          if (ticker.instId.endsWith('-USDT-SWAP')) {
            this.tickers.set(ticker.instId, processTicker(ticker));
            currentInstIds.add(ticker.instId);
          }
        });

        this.removeDelisted(currentInstIds);

        // No-op until the controller has set the universe (see emitTickers).
        this.emitTickers();
        this.onStatus('live', new Date());
      }
    } catch (error) {
      console.error('Error fetching initial tickers:', error);
      this.onStatus('error');
    }
  }

  protected async pollRest(): Promise<void> {
    try {
      const response = await okxFetch(`${OKX_REST_BASE}/market/tickers?instType=SWAP`);
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
            const visible = this.inUniverse(ticker.instId);
            // Skip streamed (universe) instruments with a recent WS update (within last 10s)
            if (visible && this.wsConnected) {
              const lastWsUpdate = this.wsLastUpdateTime.get(ticker.instId) ?? 0;
              if (now - lastWsUpdate < 10000) return; // WS data is fresh, skip REST
            }
            // Non-universe instruments are still refreshed (universe selection
            // input) but don't trigger a flush.
            this.tickers.set(ticker.instId, processTicker(ticker));
            if (visible) updated = true;
          }
        });

        // Remove delisted tokens
        if (this.removeDelisted(currentInstIds)) updated = true;

        if (updated) {
          this.scheduleUpdate(!this.wsConnected ? 'live' : undefined, !this.wsConnected ? new Date() : undefined);
        }
      }
    } catch (error) {
      console.error('REST polling error:', error);
    }
  }
}
