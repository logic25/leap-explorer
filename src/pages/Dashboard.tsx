import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { ScannerType } from '@/lib/mock-data';
import { mockAlerts, mockRegime } from '@/lib/mock-data';
import type { ScannerAlert } from '@/lib/mock-data';
import { ScannerBadge } from '@/components/ScannerBadge';
import { ChecklistModal } from '@/components/ChecklistModal';
import { RegimeIndicator } from '@/components/RegimeIndicator';
import { Check, X, ChevronRight, Clock, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

export default function Dashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selected, setSelected] = useState<ScannerAlert | null>(null);
  const [alerts, setAlerts] = useState<ScannerAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [lastScan, setLastScan] = useState<string | null>(null);

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
        dte: row.dte || 0,
        openInterest: row.open_interest || 0,
        bidAskSpread: Number(row.bid_ask_spread) || 0,
        ivPercentile: Number(row.iv_percentile) || 0,
        askPrice: Number(row.ask_price) || 0,
        historicalLow: Number(row.historical_low) || 0,
        checklist: Array.isArray(row.checklist)
          ? (row.checklist as any[]).map((c: any) => ({ label: c.label, passed: c.passed }))
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

  const displayAlerts = alerts.length > 0 ? alerts : (loading ? [] : mockAlerts);
  const usingMock = alerts.length === 0 && !loading;

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
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ticker</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Type</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Price</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Change</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">RSI</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Vol Ratio</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Checklist</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {displayAlerts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                      No alerts today. Click "Run Scan Now" to scan your watchlist.
                    </td>
                  </tr>
                ) : (
                  displayAlerts.map((alert) => (
                    <tr
                      key={alert.id}
                      className="border-b border-border/50 hover:bg-accent/50 cursor-pointer transition-colors"
                      onClick={() => setSelected(alert)}
                    >
                      <td className="px-4 py-3">
                        <div className="font-mono font-semibold text-foreground">{alert.ticker}</div>
                        <div className="text-xs text-muted-foreground">{alert.name}</div>
                      </td>
                      <td className="px-4 py-3">
                        <ScannerBadge type={alert.scannerType} />
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-medium text-foreground">
                        ${alert.price.toFixed(2)}
                      </td>
                      <td className={`px-4 py-3 text-right font-mono font-medium ${alert.changePct >= 0 ? 'text-bullish' : 'text-bearish'}`}>
                        {alert.changePct >= 0 ? '+' : ''}{alert.changePct.toFixed(2)}%
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-foreground hidden md:table-cell">
                        {alert.rsi}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-foreground hidden lg:table-cell">
                        {alert.avgVolume > 0 ? (alert.volume / alert.avgVolume).toFixed(2) : '—'}x
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center gap-1 text-xs">
                          {passedCount(alert) === totalCount(alert) ? (
                            <Check className="h-4 w-4 text-bullish" />
                          ) : (
                            <span className="text-muted-foreground">
                              {passedCount(alert)}/{totalCount(alert)}
                            </span>
                          )}
                        </span>
                      </td>
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
