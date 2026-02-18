'use client';

import { useMemo, useCallback } from 'react';
import { useHyperliquidStore } from '@/hooks/useHyperliquidStore';
import { useWidgetOrder } from '@/hooks/useWidgetOrder';
import { ExchangeBoard, TabConfig, TabWidgetConfig } from '@/components/ExchangeBoard';
import { MarketMomentum } from '@/components/MarketMomentum';
import { RsiOversold } from '@/components/RsiOversold';
import { RsiOverbought } from '@/components/RsiOverbought';
import { AltcoinTopGainers } from '@/components/AltcoinTopGainers';
import { AltcoinVsBTC } from '@/components/AltcoinVsBTC';
import { FundingMarket } from '@/components/FundingMarket';
import { FundingKiller } from '@/components/FundingKiller';
import { HLPVault } from '@/components/HLPVault';
import { Total2MiniChart } from '@/components/Total2MiniChart';
import { EthBtcRatio } from '@/components/EthBtcRatio';
import { BTCDominance } from '@/components/BTCDominance';
import { AHR999Indicator } from '@/components/AHR999Indicator';

const EXCHANGE_LABEL = 'Hyperliquid';

// Hyperliquid logo for HLP tab
const HlpTabIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 144 144" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M144 71.6991C144 119.306 114.866 134.582 99.5156 120.98C86.8804 109.889 83.1211 86.4521 64.116 84.0456C39.9942 81.0113 37.9057 113.133 22.0334 113.133C3.5504 113.133 0 86.2428 0 72.4315C0 58.3063 3.96809 39.0542 19.736 39.0542C38.1146 39.0542 39.1588 66.5722 62.132 65.1073C85.0007 63.5379 85.4184 34.8689 100.247 22.6271C113.195 12.0593 144 23.4641 144 71.6991Z" />
  </svg>
);

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
  { id: 'hlp', label: 'HLP', icon: <HlpTabIcon /> },
];

const DEFAULT_WIDGET_ORDER: Record<string, string[]> = {
  rsi: ['marketMomentum', 'rsiOversold', 'rsiOverbought'],
  funding: ['fundingMarket', 'fundingKiller'],
  altcoin: ['topGainers', 'vsBtc', 'ethBtcRatio', 'total2'],
  btc: ['btcDominance', 'ahr999'],
  hlp: ['hlpVault'],
};

export default function HyperliquidBoard() {
  const store = useHyperliquidStore();

  // Widget ordering per tab (hl- prefix for separate localStorage)
  const [rsiWidgetOrder, setRsiWidgetOrder] = useWidgetOrder('hl-rsi', DEFAULT_WIDGET_ORDER.rsi);
  const [fundingWidgetOrder, setFundingWidgetOrder] = useWidgetOrder('hl-funding', DEFAULT_WIDGET_ORDER.funding);
  const [altcoinWidgetOrder, setAltcoinWidgetOrder] = useWidgetOrder('hl-altcoin', DEFAULT_WIDGET_ORDER.altcoin);
  const [btcWidgetOrder, setBtcWidgetOrder] = useWidgetOrder('hl-btc', DEFAULT_WIDGET_ORDER.btc);
  const [hlpWidgetOrder, setHlpWidgetOrder] = useWidgetOrder('hl-hlp', DEFAULT_WIDGET_ORDER.hlp);

  // Token click handlers
  const handleTokenClick = useCallback((symbol: string) => {
    store.setFilters({});
    store.setSearchTerm(symbol);
  }, [store]);

  const handleGroupClick = useCallback((symbols: string[]) => {
    store.setFilters({});
    store.setSearchTerm(symbols.join('|'));
  }, [store]);

  // RSI averages for MarketMomentum
  const { avgRsi7, avgRsi14 } = store.getRsiAverages();

  // Widget configs per tab
  const tabWidgets: Record<string, TabWidgetConfig> = useMemo(() => ({
    rsi: {
      order: rsiWidgetOrder,
      setOrder: setRsiWidgetOrder,
      widgets: {
        marketMomentum: <MarketMomentum avgRsi7={avgRsi7} avgRsi14={avgRsi14} exchangeLabel={EXCHANGE_LABEL} />,
        rsiOversold: (
          <RsiOversold
            tickers={store.tickers}
            rsiData={store.rsiData}
            marketCapData={store.marketCapData}
            onTokenClick={handleTokenClick}
            exchangeLabel={EXCHANGE_LABEL}
          />
        ),
        rsiOverbought: (
          <RsiOverbought
            tickers={store.tickers}
            rsiData={store.rsiData}
            marketCapData={store.marketCapData}
            onTokenClick={handleTokenClick}
            exchangeLabel={EXCHANGE_LABEL}
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
            exchangeLabel={EXCHANGE_LABEL}
          />
        ),
        fundingKiller: (
          <FundingKiller
            tickers={store.tickers}
            fundingRateData={store.fundingRateData}
            marketCapData={store.marketCapData}
            onTokenClick={handleTokenClick}
            onGroupClick={handleGroupClick}
            exchangeLabel={EXCHANGE_LABEL}
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
            exchangeLabel={EXCHANGE_LABEL}
          />
        ),
        vsBtc: (
          <AltcoinVsBTC
            tickers={store.tickers}
            rsiData={store.rsiData}
            marketCapData={store.marketCapData}
            onTokenClick={handleTokenClick}
            onTopNClick={handleGroupClick}
            exchangeLabel={EXCHANGE_LABEL}
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
    hlp: {
      order: hlpWidgetOrder,
      setOrder: setHlpWidgetOrder,
      widgets: {
        hlpVault: <HLPVault />,
      },
    },
  }), [
    avgRsi7, avgRsi14,
    store.tickers, store.rsiData, store.marketCapData, store.fundingRateData,
    rsiWidgetOrder, setRsiWidgetOrder,
    fundingWidgetOrder, setFundingWidgetOrder,
    altcoinWidgetOrder, setAltcoinWidgetOrder,
    btcWidgetOrder, setBtcWidgetOrder,
    hlpWidgetOrder, setHlpWidgetOrder,
    handleTokenClick, handleGroupClick,
  ]);

  return (
    <ExchangeBoard
      store={store}
      exchange="hyperliquid"
      tabs={TABS}
      tabWidgets={tabWidgets}
    />
  );
}
