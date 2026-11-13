import { API } from '@/lib/constants';

/**
 * Resource hints for a board page — rendered on the server so they are in the
 * very first bytes of HTML.
 *
 * The board is client-rendered: without these, its first data requests only
 * start once the JS bundle has downloaded and hydrated. `preload as="fetch"`
 * lets the browser start them while it is still fetching that JS; the app's
 * own `fetch()` for the same URL then picks up the in-flight / finished
 * response instead of starting from zero.
 *
 * A preload is only reused when its URL and CORS mode match the later fetch
 * exactly, so the hrefs below must stay identical to the ones the data layer
 * requests (lib/api/marketcap.ts, lib/api/okx-data-manager.ts,
 * lib/api/okx-rest.ts). `crossOrigin="anonymous"` is what matches a default
 * `fetch()`.
 */
export function BoardPreloads({ exchange }: { exchange: 'okx' | 'hyperliquid' }) {
  return (
    <>
      {/* Market-cap ranks — a universe input on both exchanges */}
      <link rel="preload" as="fetch" href="/api/marketcap" crossOrigin="anonymous" />

      {exchange === 'okx' ? (
        <>
          <link rel="preconnect" href="https://www.okx.com" crossOrigin="anonymous" />
          {/* The ticker WebSocket — a different origin (port) from the REST host */}
          <link rel="preconnect" href="https://ws.okx.com:8443" />
          {/* Ticker list + spot symbols: with market cap, the three inputs the
              table waits for before it can paint rows */}
          <link
            rel="preload"
            as="fetch"
            href={`${API.OKX_REST_BASE}/market/tickers?instType=SWAP`}
            crossOrigin="anonymous"
          />
          <link
            rel="preload"
            as="fetch"
            href={`${API.OKX_REST_BASE}/market/tickers?instType=SPOT`}
            crossOrigin="anonymous"
          />
        </>
      ) : (
        // Hyperliquid's data requests are POSTs, which cannot be preloaded —
        // warming the connection is the most that can be done ahead of the JS.
        <link rel="preconnect" href="https://api.hyperliquid.xyz" crossOrigin="anonymous" />
      )}
    </>
  );
}
