'use client';

import { useMemo, useState } from 'react';
import { SmallWidget } from '@/components/widgets/base';
import { TooltipList, TimeFrameSelector } from '@/components/ui';
import { ProcessedTicker, RSIData, MarketCapData } from '@/lib/types';
import { TimeFrame, TokenWithChange, formatChange } from '@/lib/widget-utils';

interface AltcoinVsBTCProps {
  tickers: Map<string, ProcessedTicker>;
  rsiData: Map<string, RSIData>;
  marketCapData: Map<string, MarketCapData>;
  onTokenClick?: (symbol: string) => void;
  onTopNClick?: (symbols: string[]) => void;
  exchangeLabel?: string;
}

export function AltcoinVsBTC({ tickers, rsiData, marketCapData, onTokenClick, onTopNClick, exchangeLabel = 'OKX' }: AltcoinVsBTCProps) {
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('4h');

  // Get BTC data
  const btcData = useMemo(() => {
    let btcTicker: ProcessedTicker | undefined;
    tickers.forEach((ticker) => {
      if (ticker.baseSymbol === 'BTC') {
        btcTicker = ticker;
      }
    });
    if (!btcTicker) return null;

    const rsi = rsiData.get(btcTicker.instId);
    return {
      change1h: rsi?.change1h ?? null,
      change4h: rsi?.change4h ?? null,
      change24h: btcTicker.changeNum,
    };
  }, [tickers, rsiData]);

  // Get altcoins sorted by market cap (excluding BTC)
  const altcoins = useMemo(() => {
    const tokens: (TokenWithChange & { marketCap: number })[] = [];

    tickers.forEach((ticker) => {
      const mc = marketCapData.get(ticker.baseSymbol);
      const rsi = rsiData.get(ticker.instId);

      if (ticker.baseSymbol === 'BTC') return;

      if (mc && mc.marketCap) {
        tokens.push({
          symbol: ticker.baseSymbol,
          instId: ticker.instId,
          rank: 0, // Not used anymore
          marketCap: mc.marketCap,
          change1h: rsi?.change1h ?? null,
          change4h: rsi?.change4h ?? null,
          change24h: ticker.changeNum,
        });
      }
    });

    // Sort by market cap (descending)
    return tokens.sort((a, b) => b.marketCap - a.marketCap);
  }, [tickers, rsiData, marketCapData]);

  // Calculate average changes for different tiers
  const avgChanges = useMemo(() => {
    const calculateAvg = (tokens: TokenWithChange[]) => {
      const valid1h = tokens.filter(t => t.change1h !== null);
      const valid4h = tokens.filter(t => t.change4h !== null);

      return {
        avg1h: valid1h.length > 0 ? valid1h.reduce((sum, t) => sum + (t.change1h ?? 0), 0) / valid1h.length : null,
        avg4h: valid4h.length > 0 ? valid4h.reduce((sum, t) => sum + (t.change4h ?? 0), 0) / valid4h.length : null,
        avg24h: tokens.length > 0 ? tokens.reduce((sum, t) => sum + t.change24h, 0) / tokens.length : null,
      };
    };

    return {
      top10: calculateAvg(altcoins.slice(0, 10)),
      top20: calculateAvg(altcoins.slice(0, 20)),
      top50: calculateAvg(altcoins.slice(0, 50)),
    };
  }, [altcoins]);

  const getAvg = (tier: 'top10' | 'top20' | 'top50'): number | null => {
    switch (timeFrame) {
      case '1h': return avgChanges[tier].avg1h;
      case '4h': return avgChanges[tier].avg4h;
      case '24h': return avgChanges[tier].avg24h;
    }
  };

  const getBtcChange = (): number | null => {
    if (!btcData) return null;
    switch (timeFrame) {
      case '1h': return btcData.change1h;
      case '4h': return btcData.change4h;
      case '24h': return btcData.change24h;
    }
  };

  const getTopNSymbols = (n: number): string[] => {
    return altcoins.slice(0, n).map(t => t.symbol);
  };

  const isLoading = altcoins.length === 0;

  return (
    <SmallWidget
      title="Altcoins vs BTC"
      subtitle="Average change by tier"
      headerActions={<TimeFrameSelector value={timeFrame} onChange={setTimeFrame} />}
      loading={isLoading}
      className="group"
      tooltip={
        <TooltipList items={[
          "Compares altcoin avg change vs BTC",
          `Tiers: ${exchangeLabel} perp top 10 / 20 / 50 by market cap`,
          "Ratio shows relative strength",
        ]} />
      }
    >
      {/* Avg Change Grid */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Left column - Altcoin tiers */}
        <div className="space-y-2">
          {(['top10', 'top20', 'top50'] as const).map((tier) => {
            const label = tier === 'top10' ? 'Top 10' : tier === 'top20' ? 'Top 20' : 'Top 50';
            const avg = getAvg(tier);
            const n = tier === 'top10' ? 10 : tier === 'top20' ? 20 : 50;
            return (
              <button
                type="button"
                key={tier}
                className="w-full text-left flex items-center justify-between cursor-pointer hover:bg-fill focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40 rounded-md -mx-1.5 px-1.5 py-1"
                onClick={() => onTopNClick?.(getTopNSymbols(n))}
                aria-label={`${label} altcoins`}
              >
                <span className="text-[0.75rem] text-muted-foreground">{label}</span>
                <span className={`text-[0.8125rem] font-semibold tabular-nums ${formatChange(avg).color}`}>
                  {formatChange(avg).text}
                </span>
              </button>
            );
          })}
        </div>

        {/* Right column - BTC */}
        <button
          type="button"
          className="flex flex-col items-center justify-center bg-fill rounded-xl py-2.5 cursor-pointer hover:bg-fill-strong focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
          onClick={() => onTokenClick?.('BTC')}
          aria-label="BTC"
        >
          <img
            src="https://assets.coingecko.com/coins/images/1/small/bitcoin.png"
            alt="BTC"
            width={24}
            height={24}
            loading="lazy"
            className="w-6 h-6 rounded-full mb-1"
          />
          <span className="text-[0.6875rem] text-muted-foreground">BTC</span>
          <span className={`text-[0.9375rem] font-semibold tabular-nums ${formatChange(getBtcChange()).color}`}>
            {formatChange(getBtcChange()).text}
          </span>
        </button>
      </div>

      {/* Ratio Section - Show on hover */}
      <div className="max-h-0 overflow-hidden opacity-0 group-hover:max-h-40 group-hover:opacity-100 group-hover:mt-3 group-hover:pt-3 group-hover:hairline-t group-focus-within:max-h-40 group-focus-within:opacity-100 group-focus-within:mt-3 group-focus-within:pt-3 group-focus-within:hairline-t [@media(hover:none)]:max-h-40 [@media(hover:none)]:opacity-100 [@media(hover:none)]:mt-3 [@media(hover:none)]:pt-3 transition-[max-height,opacity,margin,padding] duration-200">
        <div className="text-xs font-medium text-muted-foreground mb-2">Altcoin / BTC ratio</div>
        <div className="space-y-1.5">
          {(['top10', 'top20', 'top50'] as const).map((tier) => {
            const alt = getAvg(tier);
            const btc = getBtcChange();
            const ratio = (() => {
              if (isLoading || btc === 0 || btc === null || alt === null) return '--';
              // Only show ratio when both have same direction (both up or both down)
              if ((alt >= 0 && btc >= 0) || (alt < 0 && btc < 0)) {
                return `${Math.abs(alt / btc).toFixed(2)}x`;
              }
              // Different directions - ratio doesn't make sense
              return '--';
            })();
            const tierLabel = tier === 'top10' ? 'Top 10' : tier === 'top20' ? 'Top 20' : 'Top 50';
            const altDir = alt !== null ? (alt >= 0 ? '↑' : '↓') : '';
            const btcDir = btc !== null ? (btc >= 0 ? '↑' : '↓') : '';
            const altColor = alt !== null ? (alt >= 0 ? 'text-up-ink' : 'text-down-ink') : 'text-muted-foreground';
            const btcColor = btc !== null ? (btc >= 0 ? 'text-up-ink' : 'text-down-ink') : 'text-muted-foreground';

            return (
              <div key={tier} className="flex items-center text-[0.75rem]">
                <span className="text-muted-foreground w-16">{tierLabel}</span>
                <span className="text-muted-foreground w-12 tabular-nums">{ratio}</span>
                <span className="text-muted-foreground/50 mx-2">|</span>
                <span className={`${altColor}`}>Alt {altDir}</span>
                <span className="text-muted-foreground/50 mx-1.5">vs</span>
                <span className={`${btcColor}`}>BTC {btcDir}</span>
              </div>
            );
          })}
        </div>
      </div>
    </SmallWidget>
  );
}
