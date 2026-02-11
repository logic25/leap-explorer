import { useEffect, useState, useMemo } from 'react';
import { AlertTriangle, Shield, Trophy, BarChart3, Hash, Scale, TrendingUp, Loader2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { SummaryCard } from '@/components/portfolio/SummaryCard';
import { PositionRow, ExitReasonBadge } from '@/components/portfolio/PositionRow';
import { PositionCard, ClosedPositionCard } from '@/components/portfolio/PositionCard';
import { PlaybookPerformance } from '@/components/portfolio/PlaybookPerformance';
import { useIsMobile } from '@/hooks/use-mobile';
import { TradeCalendar } from '@/components/portfolio/TradeCalendar';
import { computePlaybookStats } from '@/components/portfolio/types';
import type { Position, Strategy } from '@/components/portfolio/types';
import { toast } from 'sonner';

export default function Portfolio() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [positions, setPositions] = useState<Position[]>([]);
  const [closedPositions, setClosedPositions] = useState<Position[]>([]);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [playbookFilter, setPlaybookFilter] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      setLoading(true);
      const [openRes, closedRes, stratRes] = await Promise.all([
        supabase.from('positions').select('*').eq('user_id', user.id).eq('status', 'open'),
        supabase.from('positions').select('*').eq('user_id', user.id).eq('status', 'closed'),
        supabase.from('strategies').select('*').eq('user_id', user.id),
      ]);
      setPositions((openRes.data as Position[]) || []);
      setClosedPositions((closedRes.data as Position[]) || []);
      setStrategies((stratRes.data as Strategy[]) || []);
      setLoading(false);
    };
    fetch();
  }, [user]);

  const updateStopLoss = async (posId: string, updates: Partial<Position>) => {
    await supabase.from('positions').update(updates).eq('id', posId);
    setPositions(prev => prev.map(p => p.id === posId ? { ...p, ...updates } : p));
  };

  const handleExit = async (posId: string) => {
    const pos = positions.find(p => p.id === posId);
    if (!pos) return;
    const updates = {
      status: 'closed',
      exit_price: pos.current_price,
      exit_reason: 'manual',
      closed_at: new Date().toISOString(),
    };
    const { error } = await supabase.from('positions').update(updates).eq('id', posId);
    if (error) {
      toast.error('Failed to close position');
      return;
    }
    const closedPos = { ...pos, ...updates } as Position;
    setPositions(prev => prev.filter(p => p.id !== posId));
    setClosedPositions(prev => [closedPos, ...prev]);
    toast.success(`${pos.ticker} position closed`);
  };

  const strategyMap = useMemo(() => new Map(strategies.map(s => [s.id, s.name])), [strategies]);

  // Filtering
  const filteredPositions = playbookFilter
    ? positions.filter(p => p.strategy_id === playbookFilter)
    : positions;
  const filteredClosed = playbookFilter
    ? closedPositions.filter(p => p.strategy_id === playbookFilter)
    : closedPositions;

  // Stats
  const totalPnl = filteredPositions.reduce((s, p) => s + (p.pnl || 0), 0);
  const totalAlloc = filteredPositions.reduce((s, p) => s + (p.allocation || 0), 0);
  const winners = filteredClosed.filter(p => (p.pnl || 0) > 0);
  const losers = filteredClosed.filter(p => (p.pnl || 0) <= 0);
  const winRate = filteredClosed.length > 0 ? (winners.length / filteredClosed.length) * 100 : 0;
  const avgWin = winners.length > 0 ? winners.reduce((s, p) => s + (p.pnl_pct || 0), 0) / winners.length : 0;
  const avgLoss = losers.length > 0 ? losers.reduce((s, p) => s + (p.pnl_pct || 0), 0) / losers.length : 0;

  // R:R and Profit Factor
  const rrRatio = Math.abs(avgLoss) > 0 ? avgWin / Math.abs(avgLoss) : avgWin > 0 ? Infinity : 0;
  const totalWinPnl = winners.reduce((s, p) => s + (p.pnl || 0), 0);
  const totalLossPnl = Math.abs(losers.reduce((s, p) => s + (p.pnl || 0), 0));
  const profitFactor = totalLossPnl > 0 ? totalWinPnl / totalLossPnl : totalWinPnl > 0 ? Infinity : 0;
  const dollarRR = totalLossPnl > 0 ? totalWinPnl / totalLossPnl : 0;

  // Playbook stats
  const playbookStats = useMemo(() => {
    const ids = new Set(closedPositions.map(p => p.strategy_id).filter(Boolean) as string[]);
    return Array.from(ids).map(id => computePlaybookStats(id, strategyMap.get(id) || 'Unknown', closedPositions));
  }, [closedPositions, strategyMap]);

  const handlePlaybookClick = (id: string) => {
    setPlaybookFilter(prev => prev === id ? null : id);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const openHeaders = ['Ticker', 'Playbook', 'Strike / Exp', 'Qty', 'Avg Cost', 'Current', 'P&L', 'Stop Loss', 'Delta', 'DTE', 'Alloc %', 'Roll Status', 'Action'];
  const closedHeaders = ['Ticker', 'Playbook', 'Strike / Exp', 'Entry', 'Exit', 'P&L', 'Reason', 'Closed'];

  return (
    <div className="space-y-6 animate-slide-in">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">Portfolio</h1>
        <div className="flex items-center gap-2">
          {playbookFilter && (
            <button
              onClick={() => setPlaybookFilter(null)}
              className="text-xs text-primary hover:text-primary/80 transition-colors cursor-pointer"
            >
              ✕ Clear filter
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9 gap-3">
        <SummaryCard label="Positions" value={filteredPositions.length.toString()} icon={<Hash className="h-3.5 w-3.5" />} tooltip="Number of currently open positions in your portfolio." />
        <SummaryCard
          label="Total P&L"
          value={`${totalPnl >= 0 ? '+' : ''}$${totalPnl.toLocaleString()}`}
          color={totalPnl >= 0 ? 'text-bullish' : 'text-bearish'}
          icon={<BarChart3 className="h-3.5 w-3.5" />}
          tooltip="Combined unrealized profit/loss across all open positions."
        />
        <SummaryCard label="Allocation" value={`${totalAlloc.toFixed(1)}%`} sub="Target: 70-80%" tooltip="Total portfolio capital allocated to open positions. Target range is 70-80% to leave room for new opportunities." />
        <SummaryCard label="Win Rate" value={`${winRate.toFixed(0)}%`} color={winRate >= 50 ? 'text-bullish' : 'text-bearish'} icon={<Trophy className="h-3.5 w-3.5" />} tooltip="Percentage of closed trades that were profitable. Above 50% means more winners than losers." />
        <SummaryCard label="Avg Win" value={`+${avgWin.toFixed(1)}%`} color="text-bullish" tooltip="Average percentage return on winning trades. Higher = better quality wins." />
        <SummaryCard label="Avg Loss" value={`${avgLoss.toFixed(1)}%`} color="text-bearish" tooltip="Average percentage loss on losing trades. Closer to 0% = better risk management." />
        <SummaryCard label="Closed" value={filteredClosed.length.toString()} sub={`${winners.length}W / ${losers.length}L`} tooltip="Total closed trades with win/loss breakdown." />
        <SummaryCard
          label="R:R Ratio"
          value={rrRatio === Infinity ? '∞' : `${rrRatio.toFixed(1)}:1`}
          icon={<Scale className="h-3.5 w-3.5" />}
          tooltip={`Risk/Reward Ratio = Average Win % ÷ |Average Loss %|. Above 1.5:1 is good. Dollar-weighted: $${dollarRR.toFixed(2)} per $1 risked.`}
          color={rrRatio >= 1.5 ? 'text-bullish' : rrRatio >= 1 ? 'text-warning' : 'text-bearish'}
        />
        <SummaryCard
          label="Profit Factor"
          value={profitFactor === Infinity ? '∞' : profitFactor.toFixed(2)}
          icon={<TrendingUp className="h-3.5 w-3.5" />}
          sub={profitFactor >= 2 ? 'Excellent' : profitFactor >= 1.5 ? 'Good' : profitFactor >= 1 ? 'Marginal' : 'Losing'}
          color={profitFactor >= 2 ? 'text-bullish' : profitFactor >= 1 ? 'text-warning' : 'text-bearish'}
          tooltip="Total $ won ÷ Total $ lost. Above 2.0 = excellent, 1.5+ = good, below 1.0 = losing money overall."
        />
      </div>

      {/* Playbook Performance */}
      {playbookStats.length > 0 && (
        <PlaybookPerformance
          stats={playbookStats}
          onPlaybookClick={handlePlaybookClick}
          activeFilter={playbookFilter}
        />
      )}

      <Tabs defaultValue="open" className="space-y-4">
        <TabsList>
          <TabsTrigger value="open">Open ({filteredPositions.length})</TabsTrigger>
          <TabsTrigger value="closed">Closed ({filteredClosed.length})</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
        </TabsList>

        <TabsContent value="open">
          {filteredPositions.length === 0 ? (
            <div className="bg-card rounded-lg border border-border p-8 text-center">
              <p className="text-muted-foreground">
                {playbookFilter ? 'No open positions for this playbook.' : 'No open positions yet. Approve a trade from the scanner to get started.'}
              </p>
            </div>
          ) : (
            <>
              {isMobile ? (
                <div className="space-y-3">
                  {filteredPositions.map(pos => (
                    <PositionCard
                      key={pos.id}
                      pos={pos}
                      onUpdateSL={updateStopLoss}
                      onExit={handleExit}
                      strategyName={pos.strategy_id ? strategyMap.get(pos.strategy_id) : undefined}
                      onStrategyClick={handlePlaybookClick}
                    />
                  ))}
                </div>
              ) : (
                <div className="bg-card rounded-lg border border-border overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-surface-2">
                          {openHeaders.map(h => (
                            <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPositions.map(pos => (
                          <PositionRow
                            key={pos.id}
                            pos={pos}
                            onUpdateSL={updateStopLoss}
                            onExit={handleExit}
                            strategyName={pos.strategy_id ? strategyMap.get(pos.strategy_id) : undefined}
                            onStrategyClick={handlePlaybookClick}
                            showPlaybook={true}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Suggestions */}
              {filteredPositions.filter(p => p.suggestion).map(pos => (
                <div key={pos.id} className="flex items-start gap-3 bg-warning/5 border border-warning/20 rounded-lg px-4 py-3">
                  <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                  <div>
                    <div className="text-sm font-medium text-foreground">{pos.ticker}: {pos.suggestion}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Current delta {(pos.delta || 0).toFixed(2)} | DTE {pos.dte || 0} | P&L {(pos.pnl_pct || 0) >= 0 ? '+' : ''}{(pos.pnl_pct || 0).toFixed(1)}%
                    </div>
                  </div>
                </div>
              ))}

              {/* SL warnings */}
              {filteredPositions.filter(p => {
                const sl = p.stop_loss_pct || -35;
                const pnl = p.pnl_pct || 0;
                return pnl < 0 && pnl <= sl * 0.7;
              }).map(pos => (
                <div key={`sl-${pos.id}`} className="flex items-start gap-3 bg-bearish/5 border border-bearish/20 rounded-lg px-4 py-3">
                  <Shield className="h-4 w-4 text-bearish shrink-0 mt-0.5" />
                  <div>
                    <div className="text-sm font-medium text-foreground">{pos.ticker}: Approaching stop loss ({pos.stop_loss_pct || -35}%)</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Current P&L: {(pos.pnl_pct || 0).toFixed(1)}% | SL triggers at {pos.stop_loss_pct || -35}%</div>
                  </div>
                </div>
              ))}
            </>
          )}
        </TabsContent>

        <TabsContent value="closed">
          {filteredClosed.length === 0 ? (
            <div className="bg-card rounded-lg border border-border p-8 text-center">
              <p className="text-muted-foreground">
                {playbookFilter ? 'No closed trades for this playbook.' : 'No closed trades yet.'}
              </p>
            </div>
          ) : isMobile ? (
            <div className="space-y-3">
              {filteredClosed.map(pos => (
                <ClosedPositionCard
                  key={pos.id}
                  pos={pos}
                  strategyName={pos.strategy_id ? strategyMap.get(pos.strategy_id) : undefined}
                  onStrategyClick={handlePlaybookClick}
                />
              ))}
            </div>
          ) : (
            <div className="bg-card rounded-lg border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-surface-2">
                      {closedHeaders.map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredClosed.map(pos => (
                      <tr key={pos.id} className="border-b border-border/50 hover:bg-accent/50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-mono font-semibold text-foreground">{pos.ticker}</div>
                          <div className="text-xs text-muted-foreground">{pos.option_type}</div>
                        </td>
                        <td className="px-4 py-3">
                          {pos.strategy_id && strategyMap.get(pos.strategy_id) ? (
                            <button
                              onClick={() => handlePlaybookClick(pos.strategy_id!)}
                              className="text-xs px-2 py-0.5 rounded-full border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 transition-colors cursor-pointer font-medium"
                            >
                              {strategyMap.get(pos.strategy_id!)}
                            </button>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
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
                        <td className="px-4 py-3"><ExitReasonBadge reason={pos.exit_reason} /></td>
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

        <TabsContent value="calendar">
          <TradeCalendar closedPositions={filteredClosed} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
