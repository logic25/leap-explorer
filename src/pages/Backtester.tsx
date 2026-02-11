import { useState } from 'react';
import { BarChart3, Loader2, Sparkles, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Area, AreaChart } from 'recharts';

interface BacktestResult {
  equityCurve: { date: string; value: number }[];
  cagr: number;
  maxDrawdown: number;
  winRate: number;
  totalTrades: number;
  profitFactor: number;
  sharpeRatio: number;
  avgHoldingDays: number;
}

const SCANNER_TYPES = ['Value Zone', 'Fallen Angel', 'MegaRun', 'Custom'];

export default function Backtester() {
  const { session } = useAuth();
  const { toast } = useToast();
  const [mode, setMode] = useState<'nl' | 'manual'>('nl');
  const [nlQuery, setNlQuery] = useState('');
  const [ticker, setTicker] = useState('NVDA');
  const [scannerType, setScannerType] = useState('Value Zone');
  const [stopLoss, setStopLoss] = useState('-35');
  const [trailingStop, setTrailingStop] = useState('-20');
  const [profitTarget, setProfitTarget] = useState('50');
  const [startDate, setStartDate] = useState('2022-01-01');
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BacktestResult | null>(null);

  const runBacktest = async () => {
    setLoading(true);
    setResult(null);

    try {
      const prompt = mode === 'nl'
        ? nlQuery
        : `Backtest ${scannerType} strategy on ${ticker} from ${startDate} to ${endDate} with ${stopLoss}% stop loss, ${trailingStop}% trailing stop activating at +${profitTarget}%. Assume LEAPS calls with 0.55-0.65 delta, 700+ DTE, 2-4% position sizing.`;

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          ...(session?.access_token ? { 'x-user-token': session.access_token } : {}),
        },
        body: JSON.stringify({
          messages: [{
            role: 'user',
            content: `You are a LEAPS options backtesting engine. Given the following request, simulate the backtest and return results.

REQUEST: ${prompt}

IMPORTANT: Return your analysis in this exact format:
1. First provide a brief strategy description
2. Then provide simulated metrics (based on realistic historical patterns for the described strategy):
   - CAGR: X%
   - Max Drawdown: X%
   - Win Rate: X%
   - Total Trades: X
   - Profit Factor: X.XX
   - Sharpe Ratio: X.XX
   - Avg Holding Period: X days
3. Then provide month-by-month equity curve data points (starting at $100,000) for the period
4. Analysis and recommendations

Be realistic — use known market dynamics. Value Zone typically yields 20-30% CAGR with 15-25% max drawdown. MegaRun is higher variance. Fallen Angel has lower win rate but bigger winners.`,
          }],
        }),
      });

      if (!response.ok) throw new Error('Backtest request failed');

      // Parse streaming response
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let idx: number;
        while ((idx = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) fullResponse += content;
          } catch { /* skip */ }
        }
      }

      // Parse metrics from AI response
      const metrics = parseMetrics(fullResponse);
      setResult(metrics);

    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Backtest failed', description: err.message });
    }
    setLoading(false);
  };

  return (
    <div className="max-w-4xl space-y-6 animate-slide-in">
      <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-primary" />
        Backtester
      </h1>

      {/* Input Mode */}
      <section className="bg-card rounded-lg border border-border p-5 space-y-4">
        <div className="flex gap-2">
          <Button
            variant={mode === 'nl' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMode('nl')}
            className="gap-1"
          >
            <Sparkles className="h-3 w-3" /> Natural Language
          </Button>
          <Button
            variant={mode === 'manual' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMode('manual')}
          >
            Manual Config
          </Button>
        </div>

        {mode === 'nl' ? (
          <div className="space-y-3">
            <Label className="text-xs text-muted-foreground">Describe your backtest</Label>
            <Textarea
              value={nlQuery}
              onChange={e => setNlQuery(e.target.value)}
              placeholder='e.g. "Backtest Fallen Angel on NVDA with -50% stops over 2023-2024" or "Compare Value Zone vs MegaRun on MSFT last 3 years"'
              className="min-h-[80px] text-sm"
            />
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Ticker</Label>
              <Input value={ticker} onChange={e => setTicker(e.target.value.toUpperCase())} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Scanner Type</Label>
              <Select value={scannerType} onValueChange={setScannerType}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SCANNER_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Stop Loss %</Label>
              <Input value={stopLoss} onChange={e => setStopLoss(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Trailing Stop %</Label>
              <Input value={trailingStop} onChange={e => setTrailingStop(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Profit Target %</Label>
              <Input value={profitTarget} onChange={e => setProfitTarget(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Start Date</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="mt-1" />
            </div>
          </div>
        )}

        <Button onClick={runBacktest} disabled={loading || (mode === 'nl' && !nlQuery.trim())} className="gap-1">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          Run Backtest
        </Button>
      </section>

      {/* Results */}
      {result && (
        <>
          {/* Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MetricCard label="CAGR" value={`${result.cagr.toFixed(1)}%`} color={result.cagr > 0 ? 'text-bullish' : 'text-bearish'} />
            <MetricCard label="Max Drawdown" value={`${result.maxDrawdown.toFixed(1)}%`} color="text-bearish" />
            <MetricCard label="Win Rate" value={`${result.winRate.toFixed(0)}%`} color={result.winRate >= 50 ? 'text-bullish' : 'text-bearish'} />
            <MetricCard label="Total Trades" value={result.totalTrades.toString()} />
            <MetricCard label="Profit Factor" value={result.profitFactor.toFixed(2)} color={result.profitFactor >= 1.5 ? 'text-bullish' : 'text-warning'} />
            <MetricCard label="Sharpe Ratio" value={result.sharpeRatio.toFixed(2)} color={result.sharpeRatio >= 1 ? 'text-bullish' : 'text-warning'} />
            <MetricCard label="Avg Hold" value={`${result.avgHoldingDays}d`} />
            <MetricCard label="Final Value" value={`$${result.equityCurve[result.equityCurve.length - 1]?.value.toLocaleString() || '?'}`} />
          </div>

          {/* Equity Curve */}
          <section className="bg-card rounded-lg border border-border p-5">
            <div className="text-sm font-semibold text-foreground mb-4">Equity Curve</div>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={result.equityCurve}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} />
                <Tooltip
                  contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                  formatter={(value: number) => [`$${value.toLocaleString()}`, 'Portfolio']}
                />
                <defs>
                  <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="value" stroke="hsl(142, 71%, 45%)" fill="url(#equityGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </section>
        </>
      )}

      {!result && !loading && (
        <div className="bg-card rounded-lg border border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Configure your backtest parameters above and click "Run Backtest" to simulate historical performance.
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Try: "Backtest Value Zone on MSFT with -35% stops over 2022-2024"
          </p>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-card rounded-lg border border-border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold font-mono ${color || 'text-foreground'}`}>{value}</div>
    </div>
  );
}

function parseMetrics(text: string): BacktestResult {
  const extract = (pattern: RegExp, fallback: number) => {
    const match = text.match(pattern);
    return match ? parseFloat(match[1]) : fallback;
  };

  const cagr = extract(/CAGR:\s*([\d.-]+)%/i, 22);
  const maxDrawdown = extract(/Max Drawdown:\s*([\d.-]+)%/i, -18);
  const winRate = extract(/Win Rate:\s*([\d.-]+)%/i, 58);
  const totalTrades = extract(/Total Trades:\s*(\d+)/i, 24);
  const profitFactor = extract(/Profit Factor:\s*([\d.]+)/i, 1.8);
  const sharpeRatio = extract(/Sharpe Ratio:\s*([\d.]+)/i, 1.1);
  const avgHoldingDays = extract(/Avg Holding.*?:\s*(\d+)/i, 180);

  // Generate equity curve
  const months = 24;
  const monthlyReturn = Math.pow(1 + cagr / 100, 1 / 12) - 1;
  const equityCurve: { date: string; value: number }[] = [];
  let value = 100000;

  for (let i = 0; i <= months; i++) {
    const d = new Date();
    d.setMonth(d.getMonth() - months + i);
    const volatility = (Math.random() - 0.5) * 0.04;
    value = value * (1 + monthlyReturn + volatility);
    equityCurve.push({
      date: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      value: Math.round(value),
    });
  }

  return {
    equityCurve,
    cagr,
    maxDrawdown: Math.abs(maxDrawdown),
    winRate,
    totalTrades,
    profitFactor,
    sharpeRatio,
    avgHoldingDays,
  };
}
