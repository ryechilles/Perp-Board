'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { getCacheForExchange } from '@/lib/cache';

/**
 * Hook for managing favorite tokens
 */
export function useFavorites(exchange: 'okx' | 'hyperliquid' = 'okx') {
  const cache = useMemo(() => getCacheForExchange(exchange), [exchange]);
  const [favorites, setFavorites] = useState<string[]>([]);

  // Load favorites from cache on mount
  useEffect(() => {
    const savedFavorites = cache.favorites.get();
    if (savedFavorites && savedFavorites.length > 0) {
      setFavorites(savedFavorites);
    }
  }, [cache]);

  // Toggle favorite status for a token
  const toggleFavorite = useCallback((instId: string) => {
    setFavorites(prev => {
      const newFavorites = prev.includes(instId)
        ? prev.filter(f => f !== instId)
        : [...prev, instId];
      cache.favorites.set(newFavorites);
      return newFavorites;
    });
  }, [cache]);

  // Check if a token is favorited
  const isFavorite = useCallback((instId: string) => {
    return favorites.includes(instId);
  }, [favorites]);

  // Direct setter for URL state sync
  const setFavoritesDirectly = useCallback((newFavorites: string[]) => {
    setFavorites(newFavorites);
    cache.favorites.set(newFavorites);
  }, [cache]);

  return {
    favorites,
    toggleFavorite,
    isFavorite,
    setFavoritesDirectly,
  };
}
