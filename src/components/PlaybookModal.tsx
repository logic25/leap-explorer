import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Loader2, Save, Plus, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

const AVAILABLE_METRICS = [
  { key: 'rsi', label: 'RSI (Relative Strength Index)', group: 'Technical' },
  { key: 'volume_ratio', label: 'Volume Ratio (vol/avg)', group: 'Technical' },
  { key: 'price_vs_sma50', label: 'Price vs 50-day SMA', group: 'Technical' },
  { key: 'price_vs_sma200', label: 'Price vs 200-day SMA', group: 'Technical' },
  { key: 'change_pct', label: 'Daily Price Change %', group: 'Technical' },
  { key: 'drawdown_from_sma50', label: 'Drawdown from 50 SMA', group: 'Technical' },
  { key: 'delta', label: 'Option Delta', group: 'Options' },
  { key: 'dte', label: 'Days to Expiry (DTE)', group: 'Options' },
  { key: 'iv_percentile', label: 'IV Percentile', group: 'Options' },
  { key: 'open_interest', label: 'Open Interest', group: 'Options' },
  { key: 'bid_ask_spread', label: 'Bid-Ask Spread', group: 'Options' },
] as const;

const BUILT_IN_SCANNER_TYPES = ['Value Zone', 'Fallen Angel', 'MegaRun'];

interface Strategy {
  id?: string;
  name: string;
  scanner_type: string;
  description: string;
  conditions: Record<string, any>;
  enabled: boolean;
  tickers: string[];
}

const DEFAULT_STRATEGY: Strategy = {
  name: '',
  scanner_type: '',
  description: '',
  conditions: {},
  enabled: true,
  tickers: [],
};

interface PlaybookModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  strategy?: Strategy;
  onSaved: (s: Strategy) => void;
}

