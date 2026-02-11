import type { RegimeStatus } from '@/lib/mock-data';
import { Shield } from 'lucide-react';

interface Props {
  regime: {
    status: RegimeStatus;
    spyAbove50: boolean;
    spyAbove200: boolean;
    vix: number;
  };
}

const statusConfig = {
  GREEN: { label: 'Full Deploy', className: 'bg-bullish/15 border-bullish text-bullish' },
  YELLOW: { label: 'Cautious', className: 'bg-warning/15 border-warning text-warning' },
  RED: { label: 'Defensive', className: 'bg-bearish/15 border-bearish text-bearish' },
};

export function RegimeIndicator({ regime }: Props) {
  const config = statusConfig[regime.status];

  return (
    <div className={`rounded-lg border px-3 py-2.5 ${config.className}`}>
      <div className="flex items-center gap-2 text-xs font-semibold mb-1.5">
        <Shield className="h-3.5 w-3.5" />
        Market Regime: {regime.status}
      </div>
      <div className="space-y-0.5 text-[11px] opacity-80">
        <div>SPY: {regime.spyAbove50 ? '✓' : '✗'} 50MA | {regime.spyAbove200 ? '✓' : '✗'} 200MA</div>
        <div>VIX: {regime.vix.toFixed(1)}</div>
        <div className="font-medium">{config.label}</div>
      </div>
    </div>
  );
}
