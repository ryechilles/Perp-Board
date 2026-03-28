/**
 * OKX Hybrid Data Manager
 * Manages WebSocket connection for TOP 50 tickers + REST polling for the rest
 */

import { OKXTicker, ProcessedTicker } from '../types';
import { processTicker } from '../utils';
import { API, TIMING, UI } from '../constants';

const OKX_WS_PUBLIC = API.OKX_WS_PUBLIC;
const OKX_REST_BASE = API.OKX_REST_BASE;

export type TickerUpdateCallback = (tickers: Map<string, ProcessedTicker>) => void;
export type StatusCallback = (status: 'connecting' | 'live' | 'error', time?: Date) => void;

// Hybrid data manager: WebSocket for TOP 50 + REST polling for the rest
export class OKXHybridDataManager {
  private ws: WebSocket | null = null;
  private tickers: Map<string, ProcessedTicker> = new Map();
  private onUpdate: TickerUpdateCallback;
  private onStatus: StatusCallback;
  private top50InstIds: string[] = [];
  private top50Set: Set<string> = new Set(); // O(1) lookup instead of Array.includes
  private allInstIds: string[] = [];
  private restPollInterval: NodeJS.Timeout | null = null;
  private wsReconnectTimeout: NodeJS.Timeout | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private isRunning = false;
  private wsConnected = false;
  private wsLastUpdateTime: Map<string, number> = new Map(); // Track WS update timestamps

  // Throttle: buffer WS updates and flush to React at most once per animation frame
  private updateScheduled = false;
  private statusPending: { status: 'connecting' | 'live' | 'error'; time?: Date } | null = null;

  constructor(onUpdate: TickerUpdateCallback, onStatus: StatusCallback) {
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

    // Step 1: Fetch all tickers via REST to get initial data and determine TOP 50
    await this.fetchAllTickers();

    // Step 2: Connect WebSocket for TOP 50
    this.connectWebSocket();

    // Step 3: Start REST polling for non-TOP 50
    this.startRestPolling();
  }

  private async fetchAllTickers(): Promise<void> {
    try {
      const response = await fetch(`${OKX_REST_BASE}/market/tickers?instType=SWAP`);
      const data = await response.json();

      if (data.code === '0' && data.data) {
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

        // Remove delisted tokens (tokens that no longer exist in API response)
        for (const instId of this.tickers.keys()) {
          if (!currentInstIds.has(instId)) {
            this.tickers.delete(instId);
          }
        }

        // Sort by 24h volume in USD (volCcy24h * price) descending
        usdtSwaps.sort((a, b) => {
          const volA = (parseFloat(a.volCcy24h) || 0) * a.priceNum;
          const volB = (parseFloat(b.volCcy24h) || 0) * b.priceNum;
          return volB - volA;
        });

        // TOP 50 for WebSocket
        this.top50InstIds = usdtSwaps.slice(0, UI.TOP50_COUNT).map(t => t.instId);
        this.top50Set = new Set(this.top50InstIds);
        this.allInstIds = usdtSwaps.map(t => t.instId);

        this.onUpdate(new Map(this.tickers));
        this.onStatus('live', new Date());
      }
    } catch (error) {
      console.error('Error fetching initial tickers:', error);
      this.onStatus('error');
    }
  }

  private connectWebSocket(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return;
    if (this.top50InstIds.length === 0) return;

    try {
      this.ws = new WebSocket(OKX_WS_PUBLIC);

      this.ws.onopen = () => {
        console.log('WebSocket connected, subscribing to TOP 50...');
        this.wsConnected = true;

        // Subscribe to TOP 50 in batches
        const batchSize = UI.WS_SUBSCRIBE_BATCH_SIZE;
        for (let i = 0; i < this.top50InstIds.length; i += batchSize) {
          const batch = this.top50InstIds.slice(i, i + batchSize);
          const subscribeMsg = {
            op: 'subscribe',
            args: batch.map(instId => ({
              channel: 'tickers',
              instId: instId
            }))
          };
          this.ws?.send(JSON.stringify(subscribeMsg));
        }

        // Start ping interval
        this.startPing();
      };

      this.ws.onmessage = (event) => {
        const rawData = event.data;

        // Handle pong (plain text, not JSON)
        if (rawData === 'pong') {
          return;
        }

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
            if (!this.isRunning) return; // Guard against updates after stop()
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
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      this.ws.onclose = () => {
        console.log('WebSocket closed');
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
      console.error('Failed to create WebSocket:', error);
      // Retry after delay
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
        this.ws.send('ping');
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
    // Poll for all tickers (updates non-TOP 50)
    this.restPollInterval = setInterval(async () => {
      if (!this.isRunning) return; // Guard against updates after stop()
      try {
        const response = await fetch(`${OKX_REST_BASE}/market/tickers?instType=SWAP`);
        if (!this.isRunning) return; // Check again after await
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
          for (const instId of this.tickers.keys()) {
            if (!currentInstIds.has(instId)) {
              this.tickers.delete(instId);
              updated = true;
            }
          }

          // Update allInstIds list
          this.allInstIds = Array.from(currentInstIds);

          if (updated) {
            this.scheduleUpdate(!this.wsConnected ? 'live' : undefined, !this.wsConnected ? new Date() : undefined);
          }
        }
      } catch (error) {
        console.error('REST polling error:', error);
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

  getTop50InstIds(): string[] {
    return [...this.top50InstIds];
  }

  getAllInstIds(): string[] {
    return [...this.allInstIds];
  }
}
