'use client';

import { useCallback } from 'react';
import { useWidgetOrder } from './useWidgetOrder';
import { TabWidgetConfig } from '@/components/ExchangeBoard';
import { useExchangeStore } from './useExchangeStore';

/** Store type returned by useExchangeStore */
type ExchangeStoreReturn = ReturnType<typeof useExchangeStore>;

/**
 * Tab widget definition — describes what widgets a tab has and how to render them.
 *
 * `defaultOrder` is the ordered list of widget IDs for the tab.
 * `createWidgets` receives the store + click handlers and returns a map of widgetId → ReactNode.
 */
export interface TabWidgetDef {
  defaultOrder: string[];
  createWidgets: (ctx: WidgetContext) => Record<string, React.ReactNode>;
}

export interface WidgetContext {
  store: ExchangeStoreReturn;
  handleTokenClick: (symbol: string) => void;
  handleGroupClick: (symbols: string[]) => void;
}

/**
 * useBoardWidgets — extracts the repeated pattern of
 * "N × useWidgetOrder + handleTokenClick + handleGroupClick + tabWidgets memo"
 * that was duplicated in PerpBoard and HyperliquidBoard.
 *
 * @param store        The exchange store instance
 * @param tabDefs      Map of tabId → TabWidgetDef
 * @param storagePrefix  Prefix for localStorage keys (e.g. '' for OKX, 'hl-' for Hyperliquid)
 * @returns            { tabWidgets, handleTokenClick, handleGroupClick }
 */
export function useBoardWidgets(
  store: ExchangeStoreReturn,
  tabDefs: Record<string, TabWidgetDef>,
  storagePrefix: string = ''
) {
  // Token click handlers (shared across all widgets)
  const handleTokenClick = useCallback((symbol: string) => {
    store.setFilters({});
    store.setSearchTerm(symbol);
  }, [store]);

  const handleGroupClick = useCallback((symbols: string[]) => {
    store.setFilters({});
    store.setSearchTerm(symbols.join('|'));
  }, [store]);

  // Create useWidgetOrder hooks for each tab
  // We use a stable helper pattern: call useWidgetOrder for each known tab
  // Note: This must be called at the top level of a component, not inside a loop.
  // The caller is expected to pass a STATIC tabDefs object.
  const widgetOrders = useWidgetOrders(tabDefs, storagePrefix);

  // Build tabWidgets config
  const ctx: WidgetContext = { store, handleTokenClick, handleGroupClick };
  const tabWidgets: Record<string, TabWidgetConfig> = {};

  for (const [tabId, def] of Object.entries(tabDefs)) {
    const { order, setOrder } = widgetOrders[tabId];
    tabWidgets[tabId] = {
      order,
      setOrder,
      widgets: def.createWidgets(ctx),
    };
  }

  return { tabWidgets, handleTokenClick, handleGroupClick };
}

/**
 * Internal hook that creates useWidgetOrder for up to 8 tabs.
 * This works around the Rules of Hooks requirement that hooks
 * cannot be called inside loops/conditions.
 *
 * The tabDefs keys MUST be stable across renders.
 */
function useWidgetOrders(
  tabDefs: Record<string, TabWidgetDef>,
  prefix: string
): Record<string, { order: string[]; setOrder: (o: string[]) => void }> {
  const entries = Object.entries(tabDefs);

  // We call useWidgetOrder unconditionally for each slot (up to 8).
  // Unused slots get a dummy value but the hook is still called.
  const EMPTY: string[] = [];
  const slot0 = useWidgetOrder(`${prefix}${entries[0]?.[0] ?? '__unused0'}`, entries[0]?.[1]?.defaultOrder ?? EMPTY);
  const slot1 = useWidgetOrder(`${prefix}${entries[1]?.[0] ?? '__unused1'}`, entries[1]?.[1]?.defaultOrder ?? EMPTY);
  const slot2 = useWidgetOrder(`${prefix}${entries[2]?.[0] ?? '__unused2'}`, entries[2]?.[1]?.defaultOrder ?? EMPTY);
  const slot3 = useWidgetOrder(`${prefix}${entries[3]?.[0] ?? '__unused3'}`, entries[3]?.[1]?.defaultOrder ?? EMPTY);
  const slot4 = useWidgetOrder(`${prefix}${entries[4]?.[0] ?? '__unused4'}`, entries[4]?.[1]?.defaultOrder ?? EMPTY);
  const slot5 = useWidgetOrder(`${prefix}${entries[5]?.[0] ?? '__unused5'}`, entries[5]?.[1]?.defaultOrder ?? EMPTY);
  const slot6 = useWidgetOrder(`${prefix}${entries[6]?.[0] ?? '__unused6'}`, entries[6]?.[1]?.defaultOrder ?? EMPTY);
  const slot7 = useWidgetOrder(`${prefix}${entries[7]?.[0] ?? '__unused7'}`, entries[7]?.[1]?.defaultOrder ?? EMPTY);

  const slots = [slot0, slot1, slot2, slot3, slot4, slot5, slot6, slot7];
  const result: Record<string, { order: string[]; setOrder: (o: string[]) => void }> = {};

  for (let i = 0; i < entries.length && i < 8; i++) {
    const [tabId] = entries[i];
    const [order, setOrder] = slots[i];
    result[tabId] = { order, setOrder };
  }

  return result;
}
