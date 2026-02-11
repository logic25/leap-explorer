import { useState } from 'react';
import { AlertTriangle, TrendingDown, RefreshCw, Lock, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import type { Position } from './types';

interface PositionCardProps {
  pos: Position;
  onUpdateSL: (id: string, updates: Partial<Position>) => void;
  onExit: (id: string) => void;
  strategyName?: string;
  onStrategyClick?: (strategyId: string) => void;
}

export function PositionCard({ pos, onUpdateSL, onExit, strategyName, onStrategyClick }: PositionCardProps) {
  const [slPct, setSlPct] = useState(pos.stop_loss_pct ?? -35);
  const [profitTarget, setProfitTarget] = useState(pos.profit_target_pct ?? 50);
  const [trailingPct, setTrailingPct] = useState(pos.trailing_stop_pct ?? -20);
  const [slOpen, setSlOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const handleSave = () => {
    onUpdateSL(pos.id, {
      stop_loss_pct: slPct,
      profit_target_pct: profitTarget,
      trailing_stop_pct: trailingPct,
    });
    setSlOpen(false);
  };

  const pnlPct = pos.pnl_pct || 0;
  const sl = pos.stop_loss_pct ?? -35;
  const isNearSL = pnlPct < 0 && pnlPct <= sl * 0.7;

  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-3">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-mono font-semibold text-foreground">{pos.ticker}</span>
          <span className="text-xs text-muted-foreground">{pos.option_type}</span>
          {strategyName && (
            <button
              onClick={() => pos.strategy_id && onStrategyClick?.(pos.strategy_id)}
              className="text-xs px-2 py-0.5 rounded-full border border-primary/30 bg-primary/10 text-primary"
            >
              {strategyName}
            </button>
          )}
        </div>
        <div className="text-right">
          <div className={`font-mono font-medium text-sm ${(pos.pnl || 0) >= 0 ? 'text-bullish' : 'text-bearish'}`}>
            {(pos.pnl || 0) >= 0 ? '+' : ''}${(pos.pnl || 0).toLocaleString()}
          </div>
          <div className={`text-xs font-mono ${pnlPct >= 0 ? 'text-bullish' : 'text-bearish'}`}>
            {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Key metrics row */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <span className="text-muted-foreground">Strike</span>
          <div className="font-mono text-foreground">${pos.strike}</div>
        </div>
        <div>
          <span className="text-muted-foreground">Qty</span>
          <div className="font-mono text-foreground">{pos.qty}</div>
        </div>
        <div>
          <span className="text-muted-foreground">DTE</span>
          <div className={`font-mono ${(pos.dte || 0) < 90 ? 'text-bearish font-semibold' : 'text-foreground'}`}>
            {pos.dte || 0}
            {(pos.dte || 0) < 90 && <AlertTriangle className="h-3 w-3 inline ml-1 text-bearish" />}
          </div>
        </div>
      </div>

      {/* Expandable details */}
      {expanded && (
        <div className="grid grid-cols-3 gap-2 text-xs border-t border-border pt-2">
          <div>
            <span className="text-muted-foreground">Avg Cost</span>
            <div className="font-mono text-foreground">${(pos.avg_cost || 0).toFixed(2)}</div>
          </div>
          <div>
            <span className="text-muted-foreground">Current</span>
            <div className="font-mono text-foreground">${(pos.current_price || 0).toFixed(2)}</div>
          </div>
          <div>
            <span className="text-muted-foreground">Delta</span>
            <div className={`font-mono ${(pos.delta || 0) > 0.80 ? 'text-warning font-semibold' : 'text-foreground'}`}>
              {(pos.delta || 0).toFixed(2)}
            </div>
          </div>
          <div>
            <span className="text-muted-foreground">Alloc</span>
            <div className="font-mono text-foreground">{(pos.allocation || 0).toFixed(1)}%</div>
          </div>
          <div>
            <span className="text-muted-foreground">Expiry</span>
            <div className="font-mono text-foreground text-[11px]">{pos.expiry}</div>
          </div>
          <div>
            <span className="text-muted-foreground">Roll</span>
            <div>{pos.roll_status ? <span className="text-warning">{pos.roll_status}</span> : '—'}</div>
          </div>
        </div>
      )}

      {/* Actions row */}
      <div className="flex items-center justify-between pt-1 border-t border-border">
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-muted-foreground flex items-center gap-1 hover:text-foreground transition-colors"
        >
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {expanded ? 'Less' : 'More'}
        </button>

        <div className="flex items-center gap-2">
          <Popover open={slOpen} onOpenChange={setSlOpen}>
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
                SL {sl}%
                {pos.trailing_active && <Lock className="h-3 w-3 inline ml-1" />}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-72 space-y-4" align="end">
              <div className="text-sm font-semibold text-foreground">Stop Loss Settings</div>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Initial Stop Loss: {slPct}%</Label>
                  <Slider value={[Math.abs(slPct)]} onValueChange={([v]) => setSlPct(-v)} min={5} max={60} step={5} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Profit Target: +{profitTarget}%</Label>
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

          {pos.suggestion ? (
            <Button size="sm" variant="outline" className="text-xs gap-1 border-warning/40 text-warning hover:bg-warning/10 hover:text-warning">
              <RefreshCw className="h-3 w-3" />Roll
            </Button>
          ) : (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="outline" className="text-xs gap-1">
                  <TrendingDown className="h-3 w-3" />Exit
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Close {pos.ticker} position?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will mark your {pos.ticker} {pos.option_type} ${pos.strike} position as closed.
                    Current P&L: {(pos.pnl || 0) >= 0 ? '+' : ''}${(pos.pnl || 0).toLocaleString()} ({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(1)}%)
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => onExit(pos.id)} className="bg-bearish hover:bg-bearish/90">
                    Close Position
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>
    </div>
  );
}

export function ClosedPositionCard({ pos, strategyName, onStrategyClick }: {
  pos: Position;
  strategyName?: string;
  onStrategyClick?: (id: string) => void;
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-mono font-semibold text-foreground">{pos.ticker}</span>
          <span className="text-xs text-muted-foreground">{pos.option_type}</span>
          {strategyName && (
            <button
              onClick={() => pos.strategy_id && onStrategyClick?.(pos.strategy_id)}
              className="text-xs px-2 py-0.5 rounded-full border border-primary/30 bg-primary/10 text-primary"
            >
              {strategyName}
            </button>
          )}
        </div>
        <div className="text-right">
          <div className={`font-mono font-medium text-sm ${(pos.pnl || 0) >= 0 ? 'text-bullish' : 'text-bearish'}`}>
            {(pos.pnl || 0) >= 0 ? '+' : ''}${(pos.pnl || 0).toLocaleString()}
          </div>
          <div className={`text-xs font-mono ${(pos.pnl_pct || 0) >= 0 ? 'text-bullish' : 'text-bearish'}`}>
            {(pos.pnl_pct || 0) >= 0 ? '+' : ''}{(pos.pnl_pct || 0).toFixed(1)}%
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <span className="text-muted-foreground">Strike</span>
          <div className="font-mono text-foreground">${pos.strike}</div>
        </div>
        <div>
          <span className="text-muted-foreground">Entry</span>
          <div className="font-mono text-foreground">${(pos.avg_cost || 0).toFixed(2)}</div>
        </div>
        <div>
          <span className="text-muted-foreground">Exit</span>
          <div className="font-mono text-foreground">${(pos.exit_price || 0).toFixed(2)}</div>
        </div>
      </div>
      <div className="flex items-center justify-between text-xs pt-1 border-t border-border">
        <span className="text-muted-foreground">{pos.closed_at ? new Date(pos.closed_at).toLocaleDateString() : '—'}</span>
        <span className={`px-2 py-0.5 rounded-full border ${
          pos.exit_reason === 'stop_loss' ? 'bg-bearish/10 text-bearish border-bearish/20' :
          pos.exit_reason === 'trailing_stop' ? 'bg-warning/10 text-warning border-warning/20' :
          pos.exit_reason === 'roll' ? 'bg-primary/10 text-primary border-primary/20' :
          'bg-muted text-muted-foreground border-border'
        }`}>
          {pos.exit_reason === 'stop_loss' ? 'Stop Loss' :
           pos.exit_reason === 'trailing_stop' ? 'Trailing Stop' :
           pos.exit_reason === 'roll' ? 'Rolled' :
           pos.exit_reason || 'Manual'}
        </span>
      </div>
    </div>
  );
}
