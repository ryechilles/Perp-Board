/**
 * MarketStore — external store for high-frequency market data.
 *
 * Holds the per-exchange data maps OUTSIDE React state so components can
 * subscribe to a single instrument's slice instead of the whole table.
 *
 * Two subscription levels:
 *  - global   (`subscribe` / `getSnapshot`)  → used by the derived data layer
 *    (filterAndSort / averages / counts) in useExchangeStore.
 *  - per-key  (`subscribeInst` / `subscribeBase` / `subscribeSpot`) → used by
 *    individual table rows via the selector hooks. A write only notifies the
 *    keys whose value actually changed (value diff), so a price tick on one
 *    instrument re-renders only that row.
 */

import {
  ProcessedTicker,
  RSIData,
  FundingRateData,
  ListingData,
  MarketCapData,
} from '@/lib/types';

export interface MarketSnapshot {
  tickers: Map<string, ProcessedTicker>;
  rsiData: Map<string, RSIData>;
  fundingRateData: Map<string, FundingRateData>;
  listingData: Map<string, ListingData>;
  marketCapData: Map<string, MarketCapData>;
  spotSymbols: Set<string>;
  /** Bumped on every committed change so getSnapshot returns a new reference. */
  version: number;
}

type Listener = () => void;

/** Diff `next` against `prev`, reusing unchanged value references. */
function diffReplace<T>(
  prev: Map<string, T>,
  next: Map<string, T>,
  eq: (a: T, b: T) => boolean
): { merged: Map<string, T>; changed: string[]; structureChanged: boolean } {
  const merged = new Map<string, T>();
  const changed: string[] = [];
  let structureChanged = prev.size !== next.size;

  for (const [k, v] of next) {
    const old = prev.get(k);
    if (old !== undefined && eq(old, v)) {
      merged.set(k, old); // reuse old reference → no notify
    } else {
      merged.set(k, v);
      changed.push(k);
      if (old === undefined) structureChanged = true;
    }
  }

  if (!structureChanged) {
    for (const k of prev.keys()) {
      if (!next.has(k)) {
        structureChanged = true;
        break;
      }
    }
  }

  return { merged, changed, structureChanged };
}

const tickerEq = (a: ProcessedTicker, b: ProcessedTicker) =>
  a.priceNum === b.priceNum &&
  a.changeNum === b.changeNum &&
  a.volCcy24h === b.volCcy24h;

const fundingEq = (a: FundingRateData, b: FundingRateData) =>
  a.fundingRate === b.fundingRate &&
  a.nextFundingRate === b.nextFundingRate &&
  a.settlementInterval === b.settlementInterval &&
  a.fundingTime === b.fundingTime;

const listingEq = (a: ListingData, b: ListingData) =>
  a.listTime === b.listTime && a.instCategory === b.instCategory;

export class MarketStore {
  private snapshot: MarketSnapshot = {
    tickers: new Map(),
    rsiData: new Map(),
    fundingRateData: new Map(),
    listingData: new Map(),
    marketCapData: new Map(),
    spotSymbols: new Set(),
    version: 0,
  };

  private globalListeners = new Set<Listener>();
  private instListeners = new Map<string, Set<Listener>>(); // ticker / rsi / funding / listing
  private baseListeners = new Map<string, Set<Listener>>(); // marketCap (keyed by baseSymbol)
  private spotListeners = new Set<Listener>();

  // ───────────────────────── global subscription ─────────────────────────
  subscribe = (l: Listener): (() => void) => {
    this.globalListeners.add(l);
    return () => {
      this.globalListeners.delete(l);
    };
  };

  getSnapshot = (): MarketSnapshot => this.snapshot;

  // ───────────────────────── per-key subscription ────────────────────────
  subscribeInst(instId: string, l: Listener): () => void {
    return this.addKeyListener(this.instListeners, instId, l);
  }

  subscribeBase(baseSymbol: string, l: Listener): () => void {
    return this.addKeyListener(this.baseListeners, baseSymbol, l);
  }

  subscribeSpot(l: Listener): () => void {
    this.spotListeners.add(l);
    return () => {
      this.spotListeners.delete(l);
    };
  }

  private addKeyListener(
    bucket: Map<string, Set<Listener>>,
    key: string,
    l: Listener
  ): () => void {
    let set = bucket.get(key);
    if (!set) {
      set = new Set();
      bucket.set(key, set);
    }
    set.add(l);
    return () => {
      const s = bucket.get(key);
      if (s) {
        s.delete(l);
        if (s.size === 0) bucket.delete(key);
      }
    };
  }

  // ───────────────────────── per-key getters ─────────────────────────────
  getTicker = (id: string): ProcessedTicker | undefined => this.snapshot.tickers.get(id);
  getRsi = (id: string): RSIData | undefined => this.snapshot.rsiData.get(id);
  getFunding = (id: string): FundingRateData | undefined => this.snapshot.fundingRateData.get(id);
  getListing = (id: string): ListingData | undefined => this.snapshot.listingData.get(id);
  getMarketCap = (base: string): MarketCapData | undefined => this.snapshot.marketCapData.get(base);
  hasSpot = (key: string): boolean => this.snapshot.spotSymbols.has(key);

