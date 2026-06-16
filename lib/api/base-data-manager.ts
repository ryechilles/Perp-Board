/**
 * Base Data Manager
 * Shared logic for WebSocket + REST hybrid data management.
 * OKX and Hyperliquid managers extend this class and implement exchange-specific hooks.
 */

import { ProcessedTicker, TickerUpdateCallback, StatusUpdateCallback } from '../types';
import { withRetry } from '../concurrency';
import { TIMING, UI } from '../constants';

export abstract class BaseDataManager {
  protected ws: WebSocket | null = null;
  protected tickers: Map<string, ProcessedTicker> = new Map();
  protected onUpdate: TickerUpdateCallback;
  protected onStatus: StatusUpdateCallback;
  protected top50Ids: string[] = [];
  protected allIds: string[] = [];
  protected restPollInterval: NodeJS.Timeout | null = null;
  protected wsReconnectTimeout: NodeJS.Timeout | null = null;
  protected pingInterval: NodeJS.Timeout | null = null;
  protected isRunning = false;
  protected wsConnected = false;

  // Throttle: buffer WS updates and flush to React at most once per animation frame
  private updateScheduled = false;
  private statusPending: { status: 'connecting' | 'live' | 'error'; time?: Date } | null = null;

  constructor(onUpdate: TickerUpdateCallback, onStatus: StatusUpdateCallback) {
    this.onUpdate = onUpdate;
    this.onStatus = onStatus;
  }

  /**
   * Schedule a throttled flush — writes to this.tickers immediately, but only
   * notifies React once per frame.
   *
   * The hot-path flush passes `this.tickers` BY REFERENCE (no defensive clone):
   * MarketStore.setTickers diffs it and keeps its own `merged` copy, so the
   * store never aliases our live map. The flush runs synchronously, and every
   * consumer (setTickers / extractFundingFromTickers / prune) materializes
   * what it needs before any await — so a later WS mutation can't corrupt them.
   * This removes one full Map allocation per animation frame (~300 entries).
   */
  protected scheduleUpdate(status?: 'connecting' | 'live' | 'error', time?: Date): void {
    if (status) this.statusPending = { status, time };
    if (this.updateScheduled) return;
    this.updateScheduled = true;
    requestAnimationFrame(() => {
      this.updateScheduled = false;
      if (!this.isRunning) return;
      this.onUpdate(this.tickers);
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

    // Step 1: Fetch all tickers via REST for initial data
    await this.fetchAllTickers();

    // Step 2: Connect WebSocket for real-time updates
    this.connectWebSocket();

    // Step 3: Start REST polling for secondary data
    this.startRestPolling();
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

  getTop50Ids(): string[] {
    return [...this.top50Ids];
  }

  getAllIds(): string[] {
    return [...this.allIds];
  }

  // ── WebSocket lifecycle ──

  protected connectWebSocket(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return;
    if (!this.canConnectWebSocket()) return;

    try {
      this.ws = new WebSocket(this.getWebSocketUrl());

      this.ws.onopen = () => {
        this.wsConnected = true;
        this.onWebSocketOpen();
        this.startPing();
      };

      this.ws.onmessage = (event) => {
        this.onWebSocketMessage(event);
      };

      this.ws.onerror = (error) => {
        console.error(`[${this.getLabel()}] WebSocket error:`, error);
      };

      this.ws.onclose = () => {
        console.log(`[${this.getLabel()}] WebSocket closed`);
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
      console.error(`[${this.getLabel()}] Failed to create WebSocket:`, error);
      if (this.isRunning) {
        this.wsReconnectTimeout = setTimeout(() => {
          this.connectWebSocket();
        }, TIMING.WS_RECONNECT_FALLBACK);
      }
    }
  }

  protected startPing(): void {
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.sendPing();
      }
    }, TIMING.WS_PING_INTERVAL);
  }

  protected stopPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  protected startRestPolling(): void {
    this.restPollInterval = setInterval(async () => {
      if (!this.isRunning) return;
      await this.pollRest();
    }, TIMING.REST_POLLING_INTERVAL);
  }

  /**
   * Helper: fetch JSON with retry (wraps common pattern)
   */
  protected async fetchWithRetry<T>(
    fetchFn: () => Promise<T>,
    label: string
  ): Promise<T> {
    return withRetry(fetchFn, { maxAttempts: 3, baseDelay: 1000, label });
  }

  /**
   * Sort tickers by 24h USD volume descending and set top50/all ID lists
   */
  protected updateIdLists(tickersList: ProcessedTicker[]): void {
    tickersList.sort((a, b) => {
      const volA = (parseFloat(a.volCcy24h) || 0) * a.priceNum;
      const volB = (parseFloat(b.volCcy24h) || 0) * b.priceNum;
      return volB - volA;
    });

    this.top50Ids = tickersList.slice(0, UI.TOP50_COUNT).map(t => t.instId);
    this.allIds = tickersList.map(t => t.instId);
  }

  /**
   * Remove delisted tokens (tokens no longer in the current set)
   */
  protected removeDelisted(currentIds: Set<string>): boolean {
    let removed = false;
    for (const id of this.tickers.keys()) {
      if (!currentIds.has(id)) {
        this.tickers.delete(id);
        removed = true;
      }
    }
    return removed;
  }

  // ── Abstract methods — exchange-specific hooks ──

  /** Human-readable label for log messages */
  protected abstract getLabel(): string;

  /** WebSocket URL to connect to */
  protected abstract getWebSocketUrl(): string;

  /** Whether we can connect (e.g., need top50 IDs first for OKX) */
  protected canConnectWebSocket(): boolean { return true; }

  /** Send ping to keep WS alive */
  protected abstract sendPing(): void;

  /** Handle WS open — subscribe to channels */
  protected abstract onWebSocketOpen(): void;

  /** Handle WS message */
  protected abstract onWebSocketMessage(event: MessageEvent): void;

  /** Fetch all tickers for initial load */
  protected abstract fetchAllTickers(): Promise<void>;

  /** REST polling handler */
  protected abstract pollRest(): Promise<void>;
}
