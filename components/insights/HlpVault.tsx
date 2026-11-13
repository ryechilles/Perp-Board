'use client';

import { useState, useEffect, useCallback } from 'react';
import { Money, Panel, Percent, Stat } from '@/components/data';
import { TipBody } from '@/components/ui';
import { fetchHLPVaultData, HLPVaultDetails } from '@/lib/api/hyperliquid-rest';

/** Hyperliquid's market-making vault: size, return and PnL by period. */
export function HlpVault() {
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
    <Panel
      title="HLP Vault"
      note="Hyperliquidity Provider"
      loading={loading}
      info={
        <TipBody
          title="Hyperliquid's flagship market-making vault"
          items={['Provides liquidity across all perp markets', 'Handles liquidations, funding and spreads', 'APR is based on vault performance over time']}
        />
      }
    >
      {data ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between">
            <Stat size="display" value={<Money value={data.tvl} />} label="TVL" />
            <Stat size="display" align="right" value={<Percent value={data.apr} decimals={1} />} label="APR" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Stat value={<Money value={data.pnlDay} signed />} label="PnL 24h" />
            <Stat value={<Money value={data.pnl7d} signed />} label="PnL 7d" />
            <Stat value={<Money value={data.pnl30d} signed />} label="PnL 30d" />
          </div>
          <Stat value={<Money value={data.pnlAllTime} signed />} label="All-time PnL" />
        </div>
      ) : (
        <p className="text-small text-fg-muted">{error || 'Failed to load HLP data'}</p>
      )}
    </Panel>
  );
}
