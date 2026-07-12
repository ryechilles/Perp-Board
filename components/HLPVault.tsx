'use client';

import { useState, useEffect, useCallback } from 'react';
import { SmallWidget } from '@/components/widgets/base';
import { TooltipList } from '@/components/ui';
import { fetchHLPVaultData, HLPVaultDetails } from '@/lib/api/hyperliquid-rest';

// Hyperliquid Logo for HLP widget icon (official brand color #97FCE4)
function HyperliquidIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 144 144" fill="#97FCE4" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M144 71.6991C144 119.306 114.866 134.582 99.5156 120.98C86.8804 109.889 83.1211 86.4521 64.116 84.0456C39.9942 81.0113 37.9057 113.133 22.0334 113.133C3.5504 113.133 0 86.2428 0 72.4315C0 58.3063 3.96809 39.0542 19.736 39.0542C38.1146 39.0542 39.1588 66.5722 62.132 65.1073C85.0007 63.5379 85.4184 34.8689 100.247 22.6271C113.195 12.0593 144 23.4641 144 71.6991Z" />
    </svg>
  );
}

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
      icon={<HyperliquidIcon className="w-4 h-4" />}
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
              <div className="text-[0.6875rem] text-muted-foreground">TVL</div>
              <div className="text-lg font-semibold tabular-nums">{formatUsd(data.tvl)}</div>
            </div>
            <div className="text-right">
              <div className="text-[0.6875rem] text-muted-foreground">APR</div>
              <div className={`text-lg font-semibold tabular-nums ${data.apr >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {data.apr.toFixed(1)}%
              </div>
            </div>
          </div>

          {/* PnL Grid */}
          <div className="border-t border-gray-950/[0.10] dark:border-white/[0.10] pt-3">
            <div className="text-[0.6875rem] text-muted-foreground mb-2">PnL</div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <div className="text-[0.625rem] text-muted-foreground">24h</div>
                <div className={`text-[0.75rem] font-medium tabular-nums ${data.pnlDay >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {formatPnl(data.pnlDay)}
                </div>
              </div>
              <div>
                <div className="text-[0.625rem] text-muted-foreground">7d</div>
                <div className={`text-[0.75rem] font-medium tabular-nums ${data.pnl7d >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {formatPnl(data.pnl7d)}
                </div>
              </div>
              <div>
                <div className="text-[0.625rem] text-muted-foreground">30d</div>
                <div className={`text-[0.75rem] font-medium tabular-nums ${data.pnl30d >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {formatPnl(data.pnl30d)}
                </div>
              </div>
            </div>
          </div>

          {/* All-time PnL */}
          <div className="border-t pt-3 flex items-center justify-between">
            <span className="text-[0.6875rem] text-muted-foreground">All-time PnL</span>
            <span className={`text-[0.8125rem] font-semibold tabular-nums ${data.pnlAllTime >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {formatPnl(data.pnlAllTime)}
            </span>
          </div>
        </div>
      ) : (
        <div className="text-center py-4 text-[0.6875rem] text-muted-foreground">
          {error || 'Failed to load HLP data'}
        </div>
      )}
    </SmallWidget>
  );
}
