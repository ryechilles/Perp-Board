/**
 * Unified Cache Manager
 * Provides consistent caching with TTL support for all app data
 */

import { CACHE_KEYS, TIMING, MA_FLOW, APP_VERSION } from '../constants';
import { RSIData, MarketCapData, MAFlowData } from '../types';

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

// ===========================================
// Cache Configurations
// ===========================================

export const CACHE_CONFIG: Record<string, CacheConfig> = {
  rsi: {
    key: CACHE_KEYS.RSI_CACHE,
    ttl: TIMING.CACHE_RSI,
  },
  marketCap: {
    key: CACHE_KEYS.MARKET_CAP_CACHE,
    ttl: TIMING.CACHE_MARKET_CAP,
  },
  logo: {
    key: CACHE_KEYS.LOGO_CACHE,
    ttl: TIMING.CACHE_LOGO,
  },
  maFlow: {
    key: CACHE_KEYS.MA_FLOW_CACHE,
    ttl: MA_FLOW.CACHE_TTL,
  },
  favorites: {
    key: CACHE_KEYS.FAVORITES,
    ttl: Infinity, // Never expires
  },
  columns: {
    key: CACHE_KEYS.COLUMNS,
    ttl: Infinity,
  },
  columnOrder: {
    key: CACHE_KEYS.COLUMN_ORDER,
    ttl: Infinity,
  },
  filters: {
    key: CACHE_KEYS.FILTERS,
    ttl: Infinity,
  },
};

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
// Specialized Cache Helpers
// ===========================================

/**
 * Get RSI data from cache
 */
export function getRsiCache(): Map<string, RSIData> | null {
  const entry = getCache<Record<string, RSIData>>(CACHE_KEYS.RSI_CACHE);
  if (!isCacheValid(entry, TIMING.CACHE_RSI)) return null;

  if (!entry) return null;
  console.log(`[Cache] Loaded RSI cache (${getCacheAge(entry)}min old)`);
  return new Map(Object.entries(entry.data));
}

/**
 * Save RSI data to cache
 */
export function setRsiCache(data: Map<string, RSIData>): boolean {
  return setCache(CACHE_KEYS.RSI_CACHE, Object.fromEntries(data));
}

/**
 * Get Market Cap data from cache
 */
export function getMarketCapCache(): Map<string, MarketCapData> | null {
  const entry = getCache<Record<string, MarketCapData>>(CACHE_KEYS.MARKET_CAP_CACHE);
  if (!isCacheValid(entry, TIMING.CACHE_MARKET_CAP)) return null;

  if (!entry) return null;
  console.log(`[Cache] Loaded market cap cache (${getCacheAge(entry)}min old)`);
  return new Map(Object.entries(entry.data)) as Map<string, MarketCapData>;
}

/**
 * Save Market Cap data to cache
 */
export function setMarketCapCache(data: Map<string, MarketCapData>): boolean {
  return setCache(CACHE_KEYS.MARKET_CAP_CACHE, Object.fromEntries(data));
}

/**
 * Get Logo cache
 */
export function getLogoCache(): Record<string, string> {
  const entry = getCache<Record<string, string>>(CACHE_KEYS.LOGO_CACHE);
  if (!isCacheValid(entry, TIMING.CACHE_LOGO) || !entry) return {};
  return entry.data;
}

/**
 * Save Logo cache
 */
export function setLogoCache(logos: Record<string, string>): boolean {
  return setCache(CACHE_KEYS.LOGO_CACHE, logos);
}

/**
 * Get favorites from cache
 */
export function getFavoritesCache(): string[] {
  const entry = getCache<string[]>(CACHE_KEYS.FAVORITES);
  return entry?.data ?? [];
}

/**
 * Save favorites to cache
 */
export function setFavoritesCache(favorites: string[]): boolean {
  return setCache(CACHE_KEYS.FAVORITES, favorites);
}

/**
 * Get column order from cache
 */
export function getColumnOrderCache(): string[] | null {
  const entry = getCache<string[]>(CACHE_KEYS.COLUMN_ORDER);
  return entry?.data ?? null;
}

/**
 * Save column order to cache
 */
export function setColumnOrderCache(order: string[]): boolean {
  return setCache(CACHE_KEYS.COLUMN_ORDER, order);
}

/**
 * Get filters from cache
 */
export function getFiltersCache<T>(): T | null {
  const entry = getCache<T>(CACHE_KEYS.FILTERS);
  return entry?.data ?? null;
}

/**
 * Save filters to cache
 */
export function setFiltersCache<T>(filters: T): boolean {
  return setCache(CACHE_KEYS.FILTERS, filters);
}

/**
 * Get columns visibility from cache
 */
export function getColumnsCache<T>(): T | null {
  const entry = getCache<T>(CACHE_KEYS.COLUMNS);
  return entry?.data ?? null;
}

/**
 * Save columns visibility to cache
 */
export function setColumnsCache<T>(columns: T): boolean {
  return setCache(CACHE_KEYS.COLUMNS, columns);
}

// ===========================================
// MA Flow Cache Helpers
// ===========================================

/**
 * Get MA Flow data from cache
 */
export function getMAFlowCache(): Map<string, MAFlowData> | null {
  const entry = getCache<Record<string, MAFlowData>>(CACHE_KEYS.MA_FLOW_CACHE);
  if (!isCacheValid(entry, MA_FLOW.CACHE_TTL)) return null;
  if (!entry) return null;
  console.log(`[Cache] Loaded MA Flow cache (${getCacheAge(entry)}min old)`);
  return new Map(Object.entries(entry.data));
}

/**
 * Save MA Flow data to cache
 */
export function setMAFlowCache(data: Map<string, MAFlowData>): boolean {
  return setCache(CACHE_KEYS.MA_FLOW_CACHE, Object.fromEntries(data));
}

// ===========================================
// Hyperliquid-specific Cache Helpers
// ===========================================

export function getHlRsiCache(): Map<string, RSIData> | null {
  const entry = getCache<Record<string, RSIData>>(CACHE_KEYS.HL_RSI_CACHE);
  if (!isCacheValid(entry, TIMING.CACHE_RSI)) return null;
  if (!entry) return null;
  console.log(`[Cache] Loaded HL RSI cache (${getCacheAge(entry)}min old)`);
  return new Map(Object.entries(entry.data));
}

export function setHlRsiCache(data: Map<string, RSIData>): boolean {
  return setCache(CACHE_KEYS.HL_RSI_CACHE, Object.fromEntries(data));
}

export function getHlFavoritesCache(): string[] {
  const entry = getCache<string[]>(CACHE_KEYS.HL_FAVORITES);
  return entry?.data ?? [];
}

export function setHlFavoritesCache(favorites: string[]): boolean {
  return setCache(CACHE_KEYS.HL_FAVORITES, favorites);
}

export function getHlColumnOrderCache(): string[] | null {
  const entry = getCache<string[]>(CACHE_KEYS.HL_COLUMN_ORDER);
  return entry?.data ?? null;
}

export function setHlColumnOrderCache(order: string[]): boolean {
  return setCache(CACHE_KEYS.HL_COLUMN_ORDER, order);
}

export function getHlColumnsCache<T>(): T | null {
  const entry = getCache<T>(CACHE_KEYS.HL_COLUMNS);
  return entry?.data ?? null;
}

export function setHlColumnsCache<T>(columns: T): boolean {
  return setCache(CACHE_KEYS.HL_COLUMNS, columns);
}

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
