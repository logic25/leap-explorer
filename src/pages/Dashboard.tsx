import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { ScannerType } from '@/lib/mock-data';
import { mockAlerts, mockRegime, computeConvexityScore } from '@/lib/mock-data';
import type { ScannerAlert } from '@/lib/mock-data';
import { ScannerBadge } from '@/components/ScannerBadge';
import { ChecklistModal } from '@/components/ChecklistModal';
import { RegimeIndicator } from '@/components/RegimeIndicator';
import { Check, X, ChevronRight, Clock, RefreshCw, Loader2, Settings2, GripVertical, Eye, EyeOff, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';

type ColumnKey = 'ticker' | 'type' | 'price' | 'change' | 'rsi' | 'volRatio' | 'strike' | 'expiry' | 'delta' | 'theta' | 'vega' | 'dte' | 'oi' | 'spread' | 'ivPct' | 'ivHvRatio' | 'askPrice' | 'volOiRatio' | 'chainQuality' | 'convexity' | 'checklist';

interface ColumnDef {
  key: ColumnKey;
  label: string;
  align: 'left' | 'right' | 'center';
  render: (alert: ScannerAlert) => React.ReactNode;
}

const ALL_COLUMNS: ColumnDef[] = [
  { key: 'ticker', label: 'Ticker', align: 'left', render: (a) => (
    <><div className="font-mono font-semibold text-foreground">{a.ticker}</div><div className="text-xs text-muted-foreground">{a.name}</div></>
  )},
  { key: 'type', label: 'Type', align: 'left', render: (a) => <ScannerBadge type={a.scannerType} /> },
  { key: 'price', label: 'Price', align: 'right', render: (a) => <span className="font-mono font-medium text-foreground">${a.price.toFixed(2)}</span> },
  { key: 'change', label: 'Change', align: 'right', render: (a) => (
    <span className={`font-mono font-medium ${a.changePct >= 0 ? 'text-bullish' : 'text-bearish'}`}>{a.changePct >= 0 ? '+' : ''}{a.changePct.toFixed(2)}%</span>
  )},
  { key: 'rsi', label: 'RSI', align: 'right', render: (a) => <span className="font-mono text-foreground">{a.rsi}</span> },
  { key: 'volRatio', label: 'Vol Ratio', align: 'right', render: (a) => <span className="font-mono text-foreground">{a.avgVolume > 0 ? (a.volume / a.avgVolume).toFixed(2) : '—'}x</span> },
  { key: 'strike', label: 'Strike', align: 'right', render: (a) => <span className="font-mono text-foreground">${a.suggestedStrike}</span> },
  { key: 'expiry', label: 'Expiry', align: 'right', render: (a) => <span className="font-mono text-foreground">{a.suggestedExpiry}</span> },
  { key: 'delta', label: 'Δ Delta', align: 'right', render: (a) => <span className="font-mono text-foreground">{a.delta.toFixed(2)}</span> },
  { key: 'theta', label: 'Θ Theta', align: 'right', render: (a) => (
    <span className={`font-mono ${a.theta < -0.05 ? 'text-warning' : 'text-foreground'}`}>{a.theta.toFixed(3)}</span>
  )},
  { key: 'vega', label: 'V Vega', align: 'right', render: (a) => <span className="font-mono text-foreground">{a.vega.toFixed(2)}</span> },
  { key: 'dte', label: 'DTE', align: 'right', render: (a) => (
    <span className={`font-mono ${a.dte < 90 ? 'text-bearish font-semibold' : 'text-foreground'}`}>
      {a.dte}{a.dte < 90 ? ' ⚠' : ''}
    </span>
  )},
  { key: 'oi', label: 'OI', align: 'right', render: (a) => (
    <span className={`font-mono ${a.openInterest < 1000 ? 'text-bearish' : 'text-foreground'}`}>
      {a.openInterest.toLocaleString()}{a.openInterest < 1000 ? ' ⚠' : ''}
    </span>
  )},
  { key: 'spread', label: 'Spread', align: 'right', render: (a) => (
    <span className={`font-mono ${a.bidAskSpread > 5 ? 'text-bearish font-semibold' : a.bidAskSpread > 2 ? 'text-warning' : 'text-foreground'}`}>
      {a.bidAskSpread.toFixed(1)}%{a.bidAskSpread > 5 ? ' ⚠' : ''}
    </span>
  )},
  { key: 'ivPct', label: 'IV %ile', align: 'right', render: (a) => <span className="font-mono text-foreground">{a.ivPercentile}</span> },
  { key: 'ivHvRatio', label: 'IV/HV', align: 'right', render: (a) => (
    <span className={`font-mono ${(a.ivHvRatio || 0) > 1.3 ? 'text-warning' : 'text-foreground'}`}>
      {a.ivHvRatio != null ? a.ivHvRatio.toFixed(2) : '—'}{(a.ivHvRatio || 0) > 1.3 ? ' ⚠' : ''}
    </span>
  )},
  { key: 'askPrice', label: 'Ask', align: 'right', render: (a) => <span className="font-mono text-foreground">${a.askPrice.toFixed(2)}</span> },
  { key: 'volOiRatio', label: 'Vol/OI', align: 'right', render: (a) => (
    <span className={`font-mono ${a.unusualActivity ? 'text-warning font-semibold' : 'text-foreground'}`}>
      {a.volumeOiRatio != null ? a.volumeOiRatio.toFixed(2) : '—'}{a.unusualActivity ? ' 🔥' : ''}
    </span>
  )},
  { key: 'chainQuality', label: 'Quality', align: 'center', render: (a) => {
    const score = a.chainQualityScore || 0;
    const color = score >= 80 ? 'text-bullish' : score >= 50 ? 'text-warning' : 'text-bearish';
    return <span className={`font-mono font-semibold ${color}`}>{score}</span>;
  }},
  { key: 'convexity', label: 'Convex', align: 'center', render: (a) => {
    const score = a.convexityScore ?? 0;
    const color = score >= 70 ? 'text-bullish' : score >= 40 ? 'text-warning' : 'text-bearish';
    return <span className={`font-mono font-semibold ${color}`}>{score}</span>;
  }},
  { key: 'checklist', label: 'Checklist', align: 'center', render: () => null },
];

const DEFAULT_VISIBLE: ColumnKey[] = ['ticker', 'type', 'price', 'change', 'oi', 'spread', 'ivPct', 'ivHvRatio', 'delta', 'chainQuality', 'convexity', 'checklist'];
const LEAP_VIEW_COLUMNS: ColumnKey[] = ['ticker', 'price', 'rsi', 'delta', 'dte', 'ivPct', 'askPrice', 'oi', 'spread', 'chainQuality', 'convexity', 'checklist'];
const STORAGE_KEY = 'scanner-columns';
const LEAP_VIEW_KEY = 'scanner-leap-view';

// LEAP filter thresholds — "cheap durable convexity".
const LEAP_FILTER = {
  minDelta: 0.65,   // real ITM exposure
  minDte: 365,      // at least a year of runway
  maxIvPct: 30,     // cheap vs own IV history
};

function loadColumnPrefs(): ColumnKey[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return DEFAULT_VISIBLE;
}

export default function Dashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selected, setSelected] = useState<ScannerAlert | null>(null);
  const [alerts, setAlerts] = useState<ScannerAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [lastScan, setLastScan] = useState<string | null>(null);
  const [visibleCols, setVisibleCols] = useState<ColumnKey[]>(loadColumnPrefs);
  const [leapView, setLeapView] = useState<boolean>(() => {
    try { return localStorage.getItem(LEAP_VIEW_KEY) === '1'; } catch { return false; }
  });

  const toggleLeapView = () => {
    setLeapView(prev => {
      const next = !prev;
      try { localStorage.setItem(LEAP_VIEW_KEY, next ? '1' : '0'); } catch {}
      if (next) {
        setVisibleCols(LEAP_VIEW_COLUMNS);
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(LEAP_VIEW_COLUMNS)); } catch {}
      }
      return next;
    });
  };

  const toggleColumn = (key: ColumnKey) => {
    setVisibleCols(prev => {
      const next = prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const moveColumn = (key: ColumnKey, dir: -1 | 1) => {
    setVisibleCols(prev => {
      const idx = prev.indexOf(key);
      if (idx < 0) return prev;
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const activeColumns = visibleCols
    .map(key => ALL_COLUMNS.find(c => c.key === key))
    .filter(Boolean) as ColumnDef[];

  useEffect(() => {
    fetchAlerts();
  }, [user]);

  const fetchAlerts = async () => {
    if (!user) return;
    setLoading(true);

    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('scanner_alerts')
      .select('*')
      .eq('user_id', user.id)
      .eq('scan_date', today)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch alerts:', error);
      setAlerts([]);
    } else if (data && data.length > 0) {
      const mapped: ScannerAlert[] = data.map((row) => ({
        id: row.id,
        ticker: row.ticker,
        name: row.name || row.ticker,
        scannerType: row.scanner_type as ScannerType,
        price: Number(row.price) || 0,
        change: 0,
        changePct: Number(row.change_pct) || 0,
        ma50: 0,
        ma200: 0,
        rsi: Number(row.rsi) || 0,
        volume: Number(row.volume) || 0,
        avgVolume: Number(row.avg_volume) || 1,
        suggestedStrike: Number(row.suggested_strike) || 0,
        suggestedExpiry: row.suggested_expiry || '',
        delta: Number(row.delta) || 0,
        theta: Number((row as any).theta) || 0,
        vega: Number((row as any).vega) || 0,
        dte: row.dte || 0,
        openInterest: row.open_interest || 0,
        bidAskSpread: Number(row.bid_ask_spread) || 0,
        ivPercentile: Number(row.iv_percentile) || 0,
        ivRank: Number(row.iv_rank) || undefined,
        ivHvRatio: Number(row.iv_hv_ratio) || undefined,
        askPrice: Number(row.ask_price) || 0,
        historicalLow: Number(row.historical_low) || 0,
        volumeOiRatio: Number((row as any).volume_oi_ratio) || undefined,
        unusualActivity: (row as any).unusual_activity || false,
        slippageEst: Number((row as any).slippage_est) || undefined,
        chainQualityScore: Number((row as any).chain_quality_score) || undefined,
        convexityScore: computeConvexityScore({
          delta: Number(row.delta) || 0,
          dte: row.dte || 0,
          ivPercentile: Number(row.iv_percentile) || 0,
          chainQualityScore: Number((row as any).chain_quality_score) || undefined,
        }),
        checklist: Array.isArray(row.checklist)
          ? (row.checklist as any[]).map((c: any) => ({ label: c.label, passed: c.passed, category: c.category }))
          : [],
        timestamp: row.created_at,
      }));
      setAlerts(mapped);
      setLastScan(data[0].created_at);
    } else {
      setAlerts([]);
    }
    setLoading(false);
  };

  const runScanNow = async () => {
    if (!user) return;
    setScanning(true);
    try {
      const { data, error } = await supabase.functions.invoke('scan-watchlist', {
        body: { user_id: user.id },
      });
      if (error) throw error;
      toast({
        title: 'Scan complete',
        description: `${data.alerts_created} alert(s) found.`,
      });
      await fetchAlerts();
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Scan failed',
        description: err.message || 'Unknown error',
      });
    }
    setScanning(false);
  };

  const baseAlerts = alerts.length > 0 ? alerts : (loading ? [] : mockAlerts);
  const usingMock = alerts.length === 0 && !loading;

  const displayAlerts = leapView
    ? [...baseAlerts]
        .filter(a =>
          a.delta >= LEAP_FILTER.minDelta &&
          a.dte >= LEAP_FILTER.minDte &&
          a.ivPercentile <= LEAP_FILTER.maxIvPct
        )
        .sort((a, b) => (b.convexityScore ?? 0) - (a.convexityScore ?? 0))
    : baseAlerts;

  const passedCount = (alert: ScannerAlert) => alert.checklist.filter(c => c.passed).length;
  const totalCount = (alert: ScannerAlert) => alert.checklist.length;

  const formatScanTime = () => {
    if (lastScan) {
      const d = new Date(lastScan);
      return d.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/New_York' }) + ' EST';
    }
    return 'No scans today';
  };

  return (
    <div className="space-y-6 animate-slide-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Daily Scanner</h1>
          <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
            <Clock className="h-3.5 w-3.5" />
            Last scan: {formatScanTime()}
            {usingMock && <span className="text-xs text-warning ml-2">(showing mock data)</span>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant={leapView ? 'default' : 'outline'}
            size="sm"
            onClick={toggleLeapView}
            className="gap-2"
            title={`LEAP View: delta ≥ ${LEAP_FILTER.minDelta}, DTE ≥ ${LEAP_FILTER.minDte}, IV %ile ≤ ${LEAP_FILTER.maxIvPct}, sorted by convexity`}
          >
            <Zap className="h-4 w-4" />
            LEAP View{leapView ? ' ·  ON' : ''}
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Settings2 className="h-4 w-4" />
                Columns
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-0" align="end">
              <div className="p-3 border-b border-border">
                <div className="text-sm font-semibold text-foreground">Visible Columns</div>
                <div className="text-xs text-muted-foreground mt-0.5">Toggle & reorder columns</div>
              </div>
              <div className="p-2 max-h-72 overflow-y-auto space-y-0.5">
                {ALL_COLUMNS.map(col => {
                  const isVisible = visibleCols.includes(col.key);
                  const idx = visibleCols.indexOf(col.key);
                  return (
                    <div key={col.key} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent/50 text-sm">
                      <button onClick={() => toggleColumn(col.key)} className="shrink-0">
                        {isVisible ? <Eye className="h-3.5 w-3.5 text-primary" /> : <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />}
                      </button>
                      <span className={`flex-1 ${isVisible ? 'text-foreground' : 'text-muted-foreground'}`}>{col.label}</span>
                      {isVisible && (
                        <div className="flex gap-0.5">
                          <button onClick={() => moveColumn(col.key, -1)} disabled={idx === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-30 text-xs px-1">↑</button>
                          <button onClick={() => moveColumn(col.key, 1)} disabled={idx === visibleCols.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-30 text-xs px-1">↓</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
          <Button
            variant="outline"
            size="sm"
            onClick={runScanNow}
            disabled={scanning}
            className="gap-2"
          >
            {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {scanning ? 'Scanning...' : 'Run Scan Now'}
          </Button>
          <div className="sm:hidden">
            <RegimeIndicator regime={mockRegime} />
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total Alerts" value={displayAlerts.length.toString()} />
        <StatCard label="Value Zone" value={displayAlerts.filter(a => a.scannerType === 'Value Zone').length.toString()} accent="primary" />
        <StatCard label="MegaRun" value={displayAlerts.filter(a => a.scannerType === 'MegaRun').length.toString()} accent="bullish" />
        <StatCard label="Fallen Angel" value={displayAlerts.filter(a => a.scannerType === 'Fallen Angel').length.toString()} accent="warning" />
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}

      {/* Table */}
      {!loading && (
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2">
                  {activeColumns.map(col => (
                    <th key={col.key} className={`text-${col.align} px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap`}>
                      {col.label}
                    </th>
                  ))}
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {displayAlerts.length === 0 ? (
                  <tr>
                    <td colSpan={activeColumns.length + 1} className="px-4 py-8 text-center text-muted-foreground">
                      {leapView && baseAlerts.length > 0
                        ? `No alerts pass LEAP View filters (delta ≥ ${LEAP_FILTER.minDelta}, DTE ≥ ${LEAP_FILTER.minDte}, IV %ile ≤ ${LEAP_FILTER.maxIvPct}). Turn off LEAP View to see all ${baseAlerts.length}.`
                        : 'No alerts today. Click "Run Scan Now" to scan your watchlist.'}
                    </td>
                  </tr>
                ) : (
                  displayAlerts.map((alert) => (
                    <tr
                      key={alert.id}
                      className="border-b border-border/50 hover:bg-accent/50 cursor-pointer transition-colors"
                      onClick={() => setSelected(alert)}
                    >
                      {activeColumns.map(col => (
                        <td key={col.key} className={`px-4 py-3 text-${col.align}`}>
                          {col.key === 'checklist' ? (
                            <span className="inline-flex items-center gap-1 text-xs">
                              {passedCount(alert) === totalCount(alert) ? (
                                <Check className="h-4 w-4 text-bullish" />
                              ) : (
                                <span className="text-muted-foreground">
                                  {passedCount(alert)}/{totalCount(alert)}
                                </span>
                              )}
                            </span>
                          ) : col.render(alert)}
                        </td>
                      ))}
                      <td className="px-4 py-3">
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ChecklistModal alert={selected} open={!!selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: string }) {
  const borderClass = accent === 'primary' ? 'border-l-primary' :
    accent === 'bullish' ? 'border-l-bullish' :
    accent === 'warning' ? 'border-l-warning' : 'border-l-border';

  return (
    <div className={`bg-card rounded-lg border border-border border-l-2 ${borderClass} px-4 py-3`}>
      <div className="text-[11px] text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className="text-2xl font-semibold font-mono text-foreground mt-0.5">{value}</div>
    </div>
  );
}