  // ───────────────────────── notification helpers ────────────────────────
  private notifyGlobal() {
    this.globalListeners.forEach((l) => l());
  }
  private notifyKeys(bucket: Map<string, Set<Listener>>, keys: Iterable<string>) {
    for (const key of keys) {
      const s = bucket.get(key);
      if (s) s.forEach((l) => l());
    }
  }

  private commit(patch: Partial<MarketSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch, version: this.snapshot.version + 1 };
    this.notifyGlobal();
  }

  // ───────────────────────── writes ──────────────────────────────────────
  /** Full ticker replacement (WS / REST). Reuses refs for unchanged tickers. */
  setTickers(next: Map<string, ProcessedTicker>) {
    const { merged, changed, structureChanged } = diffReplace(
      this.snapshot.tickers,
      next,
      tickerEq
    );
    if (changed.length === 0 && !structureChanged) return;
    this.commit({ tickers: merged });
    this.notifyKeys(this.instListeners, changed);
  }

  /** Replace the whole RSI map (initial / cache load). */
  setRsi(next: Map<string, RSIData>) {
    const prev = this.snapshot.rsiData;
    const changed: string[] = [];
    for (const [k, v] of next) {
      if (prev.get(k) !== v) changed.push(k);
    }
    let structureChanged = prev.size !== next.size;
    if (!structureChanged) {
      for (const k of prev.keys()) {
        if (!next.has(k)) {
          structureChanged = true;
          break;
        }
      }
    }
    if (changed.length === 0 && !structureChanged) return;
    this.commit({ rsiData: new Map(next) });
    this.notifyKeys(this.instListeners, changed);
  }

  /** Merge a batch of RSI updates (the hot path). */
  mergeRsi(entries: Array<[string, RSIData]>) {
    if (entries.length === 0) return;
    const map = new Map(this.snapshot.rsiData);
    for (const [id, data] of entries) map.set(id, data);
    this.commit({ rsiData: map });
    this.notifyKeys(this.instListeners, entries.map(([id]) => id));
  }

  /** Full funding replacement. Reuses refs for unchanged entries. */
  setFunding(next: Map<string, FundingRateData>) {
    const { merged, changed, structureChanged } = diffReplace(
      this.snapshot.fundingRateData,
      next,
      fundingEq
    );
    if (changed.length === 0 && !structureChanged) return;
    this.commit({ fundingRateData: merged });
    this.notifyKeys(this.instListeners, changed);
  }

  /** Set listing data (OKX initial load). */
  setListing(next: Map<string, ListingData>) {
    const { merged, changed, structureChanged } = diffReplace(
      this.snapshot.listingData,
      next,
      listingEq
    );
    if (changed.length === 0 && !structureChanged) return;
    this.commit({ listingData: merged });
    this.notifyKeys(this.instListeners, changed);
  }

  /** Full market-cap replacement (infrequent). Notifies all base listeners. */
  setMarketCap(next: Map<string, MarketCapData>) {
    const affected = new Set<string>([
      ...this.snapshot.marketCapData.keys(),
      ...next.keys(),
    ]);
    this.commit({ marketCapData: next });
    this.notifyKeys(this.baseListeners, affected);
  }

  /** Set spot symbols (typically once). */
  setSpot(next: Set<string>) {
    this.commit({ spotSymbols: next });
    this.spotListeners.forEach((l) => l());
  }

  /** Remove orphaned rsi/listing entries for delisted instruments. */
  prune(validKeys: Set<string>) {
    const removed: string[] = [];
    const patch: Partial<MarketSnapshot> = {};

    const prunedRsi = this.pruneMap(this.snapshot.rsiData, validKeys, removed);
    if (prunedRsi) patch.rsiData = prunedRsi;

    const prunedListing = this.pruneMap(this.snapshot.listingData, validKeys, removed);
    if (prunedListing) patch.listingData = prunedListing;

    if (Object.keys(patch).length === 0) return;
    this.commit(patch);
    this.notifyKeys(this.instListeners, removed);
  }

  private pruneMap<T>(
    map: Map<string, T>,
    validKeys: Set<string>,
    removed: string[]
  ): Map<string, T> | null {
    let hasOrphans = false;
    for (const key of map.keys()) {
      if (!validKeys.has(key)) {
        hasOrphans = true;
        break;
      }
    }
    if (!hasOrphans) return null;
    const pruned = new Map<string, T>();
    for (const [k, v] of map) {
      if (validKeys.has(k)) pruned.set(k, v);
      else removed.push(k);
    }
    return pruned;
  }
}

export function createMarketStore(): MarketStore {
  return new MarketStore();
}
