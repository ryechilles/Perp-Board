'use client';

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'perp-board-widget-order';

interface WidgetOrderState {
  [tabId: string]: string[];
}

/**
 * useWidgetOrder - Hook for managing and persisting widget order per tab
 *
 * @param tabId - The current tab identifier
 * @param defaultOrder - Default widget order for the tab
 * @returns [currentOrder, setOrder, resetOrder]
 *
 * @example
 * ```tsx
 * const [widgetOrder, setWidgetOrder, resetOrder] = useWidgetOrder('altcoin', ['topGainers', 'vsBtc']);
 *
 * <WidgetGrid
 *   sortable
 *   itemIds={widgetOrder}
 *   onOrderChange={setWidgetOrder}
 * >
 *   {widgetOrder.map(id => widgets[id])}
 * </WidgetGrid>
 * ```
 */
export function useWidgetOrder(
  tabId: string,
  defaultOrder: string[]
): [string[], (newOrder: string[]) => void, () => void] {
  const [order, setOrderState] = useState<string[]>(defaultOrder);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: WidgetOrderState = JSON.parse(stored);
        if (parsed[tabId] && Array.isArray(parsed[tabId])) {
          // Validate that all default items exist in stored order
          const storedOrder = parsed[tabId];
          const validOrder = storedOrder.filter((id) => defaultOrder.includes(id));
          // Add any new items that aren't in stored order
          const newItems = defaultOrder.filter((id) => !storedOrder.includes(id));
          setOrderState([...validOrder, ...newItems]);
        }
      }
    } catch (e) {
      console.warn('Failed to load widget order from localStorage:', e);
    }
  }, [tabId, defaultOrder]);

  // Save to localStorage when order changes
  const setOrder = useCallback(
    (newOrder: string[]) => {
      setOrderState(newOrder);
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        const parsed: WidgetOrderState = stored ? JSON.parse(stored) : {};
        parsed[tabId] = newOrder;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
      } catch (e) {
        console.warn('Failed to save widget order to localStorage:', e);
      }
    },
    [tabId]
  );

  // Reset to default order
  const resetOrder = useCallback(() => {
    setOrderState(defaultOrder);
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const parsed: WidgetOrderState = stored ? JSON.parse(stored) : {};
      delete parsed[tabId];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    } catch (e) {
      console.warn('Failed to reset widget order in localStorage:', e);
    }
  }, [tabId, defaultOrder]);

  return [order, setOrder, resetOrder];
}

export default useWidgetOrder;
