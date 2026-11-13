'use client';

import { useMarketStore } from '@/hooks/useMarketStore';
import { useBoardWidgets, TabWidgetDef, WidgetContext } from '@/hooks/useBoardWidgets';
import { MaFlow } from '@/components/insights/MaFlow';
import { getSharedTabWidgetDefs } from '@/components/insights/tabs';
import { ExchangeBoard, TabConfig } from './ExchangeBoard';

const TABS: TabConfig[] = [
  { id: 'rsi', label: 'RSI' },
  { id: 'funding', label: 'Funding' },
  { id: 'altcoin', label: 'Altcoin' },
  { id: 'btc', label: 'BTC' },
  { id: 'maflow', label: 'MA Flow' },
];

// OKX widget defs = shared widgets + MA Flow (OKX-only)
const TAB_WIDGET_DEFS: Record<string, TabWidgetDef> = {
  ...getSharedTabWidgetDefs(),
  maflow: {
    defaultOrder: ['maFlow'],
    createWidgets: ({ store, handleTokenClick, handleGroupClick }: WidgetContext) => ({
      maFlow: (
        <MaFlow
          tickers={store.widgetTickers}
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

export default function OkxBoard() {
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
