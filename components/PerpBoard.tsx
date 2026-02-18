'use client';

import { useMemo, useCallback, ReactNode } from 'react';
import { useMarketStore } from '@/hooks/useMarketStore';
import { useUrlState } from '@/hooks/useUrlState';
import { useWidgetOrder } from '@/hooks/useWidgetOrder';
import { ExchangeBoard, TabConfig, TabWidgetConfig } from '@/components/ExchangeBoard';
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

// Bitcoin logo for AHR999 tab
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

const DEFAULT_WIDGET_ORDER: Record<string, string[]> = {
  rsi: ['marketMomentum', 'rsiOversold', 'rsiOverbought'],
  funding: ['fundingMarket', 'fundingKiller'],
  altcoin: ['topGainers', 'vsBtc', 'ethBtcRatio', 'total2'],
  btc: ['btcDominance', 'ahr999'],
  maflow: ['maFlow'],
};

export default function PerpBoard() {
  const store = useMarketStore();

  // Widget ordering per tab
  const [rsiWidgetOrder, setRsiWidgetOrder] = useWidgetOrder('rsi', DEFAULT_WIDGET_ORDER.rsi);
  const [fundingWidgetOrder, setFundingWidgetOrder] = useWidgetOrder('funding', DEFAULT_WIDGET_ORDER.funding);
  const [altcoinWidgetOrder, setAltcoinWidgetOrder] = useWidgetOrder('altcoin', DEFAULT_WIDGET_ORDER.altcoin);
  const [btcWidgetOrder, setBtcWidgetOrder] = useWidgetOrder('btc', DEFAULT_WIDGET_ORDER.btc);
  const [maflowWidgetOrder, setMaflowWidgetOrder] = useWidgetOrder('maflow', DEFAULT_WIDGET_ORDER.maflow);

  // Token click handlers for widgets
  const handleTokenClick = useCallback((symbol: string) => {
    store.setFilters({});
    store.setSearchTerm(symbol);
  }, [store]);

  const handleGroupClick = useCallback((symbols: string[]) => {
    store.setFilters({});
    store.setSearchTerm(symbols.join('|'));
  }, [store]);

  // RSI averages for MarketMomentum widget
  const { avgRsi7, avgRsi14 } = store.getRsiAverages();

  // Widget configs per tab
  const tabWidgets: Record<string, TabWidgetConfig> = useMemo(() => ({
    rsi: {
      order: rsiWidgetOrder,
      setOrder: setRsiWidgetOrder,
      widgets: {
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
      },
    },
    funding: {
      order: fundingWidgetOrder,
      setOrder: setFundingWidgetOrder,
      widgets: {
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
      },
    },
    altcoin: {
      order: altcoinWidgetOrder,
      setOrder: setAltcoinWidgetOrder,
      widgets: {
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
      },
    },
    btc: {
      order: btcWidgetOrder,
      setOrder: setBtcWidgetOrder,
      widgets: {
        btcDominance: <BTCDominance />,
        ahr999: <AHR999Indicator />,
      },
    },
    maflow: {
      order: maflowWidgetOrder,
      setOrder: setMaflowWidgetOrder,
      widgets: {
        maFlow: (
          <MAFlowWidget
            tickers={store.tickers}
            maFlowData={store.maFlowData}
            marketCapData={store.marketCapData}
            onTokenClick={handleTokenClick}
            onGroupClick={handleGroupClick}
          />
        ),
      },
    },
  }), [
    avgRsi7, avgRsi14,
    store.tickers, store.rsiData, store.marketCapData,
    store.fundingRateData, store.maFlowData,
    rsiWidgetOrder, setRsiWidgetOrder,
    fundingWidgetOrder, setFundingWidgetOrder,
    altcoinWidgetOrder, setAltcoinWidgetOrder,
    btcWidgetOrder, setBtcWidgetOrder,
    maflowWidgetOrder, setMaflowWidgetOrder,
    handleTokenClick, handleGroupClick,
  ]);

  return (
    <ExchangeBoard
      store={store}
      exchange="okx"
      tabs={TABS}
      tabWidgets={tabWidgets}
      useUrlStateHook={useUrlState}
    />
  );
}
