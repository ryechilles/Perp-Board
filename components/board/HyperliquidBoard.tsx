'use client';

import { useHyperliquidStore } from '@/hooks/useHyperliquidStore';
import { useBoardWidgets, TabWidgetDef } from '@/hooks/useBoardWidgets';
import { HlpVault } from '@/components/insights/HlpVault';
import { getSharedTabWidgetDefs } from '@/components/insights/tabs';
import { ExchangeBoard, TabConfig } from './ExchangeBoard';

const EXCHANGE_LABEL = 'Hyperliquid';

const TABS: TabConfig[] = [
  { id: 'rsi', label: 'RSI' },
  { id: 'funding', label: 'Funding' },
  { id: 'altcoin', label: 'Altcoin' },
  { id: 'btc', label: 'BTC' },
  { id: 'hlp', label: 'HLP' },
];

// Hyperliquid widget defs = shared widgets (with label) + HLP (HL-only)
const TAB_WIDGET_DEFS: Record<string, TabWidgetDef> = {
  ...getSharedTabWidgetDefs(EXCHANGE_LABEL),
  hlp: {
    defaultOrder: ['hlpVault'],
    createWidgets: () => ({
      hlpVault: <HlpVault />,
    }),
  },
};

export default function HyperliquidBoard() {
  const store = useHyperliquidStore();
  const { tabWidgets } = useBoardWidgets(store, TAB_WIDGET_DEFS, 'hl-');

  return (
    <ExchangeBoard
      store={store}
      exchange="hyperliquid"
      tabs={TABS}
      tabWidgets={tabWidgets}
    />
  );
}
