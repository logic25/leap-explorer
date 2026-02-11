import { useState, useEffect, useMemo } from 'react';
import { Target, TrendingUp, TrendingDown, DollarSign, Loader2, Sparkles, Save, SlidersHorizontal, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend, Area, AreaChart, ReferenceLine } from 'recharts';

interface WealthGoal {
  id?: string;
  starting_capital: number;
  target_value: number;
  time_horizon_years: number;
}

const METRIC_TOOLTIPS: Record<string, string> = {
  'Current Value': 'Starting capital plus total realized P&L from all closed trades.',
  'Current CAGR': 'Your annualized return based on actual trading performance so far.',
  'Remaining CAGR': 'The annualized return you need from today to hit your target on time.',
  'Projected End': 'Where you\'ll end up if your current CAGR continues for the full horizon.',
};

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
  // Forecast sliders
  const [forecastCagr, setForecastCagr] = useState(30);
  const [forecastVol, setForecastVol] = useState(10);

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

  const fmt = (n: number) => {
    if (n >= 1e12) return `$${(n / 1e12).toFixed(1)}T`;
    if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
    if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
    return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  };
  const fmtPct = (n: number) => n > 9999 ? '>9,999%' : `${n.toFixed(1)}%`;

  const currentValue = goal.starting_capital + totalPnl;
  
  // Use the earliest closed_at date as the real start of trading history
  const elapsedYears = useMemo(() => {
    if (closedPositions.length === 0) return 0;
    const earliestClose = closedPositions.reduce((earliest, p) => {
      const d = new Date(p.closed_at || p.created_at).getTime();
      return d < earliest ? d : earliest;
    }, Infinity);
    return Math.max(0, (Date.now() - earliestClose) / (365.25 * 24 * 3600 * 1000));
  }, [closedPositions]);

  const currentCagr = elapsedYears > 0.1 && goal.starting_capital > 0
    ? (Math.pow(Math.max(currentValue, 0.01) / goal.starting_capital, 1 / elapsedYears) - 1) * 100
    : 0;
  const remainingYears = Math.max(0.1, goal.time_horizon_years - elapsedYears);
  const cappedCagr = Math.min(currentCagr, 999);
  const projectedEndValue = currentValue * Math.pow(1 + cappedCagr / 100, remainingYears);
  const remainingCagr = currentValue > 0
    ? (Math.pow(goal.target_value / currentValue, 1 / remainingYears) - 1) * 100
    : 0;
  const paceStatus = currentCagr >= requiredCagr
    ? { label: 'On pace', color: 'text-bullish', bg: 'bg-bullish/10 border-bullish/30' }
    : { label: `Behind by ${fmtPct(requiredCagr - currentCagr)}`, color: 'text-bearish', bg: 'bg-bearish/10 border-bearish/30' };

  // Combined chart data — single chart with all scenario lines
  const combinedChartData = useMemo(() => {
    const points = [];
    const totalYears = goal.time_horizon_years;
    const elapsedFloor = Math.floor(elapsedYears);
    for (let y = 0; y <= totalYears; y++) {
      const required = goal.starting_capital * Math.pow(1 + requiredCagr / 100, y);
      // Actual line: interpolate from starting_capital to currentValue over elapsed period
      const actual = y <= elapsedYears
        ? goal.starting_capital + (totalPnl * (y / Math.max(0.01, elapsedYears)))
        : undefined;
      // Projected: from currentValue at the elapsed point, compound remaining at currentCagr
      const projected = y <= elapsedYears
        ? actual
        : currentValue * Math.pow(1 + currentCagr / 100, y - elapsedYears);
      // Scenarios: compound from currentValue starting at the elapsed point
      const yearsFromNow = Math.max(0, y - elapsedYears);
      const bull = y < elapsedFloor ? undefined : currentValue * Math.pow(1 + (forecastCagr + forecastVol) / 100, yearsFromNow);
      const base = y < elapsedFloor ? undefined : currentValue * Math.pow(1 + forecastCagr / 100, yearsFromNow);
      const bear = y < elapsedFloor ? undefined : currentValue * Math.pow(1 + Math.max(forecastCagr - forecastVol, 0) / 100, yearsFromNow);
      points.push({
        year: `Y${y}`,
        target: Math.round(required),
        actual: actual !== undefined ? Math.round(actual) : undefined,
        projected: projected !== undefined ? Math.round(projected) : undefined,
        bull: bull !== undefined ? Math.round(bull) : undefined,
        base: base !== undefined ? Math.round(base) : undefined,
        bear: bear !== undefined ? Math.round(bear) : undefined,
      });
    }
    return points;
  }, [goal, requiredCagr, currentCagr, totalPnl, elapsedYears, currentValue, forecastCagr, forecastVol]);

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


  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const endBase = combinedChartData[combinedChartData.length - 1];

  return (
    <div className="max-w-4xl space-y-6 animate-slide-in">
      <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
        <Target className="h-5 w-5 text-primary" />
        Wealth Builder
      </h1>

      {/* Goal Setup + Pace Status */}
      <section className="bg-card rounded-lg border border-border p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="text-sm font-semibold text-foreground">Goal Settings</div>
          <div className={`text-xs font-semibold px-3 py-1 rounded-full border ${paceStatus.bg} ${paceStatus.color}`}>
            {paceStatus.label}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <Label className="text-xs text-muted-foreground">Starting Capital</Label>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
              <Input
                type="number"
                value={goal.starting_capital}
                onChange={e => setGoal(prev => ({ ...prev, starting_capital: Number(e.target.value) }))}
                className="pl-7"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Target Value</Label>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
              <Input
                type="number"
                value={goal.target_value}
                onChange={e => setGoal(prev => ({ ...prev, target_value: Number(e.target.value) }))}
                className="pl-7"
              />
            </div>
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
        <div className="flex items-center gap-4 flex-wrap">
          <span className="text-xs text-muted-foreground">
            Required CAGR: <span className="font-semibold text-primary">{requiredCagr.toFixed(1)}%</span>
          </span>
          <Button size="sm" onClick={saveGoal} disabled={saving} className="gap-1 ml-auto">
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            Save Goal
          </Button>
        </div>
      </section>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard label="Current Value" value={fmt(currentValue)} icon={<DollarSign className="h-4 w-4" />} tooltip={METRIC_TOOLTIPS['Current Value']} />
        <MetricCard label="Current CAGR" value={fmtPct(currentCagr)} icon={<TrendingUp className="h-4 w-4" />} color={currentCagr >= requiredCagr ? 'text-bullish' : 'text-bearish'} tooltip={METRIC_TOOLTIPS['Current CAGR']} />
        <MetricCard label="Remaining CAGR" value={fmtPct(remainingCagr)} icon={<TrendingDown className="h-4 w-4" />} tooltip={METRIC_TOOLTIPS['Remaining CAGR']} />
        <MetricCard label="Projected End" value={fmt(projectedEndValue)} icon={<Target className="h-4 w-4" />} color={projectedEndValue >= goal.target_value ? 'text-bullish' : 'text-bearish'} tooltip={METRIC_TOOLTIPS['Projected End']} />
      </div>

      {/* Combined Projection Chart with Scenario Sliders */}
      <section className="bg-card rounded-lg border border-border p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <SlidersHorizontal className="h-4 w-4 text-primary" />
            Growth & Scenario Projection
          </div>
        </div>

        {/* Inline sliders */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Forecast CAGR</Label>
              <span className="text-xs font-mono text-foreground">{forecastCagr}%</span>
            </div>
            <Slider min={5} max={200} step={1} value={[forecastCagr]} onValueChange={([v]) => setForecastCagr(v)} />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Volatility ±</Label>
              <span className="text-xs font-mono text-foreground">±{forecastVol}%</span>
            </div>
            <Slider min={2} max={25} step={1} value={[forecastVol]} onValueChange={([v]) => setForecastVol(v)} />
          </div>
        </div>

        <ResponsiveContainer width="100%" height={350}>
          <AreaChart data={combinedChartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="year" stroke="hsl(var(--muted-foreground))" fontSize={12} />
            <YAxis
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickFormatter={v => v >= 1000000 ? `$${(v / 1000000).toFixed(1)}M` : `$${(v / 1000).toFixed(0)}K`}
            />
            <RechartsTooltip
              contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
              labelStyle={{ color: 'hsl(var(--foreground))' }}
              formatter={(value: number, name: string) => [fmt(value), name]}
            />
            <Legend />
            <defs>
              <linearGradient id="scenarioBand" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.1} />
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="bull" stroke="hsl(142, 71%, 45%)" fill="none" strokeDasharray="4 4" name={`Bull (${forecastCagr + forecastVol}%)`} dot={false} />
            <Area type="monotone" dataKey="base" stroke="hsl(var(--primary))" fill="url(#scenarioBand)" strokeWidth={2} name={`Base (${forecastCagr}%)`} dot={false} />
            <Area type="monotone" dataKey="bear" stroke="hsl(0, 84%, 60%)" fill="none" strokeDasharray="4 4" name={`Bear (${Math.max(forecastCagr - forecastVol, 0)}%)`} dot={false} />
            <Line type="monotone" dataKey="target" stroke="hsl(var(--muted-foreground))" strokeDasharray="8 4" name="Required Path" dot={false} strokeWidth={1} />
            <Line type="monotone" dataKey="actual" stroke="hsl(50, 100%, 50%)" name="Actual" strokeWidth={2.5} dot={false} connectNulls={false} />
            <Line type="monotone" dataKey="projected" stroke="hsl(50, 100%, 50%)" strokeDasharray="6 3" name="Projected (Current CAGR)" dot={false} strokeWidth={1.5} connectNulls={false} />
          </AreaChart>
        </ResponsiveContainer>

        {/* Scenario summary */}
        <div className="grid grid-cols-3 gap-3 text-center text-xs border-t border-border pt-3">
          <div>
            <div className="text-muted-foreground">Bear Case</div>
            <div className="font-mono text-bearish font-semibold">{fmt(endBase?.bear || 0)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Base Case</div>
            <div className="font-mono text-primary font-semibold">{fmt(endBase?.base || 0)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Bull Case</div>
            <div className="font-mono text-bullish font-semibold">{fmt(endBase?.bull || 0)}</div>
          </div>
        </div>
      </section>

      {/* Strategy Contribution */}
      {strategyContribution.length > 0 && (
        <section className="bg-card rounded-lg border border-border p-4 sm:p-5">
          <div className="text-sm font-semibold text-foreground mb-3">Strategy Contribution</div>
          <div className="space-y-2">
            {strategyContribution.map(s => (
              <div key={s.name} className="flex items-center justify-between text-sm">
                <span className="text-foreground">{s.name}</span>
                <div className="flex items-center gap-3">
                  <span className={`font-mono ${s.pnl >= 0 ? 'text-bullish' : 'text-bearish'}`}>
                    {s.pnl >= 0 ? '+' : ''}{fmt(s.pnl)}
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
      <section className="bg-card rounded-lg border border-border p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
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

function MetricCard({ label, value, icon, color, tooltip }: { label: string; value: string; icon: React.ReactNode; color?: string; tooltip?: string }) {
  const card = (
    <div className="bg-card rounded-lg border border-border p-3 sm:p-4">
      <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
        {icon}
        <span className="text-xs">{label}</span>
        {tooltip && <Info className="h-3 w-3 text-muted-foreground/50" />}
      </div>
      <div className={`text-base sm:text-lg font-semibold ${color || 'text-foreground'}`}>{value}</div>
    </div>
  );

  if (!tooltip) return card;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{card}</TooltipTrigger>
        <TooltipContent className="max-w-xs text-xs">
          <p>{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
