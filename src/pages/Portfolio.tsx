import { useEffect, useState } from 'react';
import { AlertTriangle, TrendingDown, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

type Position = Tables<'positions'>;

export default function Portfolio() {
  const { user } = useAuth();
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchPositions = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('positions')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'open');
      setPositions(data || []);
      setLoading(false);
    };
    fetchPositions();
  }, [user]);

  const totalPnl = positions.reduce((s, p) => s + (p.pnl || 0), 0);
  const totalAlloc = positions.reduce((s, p) => s + (p.allocation || 0), 0);

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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard label="Positions" value={positions.length.toString()} />
        <SummaryCard
          label="Total P&L"
          value={`${totalPnl >= 0 ? '+' : ''}$${totalPnl.toLocaleString()}`}
          color={totalPnl >= 0 ? 'text-bullish' : 'text-bearish'}
        />
        <SummaryCard label="Allocation" value={`${totalAlloc.toFixed(1)}%`} sub="Target: 70-80%" />
        <SummaryCard label="Remaining" value={`${(80 - totalAlloc).toFixed(1)}%`} sub="Available to deploy" />
      </div>

      {positions.length === 0 ? (
        <div className="bg-card rounded-lg border border-border p-8 text-center">
          <p className="text-muted-foreground">No open positions yet. Approve a trade from the scanner to get started.</p>
        </div>
      ) : (
        <>
          {/* Positions table */}
          <div className="bg-card rounded-lg border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-2">
                    {['Ticker', 'Strike / Exp', 'Qty', 'Avg Cost', 'Current', 'P&L', 'Delta', 'DTE', 'Alloc %', 'Action'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {positions.map(pos => (
                    <tr key={pos.id} className="border-b border-border/50 hover:bg-accent/50 transition-colors">
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
                        <div className={`text-xs font-mono ${(pos.pnl_pct || 0) >= 0 ? 'text-bullish' : 'text-bearish'}`}>
                          {(pos.pnl_pct || 0) >= 0 ? '+' : ''}{(pos.pnl_pct || 0).toFixed(1)}%
                        </div>
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
        </>
      )}
    </div>
  );
}

function SummaryCard({ label, value, color, sub }: { label: string; value: string; color?: string; sub?: string }) {
  return (
    <div className="bg-card rounded-lg border border-border px-4 py-3">
      <div className="text-[11px] text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className={`text-2xl font-semibold font-mono mt-0.5 ${color || 'text-foreground'}`}>{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}
