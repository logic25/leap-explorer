import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Eye, EyeOff, Save, Key, Server, Loader2, BarChart3 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import WatchlistEditor from '@/components/settings/WatchlistEditor';
import TelegramSection from '@/components/settings/TelegramSection';

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [polygonKey, setPolygonKey] = useState('');
  const [alpacaKey, setAlpacaKey] = useState('');
  const [alpacaSecret, setAlpacaSecret] = useState('');
  const [liveMode, setLiveMode] = useState(false);
  const [showKeys, setShowKeys] = useState(false);
  const [telegramChatId, setTelegramChatId] = useState('');
  const [telegramLinked, setTelegramLinked] = useState(false);
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [savingSettings, setSavingSettings] = useState(false);
  const [accountSize, setAccountSize] = useState(100000);
  const [positionSizePct, setPositionSizePct] = useState(3);
  const [maxAllocPct, setMaxAllocPct] = useState(80);

  useEffect(() => {
    if (user) {
      supabase
        .from('profiles')
        .select('telegram_chat_id, trading_mode, stock_watchlist, account_size, position_size_pct, max_allocation_pct')
        .eq('id', user.id)
        .single()
        .then(({ data }: any) => {
          if (data?.telegram_chat_id) {
            setTelegramChatId(data.telegram_chat_id);
            setTelegramLinked(true);
          }
          if (data?.trading_mode === 'live') {
            setLiveMode(true);
          }
          if (data?.stock_watchlist) {
            setWatchlist(data.stock_watchlist as string[]);
          }
          if (data?.account_size != null) setAccountSize(Number(data.account_size));
          if (data?.position_size_pct != null) setPositionSizePct(Number(data.position_size_pct));
          if (data?.max_allocation_pct != null) setMaxAllocPct(Number(data.max_allocation_pct));
        });
    }
  }, [user]);

  const saveSettings = async () => {
    if (!user) return;
    setSavingSettings(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          stock_watchlist: watchlist as any,
          trading_mode: liveMode ? 'live' : 'paper',
          account_size: accountSize,
          position_size_pct: positionSizePct,
          max_allocation_pct: maxAllocPct,
        } as any)
        .eq('id', user.id);
      if (error) throw error;
      toast({ title: 'Settings saved!' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Save failed', description: err.message });
    }
    setSavingSettings(false);
  };

  return (
    <div className="max-w-2xl space-y-8 animate-slide-in">
      <h1 className="text-xl font-semibold text-foreground">Settings</h1>

      {/* Telegram */}
      {user && (
        <TelegramSection
          userId={user.id}
          telegramChatId={telegramChatId}
          setTelegramChatId={setTelegramChatId}
          telegramLinked={telegramLinked}
          setTelegramLinked={setTelegramLinked}
        />
      )}

      {/* API Keys */}
      <section className="bg-card rounded-lg border border-border p-5 space-y-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Key className="h-4 w-4 text-primary" />
          API Connections
        </div>
        <div className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground">Polygon.io API Key</Label>
            <div className="relative mt-1">
              <Input
                type={showKeys ? 'text' : 'password'}
                value={polygonKey}
                onChange={e => setPolygonKey(e.target.value)}
                placeholder="Enter Polygon.io API key"
                className="bg-surface-2 border-border pr-10"
              />
              <button
                onClick={() => setShowKeys(!showKeys)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showKeys ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Alpaca API Key</Label>
            <Input
              type={showKeys ? 'text' : 'password'}
              value={alpacaKey}
              onChange={e => setAlpacaKey(e.target.value)}
              placeholder="Enter Alpaca API key"
              className="bg-surface-2 border-border mt-1"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Alpaca Secret Key</Label>
            <Input
              type={showKeys ? 'text' : 'password'}
              value={alpacaSecret}
              onChange={e => setAlpacaSecret(e.target.value)}
              placeholder="Enter Alpaca secret key"
              className="bg-surface-2 border-border mt-1"
            />
          </div>
        </div>
      </section>

      {/* Trading Mode */}
      <section className="bg-card rounded-lg border border-border p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Server className="h-4 w-4 text-primary" />
          Trading Mode
        </div>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-foreground">{liveMode ? 'Live Trading' : 'Paper Trading'}</div>
            <div className="text-xs text-muted-foreground">
              {liveMode ? '⚠️ Real money at risk' : 'Simulated trades only'}
            </div>
          </div>
          <Switch checked={liveMode} onCheckedChange={setLiveMode} />
        </div>
        {liveMode && (
          <div className="text-xs text-bearish bg-bearish/10 border border-bearish/20 rounded-md px-3 py-2">
            Live mode enabled. All approved trades will execute with real funds via Alpaca.
          </div>
        )}
      </section>

      {/* Account & Position Sizing */}
      <section className="bg-card rounded-lg border border-border p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <BarChart3 className="h-4 w-4 text-primary" />
          Account & Position Sizing
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <Label className="text-xs text-muted-foreground">Account Size ($)</Label>
            <Input
              type="number"
              value={accountSize}
              onChange={e => setAccountSize(Number(e.target.value))}
              className="bg-surface-2 border-border mt-1 font-mono"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Position Size (%)</Label>
            <Input
              type="number"
              value={positionSizePct}
              onChange={e => setPositionSizePct(Number(e.target.value))}
              min={1}
              max={10}
              step={0.5}
              className="bg-surface-2 border-border mt-1 font-mono"
            />
            <p className="text-[10px] text-muted-foreground mt-0.5">Rule: 2-4% per position</p>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Max Allocation (%)</Label>
            <Input
              type="number"
              value={maxAllocPct}
              onChange={e => setMaxAllocPct(Number(e.target.value))}
              min={10}
              max={100}
              step={5}
              className="bg-surface-2 border-border mt-1 font-mono"
            />
            <p className="text-[10px] text-muted-foreground mt-0.5">Total portfolio cap</p>
          </div>
        </div>
        <div className="text-xs text-muted-foreground bg-surface-2 rounded-md px-3 py-2">
          📦 At {positionSizePct}% sizing on ${accountSize.toLocaleString()}, each position max = ${Math.round(accountSize * positionSizePct / 100).toLocaleString()}
        </div>
      </section>

      {/* Default Watchlist */}
      <div className="space-y-1">
        <WatchlistEditor watchlist={watchlist} onChange={setWatchlist} />
        <p className="text-xs text-muted-foreground px-1">
          Default fallback — per-strategy tickers override this list when set.
        </p>
      </div>

      {/* Playbooks are now in the right sidebar panel */}

      <Button className="gap-2" onClick={saveSettings} disabled={savingSettings}>
        {savingSettings ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Save Settings
      </Button>
    </div>
  );
}
