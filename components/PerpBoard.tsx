'use client';

import { useMarketStore } from '@/hooks/useMarketStore';
import { useBoardWidgets, TabWidgetDef, WidgetContext } from '@/hooks/useBoardWidgets';
import { ExchangeBoard, TabConfig } from '@/components/ExchangeBoard';
import { AltcoinTopGainers } from '@/components/AltcoinTopGainers';
import { AltcoinVsBTC } from '@/components/AltcoinVsBTC';
import { FundingKiller } from '@/components/FundingKiller';
import { FundingMarket } from '@/components/FundingMarket';
import { MarketMomentum } from '@/components/MarketMomentum';
import { RsiOversold } from '@/components/RsiOversold';
import { RsiOverbought } from '@/components/RsiOverbought';
import { AHR999Indicator } from '@/components/AHR999Indicator';
import { BTCDominance } from '@/components/BTCDominance';
import { EthBtcRatio } from '@/components/EthBtcRatio';
import { Total2MiniChart } from '@/components/Total2MiniChart';
import { MAFlowWidget } from '@/components/MAFlowWidget';

// Bitcoin logo for BTC tab
const BtcLogo = () => (
  <img
    src="https://assets.coingecko.com/coins/images/1/small/bitcoin.png"
    alt="BTC"
    className="w-4 h-4 rounded-full"
  />
);

const TABS: TabConfig[] = [
  { id: 'rsi', label: 'RSI' },
  { id: 'funding', label: 'Funding' },
  { id: 'altcoin', label: 'Altcoin' },
  { id: 'btc', label: 'BTC', icon: <BtcLogo /> },
  { id: 'maflow', label: 'MA Flow' },
];

// ── Widget definitions (static — no hooks, no state) ──

function createRsiWidgets({ store, handleTokenClick }: WidgetContext) {
  const { avgRsi7, avgRsi14 } = store.getRsiAverages();
  return {
    marketMomentum: <MarketMomentum avgRsi7={avgRsi7} avgRsi14={avgRsi14} />,
    rsiOversold: (
      <RsiOversold
        tickers={store.tickers}
        rsiData={store.rsiData}
        marketCapData={store.marketCapData}
        onTokenClick={handleTokenClick}
      />
    ),
    rsiOverbought: (
      <RsiOverbought
        tickers={store.tickers}
        rsiData={store.rsiData}
        marketCapData={store.marketCapData}
        onTokenClick={handleTokenClick}
      />
    ),
  };
}

function createFundingWidgets({ store, handleTokenClick, handleGroupClick }: WidgetContext) {
  return {
    fundingMarket: (
      <FundingMarket
        tickers={store.tickers}
        fundingRateData={store.fundingRateData}
        marketCapData={store.marketCapData}
        onGroupClick={handleGroupClick}
      />
    ),
    fundingKiller: (
      <FundingKiller
        tickers={store.tickers}
        fundingRateData={store.fundingRateData}
        marketCapData={store.marketCapData}
        onTokenClick={handleTokenClick}
        onGroupClick={handleGroupClick}
      />
    ),
  };
}

function createAltcoinWidgets({ store, handleTokenClick, handleGroupClick }: WidgetContext) {
  return {
    topGainers: (
      <AltcoinTopGainers
        tickers={store.tickers}
        rsiData={store.rsiData}
        marketCapData={store.marketCapData}
        onTokenClick={handleTokenClick}
      />
    ),
    vsBtc: (
      <AltcoinVsBTC
        tickers={store.tickers}
        rsiData={store.rsiData}
        marketCapData={store.marketCapData}
        onTokenClick={handleTokenClick}
        onTopNClick={handleGroupClick}
      />
    ),
    ethBtcRatio: <EthBtcRatio />,
    total2: <Total2MiniChart />,
  };
}

function createBtcWidgets() {
  return {
    btcDominance: <BTCDominance />,
    ahr999: <AHR999Indicator />,
  };
}

function createMaFlowWidgets({ store, handleTokenClick, handleGroupClick }: WidgetContext) {
  return {
    maFlow: (
      <MAFlowWidget
        tickers={store.tickers}
        maFlowData={store.maFlowData}
        marketCapData={store.marketCapData}
        listingData={store.listingData}
        onTokenClick={handleTokenClick}
        onGroupClick={handleGroupClick}
      />
    ),
  };
}

const TAB_WIDGET_DEFS: Record<string, TabWidgetDef> = {
  rsi: {
    defaultOrder: ['marketMomentum', 'rsiOversold', 'rsiOverbought'],
    createWidgets: createRsiWidgets,
  },
  funding: {
    defaultOrder: ['fundingMarket', 'fundingKiller'],
    createWidgets: createFundingWidgets,
  },
  altcoin: {
    defaultOrder: ['topGainers', 'vsBtc', 'ethBtcRatio', 'total2'],
    createWidgets: createAltcoinWidgets,
  },
  btc: {
    defaultOrder: ['btcDominance', 'ahr999'],
    createWidgets: createBtcWidgets,
  },
  maflow: {
    defaultOrder: ['maFlow'],
    createWidgets: createMaFlowWidgets,
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
