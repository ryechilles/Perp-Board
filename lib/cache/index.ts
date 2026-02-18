/**
 * Unified Cache Manager with Factory Pattern
 * Provides consistent caching with TTL support for all app data
 */

import { CACHE_KEYS, TIMING, MA_FLOW, APP_VERSION } from '../constants';
import { RSIData, MarketCapData, MAFlowData, ColumnVisibility, Filters } from '../types';

// ===========================================
// Types
// ===========================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

interface CacheConfig {
  key: string;
  ttl: number; // Time to live in milliseconds
}

// Generic cache interface returned by factories
interface CacheApi<T> {
  get(): T | null;
  set(data: T): boolean;
}

// ===========================================
// Core Cache Functions
// ===========================================

/**
 * Check if we're in browser environment
 */
function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

/**
 * Get item from localStorage with type safety
 */
export function getCache<T>(key: string): CacheEntry<T> | null {
  if (!isBrowser()) return null;

  try {
    const cached = localStorage.getItem(key);
    if (!cached) return null;

    const parsed = JSON.parse(cached);

    // Handle both old format (direct data) and new format (with timestamp)
    if (parsed && typeof parsed === 'object' && 'data' in parsed && 'timestamp' in parsed) {
      return parsed as CacheEntry<T>;
    }

    // Legacy format: wrap in CacheEntry
    return {
      data: parsed as T,
      timestamp: Date.now(),
    };
  } catch (e) {
    console.warn(`[Cache] Failed to read ${key}:`, e);
    return null;
  }
}

/**
 * Set item in localStorage with timestamp
 */
export function setCache<T>(key: string, data: T): boolean {
  if (!isBrowser()) return false;

  try {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
    };
    localStorage.setItem(key, JSON.stringify(entry));
    return true;
  } catch (e) {
    console.warn(`[Cache] Failed to write ${key}:`, e);
    return false;
  }
}

/**
 * Remove item from localStorage
 */
export function removeCache(key: string): boolean {
  if (!isBrowser()) return false;

  try {
    localStorage.removeItem(key);
    return true;
  } catch (e) {
    console.warn(`[Cache] Failed to remove ${key}:`, e);
    return false;
  }
}

/**
 * Check if cache entry is still valid (not expired)
 */
export function isCacheValid<T>(entry: CacheEntry<T> | null, ttl: number): boolean {
  if (!entry) return false;
  if (ttl === Infinity) return true;
  return Date.now() - entry.timestamp < ttl;
}

/**
 * Get cache age in minutes
 */
export function getCacheAge(entry: CacheEntry<unknown> | null): number {
  if (!entry) return Infinity;
  return Math.round((Date.now() - entry.timestamp) / 1000 / 60);
}

// ===========================================
// Cache Factory Functions
// ===========================================

/**
 * Factory for creating Map<string, T> caches with TTL
 * Handles serialization: Map <-> Object
 */
export function createMapCache<T>(key: string, ttl: number): CacheApi<Map<string, T>> {
  return {
    get(): Map<string, T> | null {
      const entry = getCache<Record<string, T>>(key);
      if (!isCacheValid(entry, ttl)) return null;
      if (!entry) return null;
      console.log(`[Cache] Loaded ${key} cache (${getCacheAge(entry)}min old)`);
      return new Map(Object.entries(entry.data));
    },
    set(data: Map<string, T>): boolean {
      return setCache(key, Object.fromEntries(data));
    },
  };
}

/**
 * Factory for creating value caches with TTL
 * Handles any serializable T type
 */
export function createValueCache<T>(key: string, ttl: number): CacheApi<T> {
  return {
    get(): T | null {
      const entry = getCache<T>(key);
      if (!isCacheValid(entry, ttl)) return null;
      if (!entry) return null;
      console.log(`[Cache] Loaded ${key} cache (${getCacheAge(entry)}min old)`);
      return entry.data;
    },
    set(data: T): boolean {
      return setCache(key, data);
    },
  };
}

/**
 * Factory for creating array caches (no TTL - infinite)
 */
export function createArrayCache<T>(key: string): CacheApi<T[]> {
  return {
    get(): T[] {
      const entry = getCache<T[]>(key);
      return entry?.data ?? [];
    },
    set(data: T[]): boolean {
      return setCache(key, data);
    },
  };
}

// ===========================================
// Cache Instances
// ===========================================

// Map caches (with TTL, serializes Map<->Object)
export const rsiCache = createMapCache<RSIData>(CACHE_KEYS.RSI_CACHE, TIMING.CACHE_RSI);
export const hlRsiCache = createMapCache<RSIData>(CACHE_KEYS.HL_RSI_CACHE, TIMING.CACHE_RSI);
export const marketCapCache = createMapCache<MarketCapData>(CACHE_KEYS.MARKET_CAP_CACHE, TIMING.CACHE_MARKET_CAP);
export const maFlowCache = createMapCache<MAFlowData>(CACHE_KEYS.MA_FLOW_CACHE, MA_FLOW.CACHE_TTL);

