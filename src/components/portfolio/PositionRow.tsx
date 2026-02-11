import { useState } from 'react';
import { AlertTriangle, TrendingDown, RefreshCw, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import type { Position } from './types';

interface PositionRowProps {
  pos: Position;
  onUpdateSL: (id: string, updates: Partial<Position>) => void;
  strategyName?: string;
  onStrategyClick?: (strategyId: string) => void;
  showPlaybook?: boolean;
}

export function PositionRow({ pos, onUpdateSL, strategyName, onStrategyClick, showPlaybook }: PositionRowProps) {
  const [slPct, setSlPct] = useState(pos.stop_loss_pct ?? -35);
  const [profitTarget, setProfitTarget] = useState(pos.profit_target_pct ?? 50);
  const [trailingPct, setTrailingPct] = useState(pos.trailing_stop_pct ?? -20);
  const [open, setOpen] = useState(false);

  const handleSave = () => {
    onUpdateSL(pos.id, {
      stop_loss_pct: slPct,
      profit_target_pct: profitTarget,
      trailing_stop_pct: trailingPct,
    });
    setOpen(false);
  };

  const pnlPct = pos.pnl_pct || 0;
  const sl = pos.stop_loss_pct ?? -35;
  const isNearSL = pnlPct < 0 && pnlPct <= sl * 0.7;

  return (
    <tr className="border-b border-border/50 hover:bg-accent/50 transition-colors">
      <td className="px-4 py-3">
        <div className="font-mono font-semibold text-foreground">{pos.ticker}</div>
        <div className="text-xs text-muted-foreground">{pos.option_type}</div>
      </td>
      {showPlaybook && (
        <td className="px-4 py-3">
          {strategyName ? (
            <button
              onClick={() => pos.strategy_id && onStrategyClick?.(pos.strategy_id)}
              className="text-xs px-2 py-0.5 rounded-full border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 transition-colors cursor-pointer font-medium"
            >
              {strategyName}
            </button>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </td>
      )}
      <td className="px-4 py-3 font-mono text-foreground">
        <div>${pos.strike}</div>
        <div className="text-xs text-muted-foreground">{pos.expiry}</div>
      </td>
      <td className="px-4 py-3 font-mono text-foreground">{pos.qty}</td>
      <td className="px-4 py-3 font-mono text-foreground">${(pos.avg_cost || 0).toFixed(2)}</td>
      <td className="px-4 py-3 font-mono text-foreground">${(pos.current_price || 0).toFixed(2)}</td>
      <td className="px-4 py-3">
        <div className={`font-mono font-medium ${(pos.pnl || 0) >= 0 ? 'text-bullish' : 'text-bearish'}`}>
          {(pos.pnl || 0) >= 0 ? '+' : ''}${(pos.pnl || 0).toLocaleString()}
        </div>
        <div className={`text-xs font-mono ${pnlPct >= 0 ? 'text-bullish' : 'text-bearish'}`}>
          {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(1)}%
        </div>
      </td>
      <td className="px-4 py-3">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              className={`font-mono text-xs px-2 py-1 rounded border transition-colors cursor-pointer ${
                pos.trailing_active
                  ? 'border-bullish/40 bg-bullish/10 text-bullish'
                  : isNearSL
                    ? 'border-bearish/40 bg-bearish/10 text-bearish'
                    : 'border-border bg-surface-2 text-foreground'
              }`}
            >
              {sl}%
              {pos.trailing_active && <Lock className="h-3 w-3 inline ml-1" />}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-72 space-y-4" align="start">
            <div className="text-sm font-semibold text-foreground">Stop Loss Settings</div>
            <div className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">Initial Stop Loss: {slPct}%</Label>
                <Slider value={[Math.abs(slPct)]} onValueChange={([v]) => setSlPct(-v)} min={5} max={60} step={5} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Profit Target to activate trailing: +{profitTarget}%</Label>
                <Slider value={[profitTarget]} onValueChange={([v]) => setProfitTarget(v)} min={10} max={100} step={5} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Trailing Stop: {trailingPct}% from peak</Label>
                <Slider value={[Math.abs(trailingPct)]} onValueChange={([v]) => setTrailingPct(-v)} min={5} max={40} step={5} className="mt-1" />
              </div>
            </div>
            <Button size="sm" onClick={handleSave} className="w-full">Save</Button>
          </PopoverContent>
        </Popover>
      </td>
      <td className={`px-4 py-3 font-mono ${(pos.delta || 0) > 0.80 ? 'text-warning font-semibold' : 'text-foreground'}`}>
        {(pos.delta || 0).toFixed(2)}
      </td>
      <td className={`px-4 py-3 font-mono ${(pos.dte || 0) < 90 ? 'text-bearish font-semibold' : 'text-foreground'}`}>
        {pos.dte || 0}
        {(pos.dte || 0) < 90 && <AlertTriangle className="h-3 w-3 inline ml-1 text-bearish" />}
      </td>
      <td className="px-4 py-3 font-mono text-foreground">{(pos.allocation || 0).toFixed(1)}%</td>
      <td className="px-4 py-3">
        {pos.suggestion ? (
          <Button size="sm" variant="outline" className="text-xs gap-1 border-warning/40 text-warning hover:bg-warning/10 hover:text-warning">
            <RefreshCw className="h-3 w-3" />Roll
          </Button>
        ) : (
          <Button size="sm" variant="outline" className="text-xs gap-1">
            <TrendingDown className="h-3 w-3" />Exit
          </Button>
        )}
      </td>
    </tr>
  );
}

export function ExitReasonBadge({ reason }: { reason: string | null }) {
  const config: Record<string, { label: string; className: string }> = {
    stop_loss: { label: 'Stop Loss', className: 'bg-bearish/10 text-bearish border-bearish/20' },
    trailing_stop: { label: 'Trailing Stop', className: 'bg-warning/10 text-warning border-warning/20' },
    manual: { label: 'Manual', className: 'bg-muted text-muted-foreground border-border' },
    roll: { label: 'Rolled', className: 'bg-primary/10 text-primary border-primary/20' },
  };
  const c = config[reason || ''] || { label: reason || 'Unknown', className: 'bg-muted text-muted-foreground border-border' };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border ${c.className}`}>
      {c.label}
    </span>
  );
}
