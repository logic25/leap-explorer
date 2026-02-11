export interface Position {
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
  strategy_id: string | null;
  roll_status: string | null;
}

export interface Strategy {
  id: string;
  name: string;
  description: string;
  scanner_type: string;
  enabled: boolean;
  conditions: Record<string, unknown>;
}

export interface PlaybookStats {
  strategyId: string;
  name: string;
  winRate: number;
  netPnl: number;
  profitFactor: number;
  rrRatio: number;
  expectedReturn: number;
  tradeCount: number;
  avgHoldingDays: number;
}

export function computePlaybookStats(
  strategyId: string,
  name: string,
  closed: Position[]
): PlaybookStats {
  const trades = closed.filter(p => p.strategy_id === strategyId);
  const winners = trades.filter(p => (p.pnl || 0) > 0);
  const losers = trades.filter(p => (p.pnl || 0) <= 0);
  const winRate = trades.length > 0 ? winners.length / trades.length : 0;
  const avgWin = winners.length > 0 ? winners.reduce((s, p) => s + (p.pnl_pct || 0), 0) / winners.length : 0;
  const avgLoss = losers.length > 0 ? losers.reduce((s, p) => s + (p.pnl_pct || 0), 0) / losers.length : 0;
  const totalWin = winners.reduce((s, p) => s + (p.pnl || 0), 0);
  const totalLoss = Math.abs(losers.reduce((s, p) => s + (p.pnl || 0), 0));
  const profitFactor = totalLoss > 0 ? totalWin / totalLoss : totalWin > 0 ? Infinity : 0;
  const rrRatio = Math.abs(avgLoss) > 0 ? avgWin / Math.abs(avgLoss) : avgWin > 0 ? Infinity : 0;
  const expectedReturn = (winRate * avgWin) + ((1 - winRate) * avgLoss);

  // Avg holding period
  let avgHoldingDays = 0;
  const holdingDays = trades
    .filter(t => t.closed_at && t.created_at)
    .map(t => (new Date(t.closed_at!).getTime() - new Date(t.created_at).getTime()) / (1000 * 60 * 60 * 24));
  if (holdingDays.length > 0) {
    avgHoldingDays = holdingDays.reduce((s, d) => s + d, 0) / holdingDays.length;
  }

  return {
    strategyId,
    name,
    winRate: winRate * 100,
    netPnl: trades.reduce((s, p) => s + (p.pnl || 0), 0),
    profitFactor,
    rrRatio,
    expectedReturn,
    tradeCount: trades.length,
    avgHoldingDays,
  };
}
