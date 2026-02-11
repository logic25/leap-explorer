import { useEffect, useState } from 'react';
import { AlertTriangle, TrendingDown, RefreshCw, Loader2, Lock, Shield, Trophy, BarChart3, Hash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface Position {
  id: string;
  user_id: string;
  ticker: string;
  name: string | null;
  option_type: string;
  strike: number;
  expiry: string | null;
  qty: number;
  avg_cost: number | null;
  current_price: number | null;
  pnl: number | null;
  pnl_pct: number | null;
  delta: number | null;
  dte: number | null;
  allocation: number | null;
  status: string;
  suggestion: string | null;
  suggestion_type: string | null;
  stop_loss_pct: number | null;
  trailing_stop_pct: number | null;
  profit_target_pct: number | null;
  trailing_active: boolean;
  highest_pnl_pct: number | null;
  exit_price: number | null;
  closed_at: string | null;
  exit_reason: string | null;
  created_at: string;
  updated_at: string;
}

export default function Portfolio() {
  const { user } = useAuth();
  const [positions, setPositions] = useState<Position[]>([]);
  const [closedPositions, setClosedPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchPositions = async () => {
      setLoading(true);
      const [openRes, closedRes] = await Promise.all([
        supabase.from('positions').select('*').eq('user_id', user.id).eq('status', 'open'),
        supabase.from('positions').select('*').eq('user_id', user.id).eq('status', 'closed'),
      ]);
      setPositions((openRes.data as Position[]) || []);
      setClosedPositions((closedRes.data as Position[]) || []);
      setLoading(false);
    };
    fetchPositions();
  }, [user]);

  const updateStopLoss = async (posId: string, updates: Partial<Position>) => {
    await supabase.from('positions').update(updates).eq('id', posId);
    setPositions(prev => prev.map(p => p.id === posId ? { ...p, ...updates } : p));
  };

  const totalPnl = positions.reduce((s, p) => s + (p.pnl || 0), 0);
  const totalAlloc = positions.reduce((s, p) => s + (p.allocation || 0), 0);

  // Win rate stats from closed positions
  const winners = closedPositions.filter(p => (p.pnl || 0) > 0);
  const losers = closedPositions.filter(p => (p.pnl || 0) <= 0);
  const winRate = closedPositions.length > 0 ? (winners.length / closedPositions.length) * 100 : 0;
  const avgWin = winners.length > 0 ? winners.reduce((s, p) => s + (p.pnl_pct || 0), 0) / winners.length : 0;
  const avgLoss = losers.length > 0 ? losers.reduce((s, p) => s + (p.pnl_pct || 0), 0) / losers.length : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-slide-in">
      <h1 className="text-xl font-semibold text-foreground">Portfolio</h1>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <SummaryCard label="Positions" value={positions.length.toString()} icon={<Hash className="h-3.5 w-3.5" />} />
        <SummaryCard
          label="Total P&L"
          value={`${totalPnl >= 0 ? '+' : ''}$${totalPnl.toLocaleString()}`}
          color={totalPnl >= 0 ? 'text-bullish' : 'text-bearish'}
          icon={<BarChart3 className="h-3.5 w-3.5" />}
        />
        <SummaryCard label="Allocation" value={`${totalAlloc.toFixed(1)}%`} sub="Target: 70-80%" />
        <SummaryCard label="Win Rate" value={`${winRate.toFixed(0)}%`} color={winRate >= 50 ? 'text-bullish' : 'text-bearish'} icon={<Trophy className="h-3.5 w-3.5" />} />
        <SummaryCard label="Avg Win" value={`+${avgWin.toFixed(1)}%`} color="text-bullish" />
        <SummaryCard label="Avg Loss" value={`${avgLoss.toFixed(1)}%`} color="text-bearish" />
        <SummaryCard label="Closed" value={closedPositions.length.toString()} sub={`${winners.length}W / ${losers.length}L`} />
      </div>

      <Tabs defaultValue="open" className="space-y-4">
        <TabsList>
          <TabsTrigger value="open">Open ({positions.length})</TabsTrigger>
          <TabsTrigger value="closed">Closed ({closedPositions.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="open">
          {positions.length === 0 ? (
            <div className="bg-card rounded-lg border border-border p-8 text-center">
              <p className="text-muted-foreground">No open positions yet. Approve a trade from the scanner to get started.</p>
            </div>
          ) : (
            <>
              <div className="bg-card rounded-lg border border-border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-surface-2">
                        {['Ticker', 'Strike / Exp', 'Qty', 'Avg Cost', 'Current', 'P&L', 'Stop Loss', 'Delta', 'DTE', 'Alloc %', 'Action'].map(h => (
                          <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {positions.map(pos => (
                        <PositionRow key={pos.id} pos={pos} onUpdateSL={updateStopLoss} />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Suggestions */}
              {positions.filter(p => p.suggestion).map(pos => (
                <div key={pos.id} className="flex items-start gap-3 bg-warning/5 border border-warning/20 rounded-lg px-4 py-3">
                  <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                  <div>
                    <div className="text-sm font-medium text-foreground">
                      {pos.ticker}: {pos.suggestion}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Current delta {(pos.delta || 0).toFixed(2)} | DTE {pos.dte || 0} | P&L {(pos.pnl_pct || 0) >= 0 ? '+' : ''}{(pos.pnl_pct || 0).toFixed(1)}%
                    </div>
                  </div>
                </div>
              ))}

              {/* SL warnings */}
              {positions.filter(p => {
                const sl = p.stop_loss_pct || -35;
                const pnl = p.pnl_pct || 0;
                return pnl < 0 && pnl <= sl * 0.7; // within 30% of SL
              }).map(pos => (
                <div key={`sl-${pos.id}`} className="flex items-start gap-3 bg-bearish/5 border border-bearish/20 rounded-lg px-4 py-3">
                  <Shield className="h-4 w-4 text-bearish shrink-0 mt-0.5" />
                  <div>
                    <div className="text-sm font-medium text-foreground">
                      {pos.ticker}: Approaching stop loss ({pos.stop_loss_pct || -35}%)
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Current P&L: {(pos.pnl_pct || 0).toFixed(1)}% | SL triggers at {pos.stop_loss_pct || -35}%
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
        </TabsContent>

        <TabsContent value="closed">
          {closedPositions.length === 0 ? (
            <div className="bg-card rounded-lg border border-border p-8 text-center">
              <p className="text-muted-foreground">No closed trades yet.</p>
            </div>
          ) : (
            <div className="bg-card rounded-lg border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-surface-2">
                      {['Ticker', 'Strike / Exp', 'Entry', 'Exit', 'P&L', 'Reason', 'Closed'].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {closedPositions.map(pos => (
                      <tr key={pos.id} className="border-b border-border/50 hover:bg-accent/50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-mono font-semibold text-foreground">{pos.ticker}</div>
                          <div className="text-xs text-muted-foreground">{pos.option_type}</div>
                        </td>
                        <td className="px-4 py-3 font-mono text-foreground">
                          <div>${pos.strike}</div>
                          <div className="text-xs text-muted-foreground">{pos.expiry}</div>
                        </td>
                        <td className="px-4 py-3 font-mono text-foreground">${(pos.avg_cost || 0).toFixed(2)}</td>
                        <td className="px-4 py-3 font-mono text-foreground">${(pos.exit_price || 0).toFixed(2)}</td>
                        <td className="px-4 py-3">
                          <div className={`font-mono font-medium ${(pos.pnl || 0) >= 0 ? 'text-bullish' : 'text-bearish'}`}>
                            {(pos.pnl || 0) >= 0 ? '+' : ''}${(pos.pnl || 0).toLocaleString()}
                          </div>
                          <div className={`text-xs font-mono ${(pos.pnl_pct || 0) >= 0 ? 'text-bullish' : 'text-bearish'}`}>
                            {(pos.pnl_pct || 0) >= 0 ? '+' : ''}{(pos.pnl_pct || 0).toFixed(1)}%
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <ExitReasonBadge reason={pos.exit_reason} />
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {pos.closed_at ? new Date(pos.closed_at).toLocaleDateString() : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PositionRow({ pos, onUpdateSL }: { pos: Position; onUpdateSL: (id: string, updates: Partial<Position>) => void }) {
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
      {/* Stop Loss column */}
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
                <Slider
                  value={[Math.abs(slPct)]}
                  onValueChange={([v]) => setSlPct(-v)}
                  min={5}
                  max={60}
                  step={5}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Profit Target to activate trailing: +{profitTarget}%</Label>
                <Slider
                  value={[profitTarget]}
                  onValueChange={([v]) => setProfitTarget(v)}
                  min={10}
                  max={100}
                  step={5}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Trailing Stop: {trailingPct}% from peak</Label>
                <Slider
                  value={[Math.abs(trailingPct)]}
                  onValueChange={([v]) => setTrailingPct(-v)}
                  min={5}
                  max={40}
                  step={5}
                  className="mt-1"
                />
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
            <RefreshCw className="h-3 w-3" />
            Roll
          </Button>
        ) : (
          <Button size="sm" variant="outline" className="text-xs gap-1">
            <TrendingDown className="h-3 w-3" />
            Exit
          </Button>
        )}
      </td>
    </tr>
  );
}

function ExitReasonBadge({ reason }: { reason: string | null }) {
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

function SummaryCard({ label, value, color, sub, icon }: { label: string; value: string; color?: string; sub?: string; icon?: React.ReactNode }) {
  return (
    <div className="bg-card rounded-lg border border-border px-4 py-3">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground uppercase tracking-wider">
        {icon}
        {label}
      </div>
      <div className={`text-2xl font-semibold font-mono mt-0.5 ${color || 'text-foreground'}`}>{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}
