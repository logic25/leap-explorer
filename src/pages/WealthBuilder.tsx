import { useState, useEffect, useMemo } from 'react';
import { Target, TrendingUp, TrendingDown, DollarSign, Loader2, Sparkles, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface WealthGoal {
  id?: string;
  starting_capital: number;
  target_value: number;
  time_horizon_years: number;
}

export default function WealthBuilder() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [goal, setGoal] = useState<WealthGoal>({
    starting_capital: 300000,
    target_value: 10000000,
    time_horizon_years: 10,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [totalPnl, setTotalPnl] = useState(0);
  const [closedPositions, setClosedPositions] = useState<any[]>([]);
  const [strategies, setStrategies] = useState<any[]>([]);
  const [aiSuggestion, setAiSuggestion] = useState('');
  const [loadingAi, setLoadingAi] = useState(false);

  useEffect(() => {
    if (user) {
      loadGoal();
      loadPositions();
      loadStrategies();
    }
  }, [user]);

  const loadGoal = async () => {
    const { data } = await supabase
      .from('wealth_goals')
      .select('*')
      .eq('user_id', user!.id)
      .maybeSingle();
    if (data) {
      setGoal({
        id: data.id,
        starting_capital: Number(data.starting_capital),
        target_value: Number(data.target_value),
        time_horizon_years: data.time_horizon_years,
      });
    }
    setLoading(false);
  };

  const loadPositions = async () => {
    const { data } = await supabase
      .from('positions')
      .select('*')
      .eq('user_id', user!.id)
      .eq('status', 'closed')
      .order('closed_at');
    if (data) {
      setClosedPositions(data);
      setTotalPnl(data.reduce((sum, p) => sum + (Number(p.pnl) || 0), 0));
    }
  };

  const loadStrategies = async () => {
    const { data } = await supabase
      .from('strategies')
      .select('*')
      .eq('user_id', user!.id);
    if (data) setStrategies(data);
  };

  const saveGoal = async () => {
    if (!user) return;
    setSaving(true);
    try {
      if (goal.id) {
        const { error } = await supabase
          .from('wealth_goals')
          .update({
            starting_capital: goal.starting_capital,
            target_value: goal.target_value,
            time_horizon_years: goal.time_horizon_years,
          })
          .eq('id', goal.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('wealth_goals')
          .insert({
            user_id: user.id,
            starting_capital: goal.starting_capital,
            target_value: goal.target_value,
            time_horizon_years: goal.time_horizon_years,
          })
          .select()
          .single();
        if (error) throw error;
        setGoal(prev => ({ ...prev, id: (data as any).id }));
      }
      toast({ title: 'Goal saved!' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Save failed', description: err.message });
    }
    setSaving(false);
  };

  const requiredCagr = useMemo(() => {
    if (goal.starting_capital <= 0 || goal.time_horizon_years <= 0) return 0;
    return (Math.pow(goal.target_value / goal.starting_capital, 1 / goal.time_horizon_years) - 1) * 100;
  }, [goal]);

  const currentValue = goal.starting_capital + totalPnl;
  const elapsedYears = closedPositions.length > 0
    ? Math.max(0.1, (Date.now() - new Date(closedPositions[0].created_at).getTime()) / (365.25 * 24 * 3600 * 1000))
    : 0.1;
  const currentCagr = elapsedYears > 0
    ? (Math.pow(currentValue / goal.starting_capital, 1 / elapsedYears) - 1) * 100
    : 0;
  const projectedEndValue = goal.starting_capital * Math.pow(1 + currentCagr / 100, goal.time_horizon_years);
  const remainingYears = Math.max(0.1, goal.time_horizon_years - elapsedYears);
  const remainingCagr = currentValue > 0
    ? (Math.pow(goal.target_value / currentValue, 1 / remainingYears) - 1) * 100
    : 0;
  const paceStatus = currentCagr >= requiredCagr
    ? { label: 'On pace', color: 'text-bullish', diff: currentCagr - requiredCagr }
    : { label: `Behind by ${(requiredCagr - currentCagr).toFixed(1)}%`, color: 'text-bearish', diff: currentCagr - requiredCagr };

  // Chart data
  const chartData = useMemo(() => {
    const points = [];
    for (let y = 0; y <= goal.time_horizon_years; y++) {
      const required = goal.starting_capital * Math.pow(1 + requiredCagr / 100, y);
      const actual = y <= elapsedYears
        ? goal.starting_capital + (totalPnl * (y / Math.max(0.1, elapsedYears)))
        : null;
      const projected = goal.starting_capital * Math.pow(1 + currentCagr / 100, y);
      points.push({
        year: `Y${y}`,
        required: Math.round(required),
        actual: actual !== null ? Math.round(actual) : undefined,
        projected: Math.round(projected),
      });
    }
    return points;
  }, [goal, requiredCagr, currentCagr, totalPnl, elapsedYears]);

  // Strategy contribution
  const strategyContribution = useMemo(() => {
    const byStrategy: Record<string, number> = {};
    closedPositions.forEach(p => {
      const key = p.strategy_id || 'unassigned';
      byStrategy[key] = (byStrategy[key] || 0) + (Number(p.pnl) || 0);
    });
    return Object.entries(byStrategy).map(([id, pnl]) => {
      const strat = strategies.find(s => s.id === id);
      return { name: strat?.name || 'Unassigned', pnl, pct: totalPnl !== 0 ? ((pnl / Math.abs(totalPnl)) * 100) : 0 };
    }).sort((a, b) => b.pnl - a.pnl);
  }, [closedPositions, strategies, totalPnl]);

  const getAiSuggestion = async () => {
    if (!user) return;
    setLoadingAi(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: [{
            role: 'user',
            content: `I'm tracking a wealth goal: $${goal.starting_capital.toLocaleString()} → $${goal.target_value.toLocaleString()} in ${goal.time_horizon_years} years (${requiredCagr.toFixed(1)}% CAGR needed). Currently at $${currentValue.toLocaleString()} with ${currentCagr.toFixed(1)}% CAGR. ${paceStatus.label}. Total P&L: $${totalPnl.toLocaleString()}. Strategy breakdown: ${strategyContribution.map(s => `${s.name}: $${s.pnl.toLocaleString()}`).join(', ')}. Give me 2-3 actionable suggestions to ${currentCagr >= requiredCagr ? 'maintain pace and manage risk' : 'close the gap'}. Be specific about LEAPS options strategies.`,
          }],
        }),
      });
      if (!response.ok) throw new Error('AI request failed');
      const text = await response.text();
      // Parse SSE stream for non-streaming fallback
      const lines = text.split('\n').filter(l => l.startsWith('data: '));
      let result = '';
      for (const line of lines) {
        const json = line.slice(6).trim();
        if (json === '[DONE]') break;
        try {
          const parsed = JSON.parse(json);
          result += parsed.choices?.[0]?.delta?.content || '';
        } catch { /* skip */ }
      }
      setAiSuggestion(result || 'No suggestions available.');
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'AI error', description: err.message });
    }
    setLoadingAi(false);
  };

  const formatCurrency = (n: number) => `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6 animate-slide-in">
      <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
        <Target className="h-5 w-5 text-primary" />
        Wealth Builder
      </h1>

      {/* Goal Inputs */}
      <section className="bg-card rounded-lg border border-border p-5 space-y-4">
        <div className="text-sm font-semibold text-foreground">Goal Settings</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <Label className="text-xs text-muted-foreground">Starting Capital</Label>
            <Input
              type="number"
              value={goal.starting_capital}
              onChange={e => setGoal(prev => ({ ...prev, starting_capital: Number(e.target.value) }))}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Target Value</Label>
            <Input
              type="number"
              value={goal.target_value}
              onChange={e => setGoal(prev => ({ ...prev, target_value: Number(e.target.value) }))}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Time Horizon (years)</Label>
            <Input
              type="number"
              value={goal.time_horizon_years}
              onChange={e => setGoal(prev => ({ ...prev, time_horizon_years: Number(e.target.value) }))}
              className="mt-1"
            />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-muted-foreground">
            Required CAGR: <span className="font-semibold text-primary">{requiredCagr.toFixed(1)}%</span>
          </span>
          <Button size="sm" onClick={saveGoal} disabled={saving} className="gap-1 ml-auto">
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            Save Goal
          </Button>
        </div>
      </section>

      {/* Gap Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard label="Current Value" value={formatCurrency(currentValue)} icon={<DollarSign className="h-4 w-4" />} />
        <MetricCard label="Current CAGR" value={`${currentCagr.toFixed(1)}%`} icon={<TrendingUp className="h-4 w-4" />} color={currentCagr >= requiredCagr ? 'text-bullish' : 'text-bearish'} />
        <MetricCard label="Remaining CAGR Needed" value={`${remainingCagr.toFixed(1)}%`} icon={<TrendingDown className="h-4 w-4" />} />
        <MetricCard label="Projected End Value" value={formatCurrency(projectedEndValue)} icon={<Target className="h-4 w-4" />} color={projectedEndValue >= goal.target_value ? 'text-bullish' : 'text-bearish'} />
      </div>

      {/* Status */}
      <div className={`text-center text-sm font-semibold ${paceStatus.color} bg-card border border-border rounded-lg py-3`}>
        {paceStatus.label}
      </div>

      {/* Growth Chart */}
      <section className="bg-card rounded-lg border border-border p-5">
        <div className="text-sm font-semibold text-foreground mb-4">Growth Projection</div>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="year" stroke="hsl(var(--muted-foreground))" fontSize={12} />
            <YAxis
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickFormatter={v => `$${(v / 1000000).toFixed(1)}M`}
            />
            <Tooltip
              contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
              labelStyle={{ color: 'hsl(var(--foreground))' }}
              formatter={(value: number) => formatCurrency(value)}
            />
            <Legend />
            <Line type="monotone" dataKey="required" stroke="hsl(var(--primary))" strokeDasharray="5 5" name="Required Path" dot={false} />
            <Line type="monotone" dataKey="projected" stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" name="Projected" dot={false} />
            <Line type="monotone" dataKey="actual" stroke="hsl(142, 71%, 45%)" name="Actual" strokeWidth={2} dot={false} connectNulls={false} />
          </LineChart>
        </ResponsiveContainer>
      </section>

      {/* Strategy Contribution */}
      {strategyContribution.length > 0 && (
        <section className="bg-card rounded-lg border border-border p-5">
          <div className="text-sm font-semibold text-foreground mb-3">Strategy Contribution</div>
          <div className="space-y-2">
            {strategyContribution.map(s => (
              <div key={s.name} className="flex items-center justify-between text-sm">
                <span className="text-foreground">{s.name}</span>
                <div className="flex items-center gap-3">
                  <span className={`font-mono ${s.pnl >= 0 ? 'text-bullish' : 'text-bearish'}`}>
                    {s.pnl >= 0 ? '+' : ''}{formatCurrency(s.pnl)}
                  </span>
                  <span className="text-xs text-muted-foreground w-12 text-right">{s.pct.toFixed(0)}%</span>
                  <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${s.pnl >= 0 ? 'bg-bullish' : 'bg-bearish'}`}
                      style={{ width: `${Math.min(100, Math.abs(s.pct))}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* AI Suggestions */}
      <section className="bg-card rounded-lg border border-border p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            AI Suggestions
          </div>
          <Button variant="outline" size="sm" onClick={getAiSuggestion} disabled={loadingAi} className="gap-1">
            {loadingAi ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            Get Advice
          </Button>
        </div>
        {aiSuggestion ? (
          <div className="text-sm text-muted-foreground whitespace-pre-wrap bg-background/50 border border-border rounded p-3">
            {aiSuggestion}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic">Click "Get Advice" for personalized AI suggestions based on your goal progress.</p>
        )}
      </section>
    </div>
  );
}

function MetricCard({ label, value, icon, color }: { label: string; value: string; icon: React.ReactNode; color?: string }) {
  return (
    <div className="bg-card rounded-lg border border-border p-4">
      <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <div className={`text-lg font-semibold ${color || 'text-foreground'}`}>{value}</div>
    </div>
  );
}
