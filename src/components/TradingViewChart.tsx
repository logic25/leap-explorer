import { useEffect, useRef } from 'react';
import { ExternalLink } from 'lucide-react';

interface TradingViewChartProps {
  ticker: string;
  className?: string;
}

export function TradingViewChart({ ticker, className = '' }: TradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = '';

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify({
      width: '100%',
      height: '100%',
      symbol: ticker,
      interval: 'W',
      timezone: 'America/New_York',
      theme: 'dark',
      style: '1',
      locale: 'en',
      hide_top_toolbar: false,
      hide_legend: false,
      allow_symbol_change: false,
      save_image: false,
      calendar: false,
      studies: ['STD;SMA'],
      support_host: 'https://www.tradingview.com',
    });

    containerRef.current.appendChild(script);

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [ticker]);

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Chart</h4>
        <a
          href={`https://www.tradingview.com/chart/?symbol=${ticker}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          Full Chart <ExternalLink className="h-3 w-3" />
        </a>
      </div>
      <div
        ref={containerRef}
        className="tradingview-widget-container rounded-md overflow-hidden border border-border [&>div]:!h-full [&>iframe]:!h-full"
        style={{ height: 650 }}
      />
    </div>
  );
}
