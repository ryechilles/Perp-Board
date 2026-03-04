'use client';

import { useEffect, useRef, memo } from 'react';

function TradingViewSymbolOverview() {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!container.current) return;

    // Avoid duplicating the script on re-render (React Strict Mode)
    const existing = container.current.querySelector(
      'script[src*="embed-widget-symbol-overview"]',
    );
    if (existing) return;

    const script = document.createElement('script');
    script.src =
      'https://s3.tradingview.com/external-embedding/embed-widget-symbol-overview.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify({
      lineWidth: 2,
      lineType: 0,
      chartType: 'area',
      fontColor: 'rgb(106, 109, 120)',
      gridLineColor: 'rgba(46, 46, 46, 0.06)',
      volumeUpColor: 'rgba(34, 171, 148, 0.5)',
      volumeDownColor: 'rgba(247, 82, 95, 0.5)',
      backgroundColor: '#ffffff',
      widgetFontColor: '#0F0F0F',
      upColor: '#22ab94',
      downColor: '#f7525f',
      borderUpColor: '#22ab94',
      borderDownColor: '#f7525f',
      wickUpColor: '#22ab94',
      wickDownColor: '#f7525f',
      colorTheme: 'light',
      isTransparent: false,
      locale: 'en',
      chartOnly: false,
      scalePosition: 'right',
      scaleMode: 'Normal',
      fontFamily:
        '-apple-system, BlinkMacSystemFont, Trebuchet MS, Roboto, Ubuntu, sans-serif',
      valuesTracking: '1',
      changeMode: 'price-and-percent',
      symbols: [
        ['CRYPTOCAP:BTC.D|1D'],
        ['OKX:ETHBTC|1D'],
        ['CRYPTOCAP:TOTAL2ES|1D'],
      ],
      dateRanges: [
        '1d|1',
        '1m|30',
        '3m|60',
        '12m|1D',
        '60m|1W',
        'all|1M',
      ],
      fontSize: '10',
      headerFontSize: 'medium',
      autosize: true,
      width: '100%',
      height: '100%',
      noTimeScale: false,
      hideDateRanges: false,
      hideMarketStatus: false,
      hideSymbolLogo: false,
    });

    container.current.appendChild(script);
  }, []);

  return (
    <div
      className="tradingview-widget-container"
      ref={container}
      style={{ height: 500, width: '100%' }}
    >
      <div className="tradingview-widget-container__widget"></div>
      <div className="tradingview-widget-copyright">
        <a
          href="https://www.tradingview.com/markets/"
          rel="noopener nofollow"
          target="_blank"
        >
          <span className="blue-text">World markets</span>
        </a>{' '}
        by TradingView
      </div>
    </div>
  );
}

export const BTCDominance = memo(TradingViewSymbolOverview);
