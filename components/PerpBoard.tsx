'use client';

import { useMarketStore } from '@/hooks/useMarketStore';
import { useBoardWidgets, TabWidgetDef, WidgetContext } from '@/hooks/useBoardWidgets';
import { ExchangeBoard, TabConfig } from '@/components/ExchangeBoard';
import { MAFlowWidget } from '@/components/MAFlowWidget';
import { BtcLogo, getSharedTabWidgetDefs } from '@/components/shared-widgets';

const TABS: TabConfig[] = [
  { id: 'rsi', label: 'RSI' },
  { id: 'funding', label: 'Funding' },
  { id: 'altcoin', label: 'Altcoin' },
  { id: 'btc', label: 'BTC', icon: <BtcLogo /> },
  { id: 'maflow', label: 'MA Flow' },
];

// OKX widget defs = shared widgets + MA Flow (OKX-only)
const TAB_WIDGET_DEFS: Record<string, TabWidgetDef> = {
  ...getSharedTabWidgetDefs(),
  maflow: {
    defaultOrder: ['maFlow'],
    createWidgets: ({ store, handleTokenClick, handleGroupClick }: WidgetContext) => ({
      maFlow: (
        <MAFlowWidget
          tickers={store.universeTickers}
          maFlowData={store.maFlowData}
          marketCapData={store.marketCapData}
          listingData={store.listingData}
          onTokenClick={handleTokenClick}
          onGroupClick={handleGroupClick}
        />
      ),
    }),
  },
};

export default function PerpBoard() {
  const store = useMarketStore();
  const { tabWidgets } = useBoardWidgets(store, TAB_WIDGET_DEFS);

  return (
    <ExchangeBoard
      store={store}
      exchange="okx"
      tabs={TABS}
      tabWidgets={tabWidgets}
      enableUrlState
    />
  );
}
