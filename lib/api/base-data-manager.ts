/**
 * Base Data Manager
 * Shared logic for WebSocket + REST hybrid data management.
 * OKX and Hyperliquid managers extend this class and implement exchange-specific hooks.
 */

import { ProcessedTicker, TickerUpdateCallback, StatusUpdateCallback } from '../types';
import { withRetry } from '../concurrency';
import { TIMING } from '../constants';
import { sameSet } from '../utils';

export abstract class BaseDataManager {
  protected ws: WebSocket | null = null;
  protected tickers: Map<string, ProcessedTicker> = new Map();
  protected onUpdate: TickerUpdateCallback;
  protected onStatus: StatusUpdateCallback;
  /**
   * Active universe (set by the controller via setUniverse). `tickers` holds the
   * FULL instrument list — needed to compute the universe and notice rank
   * changes — but only universe members are streamed (WS) and handed to the
   * store. null = not known yet (market cap / spot still loading): nothing is emitted,
   * so the table stays in its skeleton state instead of flashing every instrument.
   */
  protected universe: Set<string> | null = null;
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
   */
  protected scheduleUpdate(status?: 'connecting' | 'live' | 'error', time?: Date): void {
    if (status) this.statusPending = { status, time };
    if (this.updateScheduled) return;
    this.updateScheduled = true;
    requestAnimationFrame(() => {
      this.updateScheduled = false;
      if (!this.isRunning) return;
      this.emitTickers();
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

  /** Full instrument list (NOT universe-filtered) — input for universe selection. */
  getTickers(): Map<string, ProcessedTicker> {
    return new Map(this.tickers);
  }

  /**
   * Restrict streaming + emission to `ids`. No-op when unchanged; otherwise the
   * subclass adjusts its stream (onUniverseChange) and the new slice is flushed.
   */
  setUniverse(ids: Set<string>): void {
    if (this.universe && sameSet(this.universe, ids)) return;
    const prev = this.universe;
    this.universe = new Set(ids);
    this.onUniverseChange(prev, this.universe);
    if (this.isRunning) this.scheduleUpdate();
  }

  protected inUniverse(id: string): boolean {
    return this.universe?.has(id) ?? false;
  }

  /**
   * Hand the universe slice to the store. Skipped entirely while the universe is
   * unknown — an empty emit would make the store prune its (cached) RSI data.
   * The slice is a fresh Map (~70 entries), so the store never aliases our live map.
   */
  protected emitTickers(): void {
    if (!this.universe) return;
    const slice = new Map<string, ProcessedTicker>();
    for (const id of this.universe) {
      const t = this.tickers.get(id);
      if (t) slice.set(id, t);
    }
    this.onUpdate(slice);
  }

  // ── WebSocket lifecycle ──

  protected connectWebSocket(): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;
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
            this.wsReconnectTimeout = null;
            this.connectWebSocket();
          }, TIMING.WS_RECONNECT_DELAY);
        }
      };
    } catch (error) {
      console.error(`[${this.getLabel()}] Failed to create WebSocket:`, error);
      if (this.isRunning) {
        this.wsReconnectTimeout = setTimeout(() => {
          this.wsReconnectTimeout = null;
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
   * Remove delisted tokens (tokens no longer in the current set).
   * Returns true when a universe member was removed (i.e. the emitted slice changed).
   */
  protected removeDelisted(currentIds: Set<string>): boolean {
    let removedVisible = false;
    for (const id of this.tickers.keys()) {
      if (!currentIds.has(id)) {
        this.tickers.delete(id);
        if (this.inUniverse(id)) removedVisible = true;
      }
    }
    return removedVisible;
  }

  // ── Abstract methods — exchange-specific hooks ──

  /** Human-readable label for log messages */
  protected abstract getLabel(): string;

  /** WebSocket URL to connect to */
  protected abstract getWebSocketUrl(): string;

  /** Whether we can connect (e.g., OKX needs the universe to know what to subscribe) */
  protected canConnectWebSocket(): boolean { return true; }

  /** Universe changed — adjust the live stream (e.g. OKX re-subscribes the diff). */
  protected onUniverseChange(_prev: Set<string> | null, _next: Set<string>): void {
    void _prev;
    void _next;
  }

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
