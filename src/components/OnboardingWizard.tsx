import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Activity, Key, ListChecks, BookOpen, MessageCircle, ChevronRight, ChevronLeft, Sparkles, Check, Loader2, Plus, Eye, EyeOff, SkipForward } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

const STEPS = [
  { label: 'API Keys', icon: Key },
  { label: 'Watchlist', icon: ListChecks },
  { label: 'Playbook', icon: BookOpen },
  { label: 'Telegram', icon: MessageCircle },
];

const PRESET_PLAYBOOKS = [
  {
    name: 'Value Zone',
    scanner_type: 'Value Zone',
    description: 'Stock near 50-day MA with RSI below 45 and volume at least 1.2x average. Looks for pullbacks in uptrending stocks.',
    conditions: { rsi_min: 20, rsi_max: 45, volume_ratio_min: 1.2, price_vs_sma50: 'near', price_vs_sma200: 'above' },
  },
  {
    name: 'Fallen Angel',
    scanner_type: 'Fallen Angel',
    description: 'Quality stocks that have pulled back significantly from highs. Drawdown >20% from 50 SMA with signs of consolidation.',
    conditions: { drawdown_from_sma50_min: 20, rsi_min: 25, rsi_max: 40 },
  },
  {
    name: 'MegaRun',
    scanner_type: 'MegaRun',
    description: 'Stocks breaking out of compression near 52-week highs. Low volatility squeeze about to expand.',
    conditions: { rsi_min: 50, rsi_max: 70, volume_ratio_min: 1.5 },
  },
];

const DEFAULT_WATCHLIST = ['MSFT', 'GOOG', 'AMZN', 'NVDA', 'META', 'AVGO', 'CRWD', 'IREN', 'MARA', 'AMD'];