// Value caches (with TTL)
export const logoCache = createValueCache<Record<string, string>>(CACHE_KEYS.LOGO_CACHE, TIMING.CACHE_LOGO);
export const columnsCache = createValueCache<ColumnVisibility>(CACHE_KEYS.COLUMNS, Infinity);
export const hlColumnsCache = createValueCache<ColumnVisibility>(CACHE_KEYS.HL_COLUMNS, Infinity);
export const filtersCache = createValueCache<Filters>(CACHE_KEYS.FILTERS, Infinity);

// Array caches (no TTL)
export const favoritesCache = createArrayCache<string>(CACHE_KEYS.FAVORITES);
export const hlFavoritesCache = createArrayCache<string>(CACHE_KEYS.HL_FAVORITES);
export const columnOrderCache = createArrayCache<string>(CACHE_KEYS.COLUMN_ORDER);
export const hlColumnOrderCache = createArrayCache<string>(CACHE_KEYS.HL_COLUMN_ORDER);

// ===========================================
// Convenience Wrappers (still used by API modules)
// ===========================================

// Market Cap Cache
export const getMarketCapCache = () => marketCapCache.get();
export const setMarketCapCache = (data: Map<string, MarketCapData>) => marketCapCache.set(data);

// MA Flow Cache
export const getMAFlowCache = () => maFlowCache.get();
export const setMAFlowCache = (data: Map<string, MAFlowData>) => maFlowCache.set(data);

// Logo Cache
export const getLogoCache = () => logoCache.get() ?? {};
export const setLogoCache = (logos: Record<string, string>) => logoCache.set(logos);

// ===========================================
// Cache Management
// ===========================================

/**
 * Clear all cache entries
 */
export function clearAllCache(): void {
  if (!isBrowser()) return;

  Object.values(CACHE_KEYS).forEach(key => {
    removeCache(key);
  });
  console.log('[Cache] All cache cleared');
}

/**
 * Clear only data caches (keep user preferences)
 */
export function clearDataCache(): void {
  if (!isBrowser()) return;

  const dataCacheKeys = [
    CACHE_KEYS.RSI_CACHE,
    CACHE_KEYS.MARKET_CAP_CACHE,
    CACHE_KEYS.LOGO_CACHE,
    CACHE_KEYS.MA_FLOW_CACHE,
  ];

  dataCacheKeys.forEach(key => {
    removeCache(key);
  });
  console.log('[Cache] Data cache cleared');
}

/**
 * Get cache statistics
 */
export function getCacheStats(): Record<string, { size: number; age: number | null }> {
  if (!isBrowser()) return {};

  const stats: Record<string, { size: number; age: number | null }> = {};

  Object.entries(CACHE_KEYS).forEach(([name, key]) => {
    const cached = localStorage.getItem(key);
    if (cached) {
      const entry = getCache<unknown>(key);
      stats[name] = {
        size: cached.length,
        age: entry ? getCacheAge(entry) : null,
      };
    }
  });

  return stats;
}

// ===========================================
// Version-based Cache Invalidation
// ===========================================

/**
 * Check app version and clear data cache if version changed
 * This ensures users always see the latest data after an update
 * User preferences (favorites, columns, filters) are preserved
 */
export function checkVersionAndClearCache(): boolean {
  if (!isBrowser()) return false;

  try {
    const storedVersion = localStorage.getItem(CACHE_KEYS.APP_VERSION);

    if (storedVersion !== APP_VERSION) {
      console.log(`[Cache] Version changed: ${storedVersion} → ${APP_VERSION}`);

      // Clear data caches (keep user preferences)
      clearDataCache();

      // Update stored version
      localStorage.setItem(CACHE_KEYS.APP_VERSION, APP_VERSION);

      console.log('[Cache] Data cache cleared due to version update');
      return true; // Cache was cleared
    }

    return false; // No change needed
  } catch (e) {
    console.warn('[Cache] Failed to check version:', e);
    return false;
  }
}

/**
 * Get current app version
 */
export function getAppVersion(): string {
  return APP_VERSION;
}

/**
 * Get stored app version
 */
export function getStoredVersion(): string | null {
  if (!isBrowser()) return null;
  return localStorage.getItem(CACHE_KEYS.APP_VERSION);
}

// ===========================================
// Exchange Cache Selector
// ===========================================

/**
 * Get the appropriate cache instances for a given exchange
 */
export function getCacheForExchange(exchange: 'okx' | 'hyperliquid') {
  const isHL = exchange === 'hyperliquid';
  return {
    rsi: isHL ? hlRsiCache : rsiCache,
    columns: isHL ? hlColumnsCache : columnsCache,
    columnOrder: isHL ? hlColumnOrderCache : columnOrderCache,
    favorites: isHL ? hlFavoritesCache : favoritesCache,
    filters: filtersCache, // shared across exchanges
  };
}
