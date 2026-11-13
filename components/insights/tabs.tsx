'use client';

/**
 * Insight tabs
 * Panel factories used by both OKX and Hyperliquid boards.
 * Each factory creates widgets with an optional exchangeLabel prop.
 */

import { TabWidgetDef, WidgetContext } from '@/hooks/useBoardWidgets';
import { TopGainers } from './TopGainers';
import { AltcoinsVsBtc } from './AltcoinsVsBtc';
import { FundingKiller } from './FundingKiller';
import { FundingSentiment } from './FundingSentiment';
import { MarketRsi } from './MarketRsi';
import { RsiExtremes } from './RsiExtremes';
import { Ahr999 } from './Ahr999';
import { MiniChart } from './MiniChart';

// ── Parameterized widget factories ──

export function createRsiWidgets(exchangeLabel?: string) {
  return ({ store, handleTokenClick }: WidgetContext) => {
    const { avgRsi7, avgRsi14 } = store.getRsiAverages();
    return {
      marketMomentum: <MarketRsi avgRsi7={avgRsi7} avgRsi14={avgRsi14} exchangeLabel={exchangeLabel} />,
      rsiOversold: (
        <RsiExtremes
          mode="oversold"
          tickers={store.widgetTickers}
          rsiData={store.rsiData}
          marketCapData={store.marketCapData}
          onTokenClick={handleTokenClick}
          exchangeLabel={exchangeLabel}
        />
      ),
      rsiOverbought: (
        <RsiExtremes
          mode="overbought"
          tickers={store.widgetTickers}
          rsiData={store.rsiData}
          marketCapData={store.marketCapData}
          onTokenClick={handleTokenClick}
          exchangeLabel={exchangeLabel}
        />
      ),
    };
  };
}

export function createFundingWidgets(exchangeLabel?: string) {
  return ({ store, handleTokenClick, handleGroupClick }: WidgetContext) => ({
    fundingMarket: (
      <FundingSentiment
        tickers={store.widgetTickers}
        fundingRateData={store.fundingRateData}
        marketCapData={store.marketCapData}
        onGroupClick={handleGroupClick}
        exchangeLabel={exchangeLabel}
      />
    ),
    fundingKiller: (
      <FundingKiller
        tickers={store.widgetTickers}
        fundingRateData={store.fundingRateData}
        marketCapData={store.marketCapData}
        onTokenClick={handleTokenClick}
        onGroupClick={handleGroupClick}
        exchangeLabel={exchangeLabel}
      />
    ),
  });
}

export function createAltcoinWidgets(exchangeLabel?: string) {
  return ({ store, handleTokenClick, handleGroupClick }: WidgetContext) => ({
    topGainers: (
      <TopGainers
        tickers={store.widgetTickers}
        rsiData={store.rsiData}
        marketCapData={store.marketCapData}
        onTokenClick={handleTokenClick}
        exchangeLabel={exchangeLabel}
      />
    ),
    vsBtc: (
      <AltcoinsVsBtc
        tickers={store.widgetTickers}
        rsiData={store.rsiData}
        marketCapData={store.marketCapData}
        onTokenClick={handleTokenClick}
        onTopNClick={handleGroupClick}
        exchangeLabel={exchangeLabel}
      />
    ),
    ethBtcRatio: <MiniChart symbol="OKX:ETHBTC" label="ETH/BTC ratio mini chart" />,
    total2: <MiniChart symbol="CRYPTOCAP:TOTAL2" label="TOTAL2 (altcoin market cap) mini chart" />,
  });
}

export function createBtcWidgets() {
  return () => ({
    btcDominance: <MiniChart symbol="CRYPTOCAP:BTC.D" label="Bitcoin dominance mini chart" />,
    ahr999: <Ahr999 />,
  });
}

// ── Shared tab widget definitions (RSI, Funding, Altcoin, BTC) ──

export function getSharedTabWidgetDefs(exchangeLabel?: string): Record<string, TabWidgetDef> {
  return {
    rsi: {
      defaultOrder: ['marketMomentum', 'rsiOversold', 'rsiOverbought'],
      createWidgets: createRsiWidgets(exchangeLabel),
    },
    funding: {
      defaultOrder: ['fundingMarket', 'fundingKiller'],
      createWidgets: createFundingWidgets(exchangeLabel),
    },
    altcoin: {
      defaultOrder: ['topGainers', 'vsBtc', 'ethBtcRatio', 'total2'],
      createWidgets: createAltcoinWidgets(exchangeLabel),
    },
    btc: {
      defaultOrder: ['btcDominance', 'ahr999'],
      createWidgets: createBtcWidgets(),
    },
  };
}
