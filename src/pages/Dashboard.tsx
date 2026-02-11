import { useState } from 'react';
import { mockAlerts, mockRegime } from '@/lib/mock-data';
import type { ScannerAlert } from '@/lib/mock-data';
import { ScannerBadge } from '@/components/ScannerBadge';
import { ChecklistModal } from '@/components/ChecklistModal';
import { RegimeIndicator } from '@/components/RegimeIndicator';
import { Check, X, ChevronRight, Clock } from 'lucide-react';

export default function Dashboard() {
  const [selected, setSelected] = useState<ScannerAlert | null>(null);

  const passedCount = (alert: ScannerAlert) => alert.checklist.filter(c => c.passed).length;
  const totalCount = (alert: ScannerAlert) => alert.checklist.length;

  return (
    <div className="space-y-6 animate-slide-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Daily Scanner</h1>
          <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
            <Clock className="h-3.5 w-3.5" />
            Last scan: Today 4:15 PM EST
          </p>
        </div>
        <div className="sm:hidden">
          <RegimeIndicator regime={mockRegime} />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total Alerts" value={mockAlerts.length.toString()} />
        <StatCard label="Value Zone" value={mockAlerts.filter(a => a.scannerType === 'Value Zone').length.toString()} accent="primary" />
        <StatCard label="MegaRun" value={mockAlerts.filter(a => a.scannerType === 'MegaRun').length.toString()} accent="bullish" />
        <StatCard label="Fallen Angel" value={mockAlerts.filter(a => a.scannerType === 'Fallen Angel').length.toString()} accent="warning" />
      </div>

      {/* Table */}
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ticker</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Type</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Price</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Change</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">RSI</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Vol Ratio</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Checklist</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {mockAlerts.map((alert) => (
                <tr
                  key={alert.id}
                  className="border-b border-border/50 hover:bg-accent/50 cursor-pointer transition-colors"
                  onClick={() => setSelected(alert)}
                >
                  <td className="px-4 py-3">
                    <div className="font-mono font-semibold text-foreground">{alert.ticker}</div>
                    <div className="text-xs text-muted-foreground">{alert.name}</div>
                  </td>
                  <td className="px-4 py-3">
                    <ScannerBadge type={alert.scannerType} />
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-medium text-foreground">
                    ${alert.price.toFixed(2)}
                  </td>
                  <td className={`px-4 py-3 text-right font-mono font-medium ${alert.changePct >= 0 ? 'text-bullish' : 'text-bearish'}`}>
                    {alert.changePct >= 0 ? '+' : ''}{alert.changePct.toFixed(2)}%
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-foreground hidden md:table-cell">
                    {alert.rsi}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-foreground hidden lg:table-cell">
                    {(alert.volume / alert.avgVolume).toFixed(2)}x
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center gap-1 text-xs">
                      {passedCount(alert) === totalCount(alert) ? (
                        <Check className="h-4 w-4 text-bullish" />
                      ) : (
                        <span className="text-muted-foreground">
                          {passedCount(alert)}/{totalCount(alert)}
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ChecklistModal alert={selected} open={!!selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: string }) {
  const borderClass = accent === 'primary' ? 'border-l-primary' :
    accent === 'bullish' ? 'border-l-bullish' :
    accent === 'warning' ? 'border-l-warning' : 'border-l-border';

  return (
    <div className={`bg-card rounded-lg border border-border border-l-2 ${borderClass} px-4 py-3`}>
      <div className="text-[11px] text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className="text-2xl font-semibold font-mono text-foreground mt-0.5">{value}</div>
    </div>
  );
}
