import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Eye, EyeOff, Save, Key, Server, List, Send, CheckCircle, Loader2 } from 'lucide-react';
import { STOCK_LIST } from '@/lib/mock-data';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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
  const [linkingTelegram, setLinkingTelegram] = useState(false);

  useEffect(() => {
    if (user) {
      supabase
        .from('profiles')
        .select('telegram_chat_id, trading_mode')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          if (data?.telegram_chat_id) {
            setTelegramChatId(data.telegram_chat_id);
            setTelegramLinked(true);
          }
          if (data?.trading_mode === 'live') {
            setLiveMode(true);
          }
        });
    }
  }, [user]);

  const linkTelegram = async () => {
    if (!user || !telegramChatId.trim()) return;
    setLinkingTelegram(true);
    try {
      const { error } = await supabase.functions.invoke('telegram', {
        body: { action: 'link', user_id: user.id, chat_id: telegramChatId.trim() },
      });
      if (error) throw error;
      setTelegramLinked(true);
      toast({ title: 'Telegram linked!', description: 'Check your Telegram for a confirmation message.' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Failed to link', description: err.message });
    }
    setLinkingTelegram(false);
  };

  return (
    <div className="max-w-2xl space-y-8 animate-slide-in">
      <h1 className="text-xl font-semibold text-foreground">Settings</h1>

      {/* Telegram */}
      <section className="bg-card rounded-lg border border-border p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Send className="h-4 w-4 text-primary" />
          Telegram Alerts
        </div>
        <p className="text-xs text-muted-foreground">
          Link your Telegram to receive daily scan alerts and approve trades via reply.
        </p>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">
            Telegram Chat ID
          </Label>
          <p className="text-xs text-muted-foreground">
            Message <a href="https://t.me/userinfobot" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">@userinfobot</a> on Telegram to get your Chat ID.
          </p>
          <div className="flex gap-2">
            <Input
              value={telegramChatId}
              onChange={e => setTelegramChatId(e.target.value)}
              placeholder="e.g. 123456789"
              className="bg-surface-2 border-border"
              disabled={telegramLinked}
            />
            {telegramLinked ? (
              <Button variant="outline" disabled className="gap-2 shrink-0">
                <CheckCircle className="h-4 w-4 text-bullish" />
                Linked
              </Button>
            ) : (
              <Button onClick={linkTelegram} disabled={linkingTelegram || !telegramChatId.trim()} className="gap-2 shrink-0">
                {linkingTelegram ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Link
              </Button>
            )}
          </div>
          {telegramLinked && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground"
              onClick={() => {
                setTelegramLinked(false);
                setTelegramChatId('');
              }}
            >
              Unlink & change
            </Button>
          )}
        </div>
      </section>

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

      {/* Stock List */}
      <section className="bg-card rounded-lg border border-border p-5 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <List className="h-4 w-4 text-primary" />
          Watchlist ({STOCK_LIST.length} stocks)
        </div>
        <div className="flex flex-wrap gap-1.5">
          {STOCK_LIST.map(ticker => (
            <span key={ticker} className="bg-surface-2 border border-border text-xs font-mono px-2 py-1 rounded text-foreground">
              {ticker}
            </span>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Full 75-stock list can be uploaded via CSV. Configuration coming soon.
        </p>
      </section>

      <Button className="gap-2">
        <Save className="h-4 w-4" />
        Save Settings
      </Button>
    </div>
  );
}
