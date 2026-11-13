'use client';

import { useMemo, useState } from 'react';
import { Delta, Figure, Panel, Stat } from '@/components/data';
import { Button, TipBody, TokenAvatar } from '@/components/ui';
import { ProcessedTicker, RSIData, MarketCapData } from '@/lib/types';
import { TimeFrame, TokenWithChange, widgetUniverseNote } from '@/lib/widget-utils';
import { TimeFrameSelect } from './TimeFrameSelect';

const TIERS = [
  { key: 'top10', label: 'Top 10', n: 10 },
  { key: 'top20', label: 'Top 20', n: 20 },
  { key: 'top50', label: 'Top 50', n: 50 },
] as const;

interface AltcoinsVsBtcProps {
  tickers: Map<string, ProcessedTicker>;
  rsiData: Map<string, RSIData>;
  marketCapData: Map<string, MarketCapData>;
  onTokenClick?: (symbol: string) => void;
  onTopNClick?: (symbols: string[]) => void;
  exchangeLabel?: string;
}

/** Average altcoin move by market-cap tier, next to BTC's, and the ratio between them. */
export function AltcoinsVsBtc({ tickers, rsiData, marketCapData, onTokenClick, onTopNClick, exchangeLabel = 'OKX' }: AltcoinsVsBtcProps) {
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

  const btc = getBtcChange();
  const ratioOf = (alt: number | null): string => {
    if (btc === null || btc === 0 || alt === null) return '—';
    // A ratio only means something when both moved the same way
    return (alt >= 0) === (btc >= 0) ? `${Math.abs(alt / btc).toFixed(2)}×` : '—';
  };

  return (
    <Panel
      title="Altcoins vs BTC"
      actions={<TimeFrameSelect value={timeFrame} onChange={setTimeFrame} />}
      loading={isLoading}
      info={
        <TipBody
          title="Altcoin average change against BTC"
          items={[widgetUniverseNote(exchangeLabel), 'Tiers: top 10 / 20 / 50 altcoins by market cap', 'Ratio = altcoin move ÷ BTC move, when both moved the same way']}
        />
      }
    >
      <div className="flex flex-col gap-3">
        <Button
          variant="bare"
          className="-mx-2 flex items-center gap-2 rounded-control px-2 py-1 text-left transition-colors hover:bg-fill"
          onClick={() => onTokenClick?.('BTC')}
          aria-label="Show BTC in the table"
        >
          <TokenAvatar symbol="BTC" logo={marketCapData.get('BTC')?.logo} size="lg" />
          <Stat value={<Delta value={btc} />} label="BTC" />
        </Button>

        <table className="w-full border-collapse">
          <thead>
            <tr className="caps">
              <th className="h-control-sm text-left font-medium">Tier</th>
              <th className="h-control-sm text-right font-medium">Avg change</th>
              <th className="h-control-sm text-right font-medium">vs BTC</th>
            </tr>
          </thead>
          <tbody>
            {TIERS.map((tier) => {
              const avg = getAvg(tier.key);
              return (
                <tr key={tier.key}>
                  <td className="h-control-md">
                    <Button
                      variant="bare"
                      className="rounded-tag text-fg-muted transition-colors hover:text-fg"
                      onClick={() => onTopNClick?.(getTopNSymbols(tier.n))}
                      aria-label={`Show the ${tier.label.toLowerCase()} altcoins in the table`}
                    >
                      {tier.label}
                    </Button>
                  </td>
                  <td className="text-right"><Delta value={avg} /></td>
                  <td className="text-right"><Figure className="text-fg-muted">{ratioOf(avg)}</Figure></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
