import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ScannerBadge } from './ScannerBadge';
import { TradingViewChart } from './TradingViewChart';
import { Check, X, AlertTriangle, ChevronDown, Info, Zap } from 'lucide-react';
import type { ScannerAlert } from '@/lib/mock-data';

interface Props {
  alert: ScannerAlert | null;
  open: boolean;
  onClose: () => void;
}

const CATEGORY_LABELS: Record<string, { label: string; icon: string }> = {
  scanner: { label: 'Scanner', icon: '📊' },
  greeks: { label: 'Greeks', icon: 'Δ' },
  liquidity: { label: 'Liquidity (OI)', icon: '💧' },
  spread: { label: 'Bid-Ask Spread', icon: '↔' },
  iv: { label: 'Implied Volatility', icon: '📈' },
  volume: { label: 'Options Volume', icon: '📦' },
  quality: { label: 'Chain Quality', icon: '⭐' },
  portfolio: { label: 'Portfolio', icon: '💼' },
};

const METRIC_TOOLTIPS: Record<string, string> = {
  Strike: 'Suggested strike price based on delta target and ATM proximity.',
  Delta: 'Rate of change in option price per $1 move in underlying. Target 0.40-0.65 for LEAPS.',
  Theta: 'Daily time decay in $ per day. Lower magnitude = less premium erosion.',
  Vega: 'Sensitivity to 1% change in implied volatility. Higher = more IV exposure.',
  DTE: 'Days to expiration. Target 700-900+ for LEAPS.',
  Ask: 'Current ask price for the option contract.',
  '12mo Low': '12-month historical low price for this option contract.',
  'IV %ile': 'Current IV relative to its 12-month range. Below 50 = relatively cheap.',
  'IV/HV': 'Implied Vol ÷ Historical Vol. Above 1.3 = options may be overpriced.',
  OI: 'Open Interest — total outstanding contracts. Below 1,000 = illiquid.',
  Spread: 'Bid-ask spread as % of mid price. Above 5% = significant slippage risk.',
  'Slippage': 'Estimated cost of crossing the spread per contract.',
  'Vol/OI': 'Today\'s volume ÷ open interest. Above 1.5 = unusual activity.',
  Quality: 'Chain Quality Score (0-100): OI 40%, Volume 30%, Spread 30%. Green >80.',
};

