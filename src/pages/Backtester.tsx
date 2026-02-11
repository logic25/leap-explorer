import { BarChart3 } from 'lucide-react';

export default function Backtester() {
  return (
    <div className="flex flex-col items-center justify-center h-[60vh] text-center animate-slide-in">
      <div className="bg-surface-2 rounded-full p-4 mb-4">
        <BarChart3 className="h-8 w-8 text-primary" />
      </div>
      <h2 className="text-lg font-semibold text-foreground">Backtester</h2>
      <p className="text-sm text-muted-foreground mt-1 max-w-md">
        Historical simulation of LEAPS strategies. Configure stock, date range, and scanner type to view CAGR, max drawdown, win rate, and equity curves.
      </p>
      <p className="text-xs text-muted-foreground mt-3">
        Connect Polygon.io API in Settings to enable backtesting.
      </p>
    </div>
  );
}
