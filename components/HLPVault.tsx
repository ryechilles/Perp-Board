'use client';

import { useState, useEffect, useCallback } from 'react';
import { SmallWidget } from '@/components/widgets/base';
import { TooltipList } from '@/components/ui';
import { fetchHLPVaultData, HLPVaultDetails } from '@/lib/api/hyperliquid-rest';

function formatUsd(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

function formatPnl(value: number): string {
  const prefix = value >= 0 ? '+' : '';
  return `${prefix}${formatUsd(value)}`;
}

export function HLPVault() {
  const [data, setData] = useState<HLPVaultDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const result = await fetchHLPVaultData();
      if (result) {
        setData(result);
      } else {
        setError('No data returned from HLP vault API');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      console.error('[HLP Widget] Fetch failed:', msg);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Refresh every 5 minutes
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchData]);

  return (
    <SmallWidget
      title="HLP Vault"
      subtitle="Hyperliquidity Provider"
      loading={loading}
      tooltip={
        <TooltipList items={[
          "HLP is Hyperliquid's flagship market-making vault",
          "Provides liquidity across all perp markets",
          "Handles liquidations, funding, and spreads",
          "APR based on vault performance over time",
          "PnL data from on-chain vault history",
        ]} />
      }
    >
      {data ? (
        <div className="space-y-3">
          {/* TVL & APR Row */}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground">TVL</div>
              <div className="text-[1.5rem] leading-tight font-semibold tracking-[-0.025em] tabular-nums">{formatUsd(data.tvl)}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">APR</div>
              <div className={`text-[1.5rem] leading-tight font-semibold tracking-[-0.025em] tabular-nums ${data.apr >= 0 ? 'text-up-ink' : 'text-down-ink'}`}>
                {data.apr.toFixed(1)}%
              </div>
            </div>
          </div>

          {/* PnL Grid */}
          <div className="hairline-t pt-3">
            <div className="text-xs font-medium text-muted-foreground mb-2">PnL</div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <div className="text-[0.6875rem] text-faint">24h</div>
                <div className={`text-[0.8125rem] font-semibold tabular-nums ${data.pnlDay >= 0 ? 'text-up-ink' : 'text-down-ink'}`}>
                  {formatPnl(data.pnlDay)}
                </div>
              </div>
              <div>
                <div className="text-[0.6875rem] text-faint">7d</div>
                <div className={`text-[0.8125rem] font-semibold tabular-nums ${data.pnl7d >= 0 ? 'text-up-ink' : 'text-down-ink'}`}>
                  {formatPnl(data.pnl7d)}
                </div>
              </div>
              <div>
                <div className="text-[0.6875rem] text-faint">30d</div>
                <div className={`text-[0.8125rem] font-semibold tabular-nums ${data.pnl30d >= 0 ? 'text-up-ink' : 'text-down-ink'}`}>
                  {formatPnl(data.pnl30d)}
                </div>
              </div>
            </div>
          </div>

          {/* All-time PnL */}
          <div className="hairline-t pt-3 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">All-time PnL</span>
            <span className={`text-[0.8125rem] font-semibold tabular-nums ${data.pnlAllTime >= 0 ? 'text-up-ink' : 'text-down-ink'}`}>
              {formatPnl(data.pnlAllTime)}
            </span>
          </div>
        </div>
      ) : (
        <div className="text-center py-4 text-xs text-muted-foreground">
          {error || 'Failed to load HLP data'}
        </div>
      )}
    </SmallWidget>
  );
}