export function ChecklistModal({ alert, open, onClose }: Props) {
  const [checklistOpen, setChecklistOpen] = useState(true);
  if (!alert) return null;

  const allPassed = alert.checklist.every(c => c.passed);
  const passedCount = alert.checklist.filter(c => c.passed).length;

  // Group checklist by category
  const grouped = alert.checklist.reduce<Record<string, typeof alert.checklist>>((acc, item) => {
    const cat = (item as any).category || 'other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  const qualityScore = alert.chainQualityScore || 0;
  const qualityColor = qualityScore >= 80 ? 'text-bullish' : qualityScore >= 50 ? 'text-warning' : 'text-bearish';
  const qualityBg = qualityScore >= 80 ? 'bg-bullish/10 border-bullish/20' : qualityScore >= 50 ? 'bg-warning/10 border-warning/20' : 'bg-bearish/10 border-bearish/20';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl bg-card border-border max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span className="font-mono text-lg">{alert.ticker}</span>
            <ScannerBadge type={alert.scannerType} />
            {alert.unusualActivity && (
              <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-warning/10 border border-warning/20 text-warning">
                <Zap className="h-3 w-3" /> Unusual Activity
              </span>
            )}
            {qualityScore > 0 && (
              <span className={`text-xs px-2 py-0.5 rounded-full border font-mono font-semibold ${qualityBg} ${qualityColor}`}>
                Q:{qualityScore}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Key metrics */}
          <TooltipProvider delayDuration={200}>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-2">
              <MetricWithTooltip label="Strike" value={`$${alert.suggestedStrike}`} tooltip={METRIC_TOOLTIPS.Strike} />
              <MetricWithTooltip label="Delta" value={alert.delta.toFixed(2)} tooltip={METRIC_TOOLTIPS.Delta} />
              <MetricWithTooltip label="Theta" value={`${alert.theta.toFixed(3)}/d`} tooltip={METRIC_TOOLTIPS.Theta} warn={alert.theta < -0.05} />
              <MetricWithTooltip label="Vega" value={alert.vega.toFixed(2)} tooltip={METRIC_TOOLTIPS.Vega} />
              <MetricWithTooltip label="DTE" value={`${alert.dte}d`} tooltip={METRIC_TOOLTIPS.DTE} warn={alert.dte < 90} />
              <MetricWithTooltip label="Ask" value={`$${alert.askPrice.toFixed(2)}`} tooltip={METRIC_TOOLTIPS.Ask} />
              <MetricWithTooltip label="12mo Low" value={`$${alert.historicalLow.toFixed(2)}`} tooltip={METRIC_TOOLTIPS['12mo Low']} />
            </div>

            {/* Options Data Row */}
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              <MetricWithTooltip label="IV %ile" value={`${alert.ivPercentile}%`} tooltip={METRIC_TOOLTIPS['IV %ile']} />
              <MetricWithTooltip
                label="IV/HV"
                value={alert.ivHvRatio != null ? alert.ivHvRatio.toFixed(2) : '—'}
                tooltip={METRIC_TOOLTIPS['IV/HV']}
                warn={(alert.ivHvRatio || 0) > 1.3}
              />
              <MetricWithTooltip
                label="OI"
                value={alert.openInterest.toLocaleString()}
                tooltip={METRIC_TOOLTIPS.OI}
                warn={alert.openInterest < 1000}
              />
              <MetricWithTooltip
                label="Spread"
                value={`${alert.bidAskSpread.toFixed(1)}%`}
                tooltip={METRIC_TOOLTIPS.Spread}
                warn={alert.bidAskSpread > 5}
              />
              <MetricWithTooltip
                label="Vol/OI"
                value={alert.volumeOiRatio != null ? alert.volumeOiRatio.toFixed(2) : '—'}
                tooltip={METRIC_TOOLTIPS['Vol/OI']}
                warn={alert.unusualActivity}
              />
            </div>
          </TooltipProvider>

          {/* Warnings */}
          {alert.askPrice > alert.historicalLow * 1.15 && (
            <WarningBanner>
              Ask is {((alert.askPrice / alert.historicalLow - 1) * 100).toFixed(0)}% above 12-month low
            </WarningBanner>
          )}
          {alert.openInterest < 1000 && (
            <WarningBanner variant="bearish">
              OI is {alert.openInterest.toLocaleString()} — below 1,000 liquidity threshold. Consider wider strikes.
            </WarningBanner>
          )}
          {alert.bidAskSpread > 5 && (
            <WarningBanner variant="bearish">
              Bid-ask spread is {alert.bidAskSpread.toFixed(1)}% — above 5% threshold. Est. slippage: ${(alert.slippageEst || 0).toFixed(2)}/contract.
            </WarningBanner>
          )}
          {(alert.ivHvRatio || 0) > 1.3 && (
            <WarningBanner>
              IV/HV ratio is {alert.ivHvRatio?.toFixed(2)} — options may be overpriced relative to historical volatility.
            </WarningBanner>
          )}
          {alert.dte < 90 && (
            <WarningBanner variant="bearish">
              DTE is {alert.dte} — below 90-day theta acceleration zone. Consider rolling.
            </WarningBanner>
          )}

          {/* TradingView Chart */}
          <TradingViewChart ticker={alert.ticker} />

          {/* Categorized Checklist */}
          <Collapsible open={checklistOpen} onOpenChange={setChecklistOpen}>
            <CollapsibleTrigger asChild>
              <button className="flex items-center justify-between w-full text-xs font-semibold text-muted-foreground uppercase tracking-wider py-2 hover:text-foreground transition-colors">
                <span>Entry Checklist ({passedCount}/{alert.checklist.length} passed)</span>
                <ChevronDown className={`h-4 w-4 transition-transform ${checklistOpen ? 'rotate-180' : ''}`} />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="space-y-3 pt-1 pb-2">
                {Object.entries(grouped).map(([category, items]) => {
                  const catInfo = CATEGORY_LABELS[category] || { label: category, icon: '•' };
                  const catPassed = items.filter(i => i.passed).length;
                  const catAll = catPassed === items.length;
                  return (
                    <div key={category}>
                      <div className={`text-[10px] font-semibold uppercase tracking-wider mb-1 ${catAll ? 'text-bullish' : 'text-muted-foreground'}`}>
                        {catInfo.icon} {catInfo.label} ({catPassed}/{items.length})
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0.5">
                        {items.map((item, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs py-0.5">
                            {item.passed ? (
                              <Check className="h-3.5 w-3.5 text-bullish shrink-0" />
                            ) : (
                              <X className="h-3.5 w-3.5 text-bearish shrink-0" />
                            )}
                            <span className={item.passed ? 'text-foreground' : 'text-muted-foreground'}>
                              {item.label}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CollapsibleContent>
          </Collapsible>
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

function MetricWithTooltip({ label, value, tooltip, warn }: { label: string; value: string; tooltip: string; warn?: boolean }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={`bg-surface-2 rounded-md px-3 py-2 cursor-help ${warn ? 'ring-1 ring-warning/40' : ''}`}>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            {label}
            <Info className="h-2.5 w-2.5" />
          </div>
          <div className={`font-mono text-sm font-semibold ${warn ? 'text-warning' : 'text-foreground'}`}>{value}</div>
        </div>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs">{tooltip}</TooltipContent>
    </Tooltip>
  );
}

function WarningBanner({ children, variant = 'warning' }: { children: React.ReactNode; variant?: 'warning' | 'bearish' }) {
  const color = variant === 'bearish' ? 'bearish' : 'warning';
  return (
    <div className={`flex items-center gap-2 text-xs text-${color} bg-${color}/10 border border-${color}/20 rounded-md px-3 py-2`}>
      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
      {children}
    </div>
  );
}
