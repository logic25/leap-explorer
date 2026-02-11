import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScannerBadge } from './ScannerBadge';
import { TradingViewChart } from './TradingViewChart';
import { Check, X, AlertTriangle } from 'lucide-react';
import type { ScannerAlert } from '@/lib/mock-data';

interface Props {
  alert: ScannerAlert | null;
  open: boolean;
  onClose: () => void;
}

export function ChecklistModal({ alert, open, onClose }: Props) {
  if (!alert) return null;

  const allPassed = alert.checklist.every(c => c.passed);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl bg-card border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span className="font-mono text-lg">{alert.ticker}</span>
            <ScannerBadge type={alert.scannerType} />
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Key metrics */}
          <div className="grid grid-cols-3 gap-3">
            <MetricCard label="Strike" value={`$${alert.suggestedStrike}`} />
            <MetricCard label="Delta" value={alert.delta.toFixed(2)} />
            <MetricCard label="DTE" value={`${alert.dte}d`} />
            <MetricCard label="Ask" value={`$${alert.askPrice.toFixed(2)}`} />
            <MetricCard label="12mo Low" value={`$${alert.historicalLow.toFixed(2)}`} />
            <MetricCard label="IV %ile" value={`${alert.ivPercentile}%`} />
          </div>

          {alert.askPrice > alert.historicalLow * 1.15 && (
            <div className="flex items-center gap-2 text-xs text-warning bg-warning/10 border border-warning/20 rounded-md px-3 py-2">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              Ask is {((alert.askPrice / alert.historicalLow - 1) * 100).toFixed(0)}% above 12-month low
            </div>
          )}

          {/* TradingView Chart */}
          <TradingViewChart ticker={alert.ticker} />

          {/* Checklist */}
          <div className="space-y-1.5">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Entry Checklist</h4>
            {alert.checklist.map((item, i) => (
              <div key={i} className="flex items-center gap-2.5 text-sm py-1">
                {item.passed ? (
                  <Check className="h-4 w-4 text-bullish shrink-0" />
                ) : (
                  <X className="h-4 w-4 text-bearish shrink-0" />
                )}
                <span className={item.passed ? 'text-foreground' : 'text-muted-foreground'}>
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            disabled={!allPassed}
            className={allPassed ? 'bg-bullish text-primary-foreground hover:bg-bullish/90' : ''}
          >
            {allPassed ? 'Approve & Execute' : 'Complete Checklist First'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface-2 rounded-md px-3 py-2">
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className="font-mono text-sm font-semibold text-foreground">{value}</div>
    </div>
  );
}
