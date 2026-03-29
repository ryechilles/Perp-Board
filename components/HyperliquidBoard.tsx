'use client';

import { useHyperliquidStore } from '@/hooks/useHyperliquidStore';
import { useBoardWidgets, TabWidgetDef } from '@/hooks/useBoardWidgets';
import { ExchangeBoard, TabConfig } from '@/components/ExchangeBoard';
import { HLPVault } from '@/components/HLPVault';
import { BtcLogo, getSharedTabWidgetDefs } from '@/components/shared-widgets';

const EXCHANGE_LABEL = 'Hyperliquid';

// Hyperliquid logo for HLP tab (official brand color #97FCE4)
const HlpTabIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 144 144" fill="#97FCE4" xmlns="http://www.w3.org/2000/svg">
    <path d="M144 71.6991C144 119.306 114.866 134.582 99.5156 120.98C86.8804 109.889 83.1211 86.4521 64.116 84.0456C39.9942 81.0113 37.9057 113.133 22.0334 113.133C3.5504 113.133 0 86.2428 0 72.4315C0 58.3063 3.96809 39.0542 19.736 39.0542C38.1146 39.0542 39.1588 66.5722 62.132 65.1073C85.0007 63.5379 85.4184 34.8689 100.247 22.6271C113.195 12.0593 144 23.4641 144 71.6991Z" />
  </svg>
);

const TABS: TabConfig[] = [
  { id: 'rsi', label: 'RSI' },
  { id: 'funding', label: 'Funding' },
  { id: 'altcoin', label: 'Altcoin' },
  { id: 'btc', label: 'BTC', icon: <BtcLogo /> },
  { id: 'hlp', label: 'HLP', icon: <HlpTabIcon /> },
];

// Hyperliquid widget defs = shared widgets (with label) + HLP (HL-only)
const TAB_WIDGET_DEFS: Record<string, TabWidgetDef> = {
  ...getSharedTabWidgetDefs(EXCHANGE_LABEL),
  hlp: {
    defaultOrder: ['hlpVault'],
    createWidgets: () => ({
      hlpVault: <HLPVault />,
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