export default function OnboardingWizard({ onComplete }: { onComplete: () => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Step 1: API Keys
  const [polygonKey, setPolygonKey] = useState('');
  const [alpacaKey, setAlpacaKey] = useState('');
  const [alpacaSecret, setAlpacaSecret] = useState('');
  const [showKeys, setShowKeys] = useState(false);

  // Step 2: Watchlist
  const [watchlist, setWatchlist] = useState<string[]>([...DEFAULT_WATCHLIST]);
  const [tickerInput, setTickerInput] = useState('');

  // Step 3: Playbook
  const [selectedPlaybook, setSelectedPlaybook] = useState<number | null>(null);

  // Step 4: Telegram
  const [telegramChatId, setTelegramChatId] = useState('');

  const progress = ((step + 1) / STEPS.length) * 100;

  const addTickers = () => {
    const newTickers = tickerInput.toUpperCase().split(/[\s,]+/).filter(t => t && !watchlist.includes(t));
    if (newTickers.length > 0) setWatchlist(prev => [...prev, ...newTickers]);
    setTickerInput('');
  };

  const finishOnboarding = async () => {
    if (!user) return;
    setSaving(true);
    try {
      // Save watchlist + telegram to profile
      const profileUpdate: Record<string, any> = {
        stock_watchlist: watchlist,
      };
      if (telegramChatId.trim()) {
        profileUpdate.telegram_chat_id = telegramChatId.trim();
      }
      await supabase.from('profiles').update(profileUpdate as any).eq('id', user.id);

      // Create selected playbook
      if (selectedPlaybook !== null) {
        const preset = PRESET_PLAYBOOKS[selectedPlaybook];
        await supabase.from('strategies').insert({
          user_id: user.id,
          name: preset.name,
          scanner_type: preset.scanner_type,
          description: preset.description,
          conditions: preset.conditions,
          enabled: true,
          tickers: [],
        } as any);
      }

      toast({ title: 'Setup complete!', description: 'Your dashboard is ready.' });
      onComplete();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Setup failed', description: err.message });
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <Activity className="h-7 w-7 text-primary" />
            <h1 className="text-xl font-semibold text-foreground tracking-tight">Welcome to LEAPS Trader</h1>
          </div>
          <p className="text-sm text-muted-foreground">Let's get you set up in a few quick steps.</p>
        </div>

        {/* Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            {STEPS.map((s, i) => (
              <span key={i} className={`flex items-center gap-1 ${i <= step ? 'text-primary font-medium' : ''}`}>
                {i < step ? <Check className="h-3 w-3" /> : <s.icon className="h-3 w-3" />}
                <span className="hidden sm:inline">{s.label}</span>
              </span>
            ))}
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>

        {/* Content Card */}
        <div className="bg-card border border-border rounded-lg p-6 space-y-5 min-h-[300px]">
          {/* Step 0: API Keys */}
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Connect Your APIs</h2>
                <p className="text-xs text-muted-foreground mt-1">Optional — you can add these later in Settings.</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Polygon.io API Key</Label>
                <div className="relative mt-1">
                  <Input type={showKeys ? 'text' : 'password'} value={polygonKey} onChange={e => setPolygonKey(e.target.value)} placeholder="Enter Polygon.io API key" className="bg-surface-2 border-border pr-10" />
                  <button onClick={() => setShowKeys(!showKeys)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showKeys ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Alpaca API Key</Label>
                <Input type={showKeys ? 'text' : 'password'} value={alpacaKey} onChange={e => setAlpacaKey(e.target.value)} placeholder="Enter Alpaca API key" className="bg-surface-2 border-border mt-1" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Alpaca Secret Key</Label>
                <Input type={showKeys ? 'text' : 'password'} value={alpacaSecret} onChange={e => setAlpacaSecret(e.target.value)} placeholder="Enter Alpaca secret key" className="bg-surface-2 border-border mt-1" />
              </div>
            </div>
          )}

          {/* Step 1: Watchlist */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Set Your Watchlist</h2>
                <p className="text-xs text-muted-foreground mt-1">These tickers will be scanned daily by your playbooks.</p>
              </div>
              <div className="flex gap-2">
                <Input value={tickerInput} onChange={e => setTickerInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTickers(); } }} placeholder="Add tickers (e.g. AAPL, TSLA)" className="flex-1" />
                <Button variant="outline" size="sm" onClick={addTickers} disabled={!tickerInput.trim()}><Plus className="h-3 w-3" /></Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {watchlist.map(t => (
                  <button key={t} onClick={() => setWatchlist(prev => prev.filter(x => x !== t))} className="bg-accent text-accent-foreground text-xs px-2 py-1 rounded font-mono hover:bg-destructive/20 hover:text-destructive transition-colors">{t} ×</button>
                ))}
              </div>
              {watchlist.length === 0 && <p className="text-xs text-muted-foreground italic">Add at least a few tickers to get started.</p>}
            </div>
          )}

          {/* Step 2: Playbook */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Choose a Starter Playbook</h2>
                <p className="text-xs text-muted-foreground mt-1">Pick a preset to start scanning. You can customize or add more later.</p>
              </div>
              <div className="space-y-2">
                {PRESET_PLAYBOOKS.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedPlaybook(i === selectedPlaybook ? null : i)}
                    className={`w-full text-left border rounded-lg p-3 space-y-1 transition-colors ${
                      selectedPlaybook === i
                        ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                        : 'border-border hover:border-primary/40'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">{p.name}</span>
                      {selectedPlaybook === i && <Check className="h-4 w-4 text-primary" />}
                    </div>
                    <p className="text-xs text-muted-foreground">{p.description}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Telegram */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Link Telegram (Optional)</h2>
                <p className="text-xs text-muted-foreground mt-1">Get scanner alerts and trade confirmations via Telegram.</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Telegram Chat ID</Label>
                <Input value={telegramChatId} onChange={e => setTelegramChatId(e.target.value)} placeholder="e.g. 123456789" className="bg-surface-2 border-border mt-1" />
                <p className="text-[10px] text-muted-foreground mt-1">Send /start to @leaps_trader_bot then /id to get your chat ID.</p>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => setStep(s => s - 1)} disabled={step === 0} className="gap-1">
            <ChevronLeft className="h-4 w-4" /> Back
          </Button>
          <div className="flex gap-2">
            {step < STEPS.length - 1 && (
              <>
                <Button variant="ghost" onClick={() => setStep(s => s + 1)} className="gap-1 text-muted-foreground">
                  <SkipForward className="h-3 w-3" /> Skip
                </Button>
                <Button onClick={() => setStep(s => s + 1)} className="gap-1">
                  Next <ChevronRight className="h-4 w-4" />
                </Button>
              </>
            )}
            {step === STEPS.length - 1 && (
              <Button onClick={finishOnboarding} disabled={saving} className="gap-1">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Finish Setup
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