export default function PlaybookModal({ open, onOpenChange, strategy, onSaved }: PlaybookModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [draft, setDraft] = useState<Strategy>({ ...DEFAULT_STRATEGY });
  const [tickerInput, setTickerInput] = useState('');
  const [customTypeInput, setCustomTypeInput] = useState('');
  const [showCustomType, setShowCustomType] = useState(false);
  const [saving, setSaving] = useState(false);
  const [parsing, setParsing] = useState(false);

  useEffect(() => {
    if (open) {
      if (strategy) {
        setDraft({ ...strategy, tickers: strategy.tickers || [] });
        const isCustom = !BUILT_IN_SCANNER_TYPES.includes(strategy.scanner_type);
        setShowCustomType(isCustom);
        setCustomTypeInput(isCustom ? strategy.scanner_type : '');
      } else {
        setDraft({ ...DEFAULT_STRATEGY });
        setShowCustomType(false);
        setCustomTypeInput('');
      }
      setTickerInput('');
    }
  }, [open, strategy]);

  const updateCondition = (key: string, value: any) => {
    setDraft(prev => ({ ...prev, conditions: { ...prev.conditions, [key]: value } }));
  };

  const removeCondition = (key: string) => {
    setDraft(prev => {
      const next = { ...prev.conditions };
      delete next[key];
      return { ...prev, conditions: next };
    });
  };

  const addTickers = () => {
    const newTickers = tickerInput.toUpperCase().split(/[\s,]+/).filter(t => t && !draft.tickers.includes(t));
    if (newTickers.length > 0) setDraft(prev => ({ ...prev, tickers: [...prev.tickers, ...newTickers] }));
    setTickerInput('');
  };

  const parseWithAI = async () => {
    if (!draft.description.trim()) return;
    setParsing(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-strategy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ description: draft.description, scanner_type: draft.scanner_type }),
      });
      if (!response.ok) throw new Error('Failed to parse strategy');
      const { conditions } = await response.json();
      setDraft(prev => ({ ...prev, conditions }));
      toast({ title: 'AI parsed conditions', description: `${Object.keys(conditions).length} rules extracted.` });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Parse failed', description: err.message });
    }
    setParsing(false);
  };

  const save = async () => {
    if (!user || !draft.name.trim() || !draft.scanner_type.trim()) {
      toast({ variant: 'destructive', title: 'Name and type required' });
      return;
    }
    setSaving(true);
    try {
      if (draft.id) {
        const { error } = await supabase
          .from('strategies')
          .update({
            name: draft.name,
            scanner_type: draft.scanner_type,
            description: draft.description,
            conditions: draft.conditions,
            enabled: draft.enabled,
            tickers: draft.tickers,
          } as any)
          .eq('id', draft.id);
        if (error) throw error;
        onSaved({ ...draft });
      } else {
        const { data, error } = await supabase
          .from('strategies')
          .insert({
            user_id: user.id,
            name: draft.name,
            scanner_type: draft.scanner_type,
            description: draft.description,
            conditions: draft.conditions,
            enabled: draft.enabled,
            tickers: draft.tickers,
          } as any)
          .select()
          .single();
        if (error) throw error;
        onSaved({ ...draft, id: (data as any).id });
      }
      toast({ title: 'Playbook saved' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Save failed', description: err.message });
    }
    setSaving(false);
  };

  const allScannerTypes = BUILT_IN_SCANNER_TYPES;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{strategy ? 'Edit Playbook' : 'New Playbook'}</DialogTitle>
          <DialogDescription>
            Configure detection rules, tickers, and conditions for this playbook.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground">Name</Label>
              <Input value={draft.name} onChange={e => setDraft(prev => ({ ...prev, name: e.target.value }))} placeholder="e.g. Value Zone Conservative" className="mt-1" />
            </div>
            <div className="w-48">
              <Label className="text-xs text-muted-foreground">Detection Rule</Label>
              {showCustomType ? (
                <div className="flex gap-1 mt-1">
                  <Input value={customTypeInput} onChange={e => { setCustomTypeInput(e.target.value); setDraft(prev => ({ ...prev, scanner_type: e.target.value })); }} placeholder="Custom type name" />
                  <Button type="button" variant="ghost" size="sm" onClick={() => { setShowCustomType(false); setDraft(prev => ({ ...prev, scanner_type: allScannerTypes[0] || '' })); }} className="text-xs shrink-0">← Back</Button>
                </div>
              ) : (
                <Select value={draft.scanner_type} onValueChange={v => { if (v === '__custom__') { setShowCustomType(true); setCustomTypeInput(''); setDraft(prev => ({ ...prev, scanner_type: '' })); } else { setDraft(prev => ({ ...prev, scanner_type: v })); } }}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    {allScannerTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    <SelectItem value="__custom__" className="text-primary font-medium">+ Custom Type…</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Switch checked={draft.enabled} onCheckedChange={e => setDraft(prev => ({ ...prev, enabled: e }))} />
            <span className="text-xs text-muted-foreground">{draft.enabled ? 'Enabled' : 'Disabled'}</span>
          </div>

          {/* Tickers */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Tickers (leave empty for Default Watchlist)</Label>
            <div className="flex gap-2">
              <Input value={tickerInput} onChange={e => setTickerInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTickers(); } }} placeholder="e.g. NVDA, MSFT" className="flex-1" />
              <Button type="button" variant="outline" size="sm" onClick={addTickers} disabled={!tickerInput.trim()}><Plus className="h-3 w-3" /></Button>
            </div>
            {draft.tickers.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {draft.tickers.map(t => (
                  <button key={t} onClick={() => setDraft(prev => ({ ...prev, tickers: prev.tickers.filter(x => x !== t) }))} className="bg-accent text-accent-foreground text-xs px-2 py-0.5 rounded font-mono hover:bg-destructive/20 hover:text-destructive transition-colors" title="Click to remove">{t} ×</button>
                ))}
              </div>
            )}
          </div>

          {/* Metrics */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Metrics to Scan</Label>
            {['Technical', 'Options'].map(group => (
              <div key={group} className="space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">{group}</span>
                <div className="grid grid-cols-2 gap-1.5">
                  {AVAILABLE_METRICS.filter(m => m.group === group).map(metric => {
                    const enabled = (draft.conditions.enabled_metrics || []).includes(metric.key);
                    return (
                      <label key={metric.key} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-accent/50 rounded px-2 py-1.5 transition-colors">
                        <input type="checkbox" checked={enabled} onChange={e => {
                          const current: string[] = draft.conditions.enabled_metrics || [];
                          updateCondition('enabled_metrics', e.target.checked ? [...current, metric.key] : current.filter((k: string) => k !== metric.key));
                        }} className="h-3.5 w-3.5 rounded border-border accent-primary" />
                        <span className="text-foreground">{metric.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <Tabs defaultValue="ai" className="w-full">
            <TabsList className="w-full">
              <TabsTrigger value="ai" className="flex-1 gap-1"><Sparkles className="h-3 w-3" /> AI Mode</TabsTrigger>
              <TabsTrigger value="manual" className="flex-1 gap-1">Manual Controls</TabsTrigger>
            </TabsList>

            <TabsContent value="ai" className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">Describe conditions in plain English</Label>
                <Textarea value={draft.description} onChange={e => setDraft(prev => ({ ...prev, description: e.target.value }))} placeholder="e.g. Stock near 50-day MA, RSI below 45, volume 1.2x average…" className="mt-1 min-h-[100px] text-sm" />
              </div>
              <Button variant="outline" size="sm" onClick={parseWithAI} disabled={parsing || !draft.description.trim()} className="gap-1">
                {parsing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                Parse with AI
              </Button>
            </TabsContent>

            <TabsContent value="manual" className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between"><Label className="text-xs text-muted-foreground">RSI Range</Label><span className="text-xs font-mono text-foreground">{draft.conditions.rsi_min ?? 20} – {draft.conditions.rsi_max ?? 80}</span></div>
                <Slider min={0} max={100} step={1} value={[draft.conditions.rsi_min ?? 20, draft.conditions.rsi_max ?? 80]} onValueChange={([min, max]) => { updateCondition('rsi_min', min); updateCondition('rsi_max', max); }} />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between"><Label className="text-xs text-muted-foreground">Min Volume Ratio</Label><span className="text-xs font-mono text-foreground">{draft.conditions.volume_ratio_min ?? 1.0}x</span></div>
                <Slider min={0.5} max={5} step={0.1} value={[draft.conditions.volume_ratio_min ?? 1.0]} onValueChange={([v]) => updateCondition('volume_ratio_min', v)} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Price vs 50-day SMA</Label>
                <Select value={draft.conditions.price_vs_sma50 || ''} onValueChange={v => updateCondition('price_vs_sma50', v)}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Any" /></SelectTrigger>
                  <SelectContent><SelectItem value="above">Above</SelectItem><SelectItem value="below">Below</SelectItem><SelectItem value="near">Near (±3%)</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between"><Label className="text-xs text-muted-foreground">Delta Range</Label><span className="text-xs font-mono text-foreground">{(draft.conditions.delta_min ?? 0.40).toFixed(2)} – {(draft.conditions.delta_max ?? 0.70).toFixed(2)}</span></div>
                <Slider min={0.1} max={1.0} step={0.05} value={[draft.conditions.delta_min ?? 0.40, draft.conditions.delta_max ?? 0.70]} onValueChange={([min, max]) => { updateCondition('delta_min', parseFloat(min.toFixed(2))); updateCondition('delta_max', parseFloat(max.toFixed(2))); }} />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between"><Label className="text-xs text-muted-foreground">Min Days to Expiry</Label><span className="text-xs font-mono text-foreground">{draft.conditions.dte_min ?? 180}</span></div>
                <Slider min={30} max={730} step={10} value={[draft.conditions.dte_min ?? 180]} onValueChange={([v]) => updateCondition('dte_min', v)} />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between"><Label className="text-xs text-muted-foreground">Max IV Percentile</Label><span className="text-xs font-mono text-foreground">{draft.conditions.iv_percentile_max ?? 50}%</span></div>
                <Slider min={0} max={100} step={1} value={[draft.conditions.iv_percentile_max ?? 50]} onValueChange={([v]) => updateCondition('iv_percentile_max', v)} />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between"><Label className="text-xs text-muted-foreground">Min Drawdown from 50 SMA %</Label><span className="text-xs font-mono text-foreground">{draft.conditions.drawdown_from_sma50_min ?? 0}%</span></div>
                <Slider min={0} max={60} step={1} value={[draft.conditions.drawdown_from_sma50_min ?? 0]} onValueChange={([v]) => updateCondition('drawdown_from_sma50_min', v)} />
              </div>
            </TabsContent>
          </Tabs>

          {/* Active conditions preview */}
          {Object.keys(draft.conditions).length > 0 && (
            <div className="bg-background/50 border border-border rounded p-3">
              <Label className="text-xs text-muted-foreground mb-2 block">Active Conditions</Label>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(draft.conditions).map(([key, val]) => (
                  <button key={key} onClick={() => removeCondition(key)} className="bg-primary/10 text-primary text-xs px-2 py-0.5 rounded font-mono hover:bg-destructive/20 hover:text-destructive transition-colors" title="Click to remove">{key}: {JSON.stringify(val)} ×</button>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving} className="gap-1">
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
              {strategy ? 'Update' : 'Create'} Playbook
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
