'use client';

/**
 * Shared Widget Definitions
 * Common widget factories used by both OKX and Hyperliquid boards.
 * Each factory creates widgets with an optional exchangeLabel prop.
 */

import { TabWidgetDef, WidgetContext } from '@/hooks/useBoardWidgets';
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

// ── Parameterized widget factories ──

export function createRsiWidgets(exchangeLabel?: string) {
  return ({ store, handleTokenClick }: WidgetContext) => {
    const { avgRsi7, avgRsi14 } = store.getRsiAverages();
    return {
      marketMomentum: <MarketMomentum avgRsi7={avgRsi7} avgRsi14={avgRsi14} exchangeLabel={exchangeLabel} />,
      rsiOversold: (
        <RsiOversold
          tickers={store.universeTickers}
          rsiData={store.rsiData}
          marketCapData={store.marketCapData}
          onTokenClick={handleTokenClick}
          exchangeLabel={exchangeLabel}
        />
      ),
      rsiOverbought: (
        <RsiOverbought
          tickers={store.universeTickers}
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
      <FundingMarket
        tickers={store.universeTickers}
        fundingRateData={store.fundingRateData}
        marketCapData={store.marketCapData}
        onGroupClick={handleGroupClick}
        exchangeLabel={exchangeLabel}
      />
    ),
    fundingKiller: (
      <FundingKiller
        tickers={store.universeTickers}
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
      <AltcoinTopGainers
        tickers={store.universeTickers}
        rsiData={store.rsiData}
        marketCapData={store.marketCapData}
        onTokenClick={handleTokenClick}
        exchangeLabel={exchangeLabel}
      />
    ),
    vsBtc: (
      <AltcoinVsBTC
        tickers={store.universeTickers}
        rsiData={store.rsiData}
        marketCapData={store.marketCapData}
        onTokenClick={handleTokenClick}
        onTopNClick={handleGroupClick}
        exchangeLabel={exchangeLabel}
      />
    ),
    ethBtcRatio: <EthBtcRatio />,
    total2: <Total2MiniChart />,
  });
}

export function createBtcWidgets() {
  return () => ({
    btcDominance: <BTCDominance />,
    ahr999: <AHR999Indicator />,
  });
}

// ── Shared tab icon ──

export const BtcLogo = () => (
  <img
    src="https://assets.coingecko.com/coins/images/1/small/bitcoin.png"
    alt="BTC"
    width={16}
    height={16}
    loading="lazy"
    className="w-4 h-4 rounded-full"
  />
);

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
