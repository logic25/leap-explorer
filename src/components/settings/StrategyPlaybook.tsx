import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BookOpen, Loader2, Save, Plus, Trash2, Sparkles, Pencil } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Strategy {
  id?: string;
  name: string;
  scanner_type: string;
  description: string;
  conditions: Record<string, any>;
  enabled: boolean;
  tickers: string[];
}

interface StrategyPlaybookProps {
  userId: string;
}

const SCANNER_TYPES = ['Value Zone', 'Fallen Angel', 'MegaRun'];

const DEFAULT_STRATEGY: Strategy = {
  name: '',
  scanner_type: SCANNER_TYPES[0],
  description: '',
  conditions: {},
  enabled: true,
  tickers: [],
};

export default function StrategyPlaybook({ userId }: StrategyPlaybookProps) {
  const { toast } = useToast();
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState<Strategy>({ ...DEFAULT_STRATEGY });
  const [tickerInput, setTickerInput] = useState('');

  useEffect(() => {
    loadStrategies();
  }, [userId]);

  const loadStrategies = async () => {
    const { data } = await supabase
      .from('strategies')
      .select('*')
      .eq('user_id', userId)
      .order('created_at');
    if (data) setStrategies(data.map((d: any) => ({ ...d, tickers: d.tickers || [] })) as Strategy[]);
    setLoading(false);
  };

  const openNewModal = () => {
    setEditIndex(null);
    setDraft({ ...DEFAULT_STRATEGY });
    setTickerInput('');
    setModalOpen(true);
  };

  const openEditModal = (index: number) => {
    setEditIndex(index);
    setDraft({ ...strategies[index], tickers: strategies[index].tickers || [] });
    setTickerInput('');
    setModalOpen(true);
  };

  const addTickers = () => {
    const newTickers = tickerInput.toUpperCase().split(/[\s,]+/).filter(t => t && !draft.tickers.includes(t));
    if (newTickers.length > 0) {
      setDraft(prev => ({ ...prev, tickers: [...prev.tickers, ...newTickers] }));
    }
    setTickerInput('');
  };

  const removeTicker = (ticker: string) => {
    setDraft(prev => ({ ...prev, tickers: prev.tickers.filter(t => t !== ticker) }));
  };

  const deleteStrategy = async (index: number) => {
    const strategy = strategies[index];
    if (strategy.id) {
      await supabase.from('strategies').delete().eq('id', strategy.id);
    }
    setStrategies(prev => prev.filter((_, i) => i !== index));
    toast({ title: 'Strategy removed' });
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

  const updateDraftCondition = (key: string, value: any) => {
    setDraft(prev => ({
      ...prev,
      conditions: { ...prev.conditions, [key]: value },
    }));
  };

  const removeDraftCondition = (key: string) => {
    setDraft(prev => {
      const next = { ...prev.conditions };
      delete next[key];
      return { ...prev, conditions: next };
    });
  };

  const saveStrategy = async () => {
    if (!draft.name.trim()) {
      toast({ variant: 'destructive', title: 'Name required' });
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
        setStrategies(prev => prev.map((s, i) => (i === editIndex ? { ...draft } : s)));
      } else {
        const { data, error } = await supabase
          .from('strategies')
          .insert({
            user_id: userId,
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
        setStrategies(prev => [...prev, { ...draft, id: (data as any).id }]);
      }
      toast({ title: 'Strategy saved' });
      setModalOpen(false);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Save failed', description: err.message });
    }
    setSaving(false);
  };

  if (loading) return <div className="text-muted-foreground text-sm">Loading strategies...</div>;

  return (
    <section className="bg-card rounded-lg border border-border p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <BookOpen className="h-4 w-4 text-primary" />
          Strategy Playbook
        </div>
        <Button variant="outline" size="sm" onClick={openNewModal} className="gap-1">
          <Plus className="h-3 w-3" />
          Add Strategy
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Define scanner strategies using AI parsing or manual controls.
      </p>

      {strategies.length === 0 && (
        <p className="text-xs text-muted-foreground italic py-4 text-center">No strategies yet. Add one to get started.</p>
      )}

      {strategies.map((strategy, index) => (
        <div key={strategy.id || index} className="border border-border rounded-lg p-4 space-y-2 bg-surface-2/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">{strategy.name || 'Unnamed'}</span>
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">{strategy.scanner_type}</span>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={strategy.enabled}
                onCheckedChange={async (enabled) => {
                  setStrategies(prev => prev.map((s, i) => (i === index ? { ...s, enabled } : s)));
                  if (strategy.id) {
                    await supabase.from('strategies').update({ enabled }).eq('id', strategy.id);
                  }
                }}
              />
              <Button variant="ghost" size="sm" onClick={() => openEditModal(index)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => deleteStrategy(index)} className="text-destructive hover:text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          {strategy.tickers && strategy.tickers.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {strategy.tickers.map(t => (
                <span key={t} className="bg-accent text-accent-foreground text-xs px-1.5 py-0.5 rounded font-mono">{t}</span>
              ))}
            </div>
          )}
          {strategy.description && (
            <p className="text-xs text-muted-foreground line-clamp-2">{strategy.description}</p>
          )}
          {Object.keys(strategy.conditions).length > 0 && (
            <div className="flex flex-wrap gap-1">
              {Object.entries(strategy.conditions).map(([key, val]) => (
                <span key={key} className="bg-primary/10 text-primary text-xs px-2 py-0.5 rounded font-mono">
                  {key}: {JSON.stringify(val)}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}

      {/* Strategy Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editIndex !== null ? 'Edit Strategy' : 'New Strategy'}</DialogTitle>
            <DialogDescription>
              Use AI to parse natural language or manually configure scanner conditions.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex gap-2">
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground">Name</Label>
                <Input
                  value={draft.name}
                  onChange={e => setDraft(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Value Zone Conservative"
                  className="mt-1"
                />
              </div>
              <div className="w-40">
                <Label className="text-xs text-muted-foreground">Scanner Type</Label>
                <Select
                  value={draft.scanner_type}
                  onValueChange={v => setDraft(prev => ({ ...prev, scanner_type: v }))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SCANNER_TYPES.map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={draft.enabled}
                onCheckedChange={e => setDraft(prev => ({ ...prev, enabled: e }))}
              />
              <span className="text-xs text-muted-foreground">{draft.enabled ? 'Enabled' : 'Disabled'}</span>
            </div>

            {/* Per-strategy tickers */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Tickers (leave empty to use Default Watchlist)</Label>
              <div className="flex gap-2">
                <Input
                  value={tickerInput}
                  onChange={e => setTickerInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTickers(); } }}
                  placeholder="e.g. NVDA, MSFT, AMZN"
                  className="flex-1"
                />
                <Button type="button" variant="outline" size="sm" onClick={addTickers} disabled={!tickerInput.trim()}>
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              {draft.tickers.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {draft.tickers.map(t => (
                    <button
                      key={t}
                      onClick={() => removeTicker(t)}
                      className="bg-accent text-accent-foreground text-xs px-2 py-0.5 rounded font-mono hover:bg-destructive/20 hover:text-destructive transition-colors"
                      title="Click to remove"
                    >
                      {t} ×
                    </button>
                  ))}
                </div>
              )}
            </div>

            <Tabs defaultValue="ai" className="w-full">
              <TabsList className="w-full">
                <TabsTrigger value="ai" className="flex-1 gap-1">
                  <Sparkles className="h-3 w-3" /> AI Mode
                </TabsTrigger>
                <TabsTrigger value="manual" className="flex-1 gap-1">
                  Manual Controls
                </TabsTrigger>
              </TabsList>

              {/* AI Tab */}
              <TabsContent value="ai" className="space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Describe your conditions in plain English</Label>
                  <Textarea
                    value={draft.description}
                    onChange={e => setDraft(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="e.g. Stock near 50-day MA, RSI below 45, volume at least 1.2x average, price above 200-day MA..."
                    className="mt-1 min-h-[100px] text-sm"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={parseWithAI}
                  disabled={parsing || !draft.description.trim()}
                  className="gap-1"
                >
                  {parsing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                  Parse with AI
                </Button>
              </TabsContent>

              {/* Manual Tab */}
              <TabsContent value="manual" className="space-y-4">
                {/* RSI Range */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">RSI Range</Label>
                    <span className="text-xs font-mono text-foreground">
                      {draft.conditions.rsi_min ?? 20} – {draft.conditions.rsi_max ?? 80}
                    </span>
                  </div>
                  <Slider
                    min={0}
                    max={100}
                    step={1}
                    value={[draft.conditions.rsi_min ?? 20, draft.conditions.rsi_max ?? 80]}
                    onValueChange={([min, max]) => {
                      updateDraftCondition('rsi_min', min);
                      updateDraftCondition('rsi_max', max);
                    }}
                  />
                </div>

                {/* Volume Ratio Min */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">Min Volume Ratio (vol/avg)</Label>
                    <span className="text-xs font-mono text-foreground">
                      {draft.conditions.volume_ratio_min ?? 1.0}x
                    </span>
                  </div>
                  <Slider
                    min={0.5}
                    max={5}
                    step={0.1}
                    value={[draft.conditions.volume_ratio_min ?? 1.0]}
                    onValueChange={([v]) => updateDraftCondition('volume_ratio_min', v)}
                  />
                </div>

                {/* Price vs SMA50 */}
                <div>
                  <Label className="text-xs text-muted-foreground">Price vs 50-day SMA</Label>
                  <Select
                    value={draft.conditions.price_vs_sma50 || ''}
                    onValueChange={v => updateDraftCondition('price_vs_sma50', v)}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Any" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="above">Above</SelectItem>
                      <SelectItem value="below">Below</SelectItem>
                      <SelectItem value="near">Near (±3%)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Price vs SMA200 */}
                <div>
                  <Label className="text-xs text-muted-foreground">Price vs 200-day SMA</Label>
                  <Select
                    value={draft.conditions.price_vs_sma200 || ''}
                    onValueChange={v => updateDraftCondition('price_vs_sma200', v)}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Any" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="above">Above</SelectItem>
                      <SelectItem value="below">Below</SelectItem>
                      <SelectItem value="near">Near (±3%)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Delta Range */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">Delta Range</Label>
                    <span className="text-xs font-mono text-foreground">
                      {(draft.conditions.delta_min ?? 0.40).toFixed(2)} – {(draft.conditions.delta_max ?? 0.70).toFixed(2)}
                    </span>
                  </div>
                  <Slider
                    min={0.1}
                    max={1.0}
                    step={0.05}
                    value={[draft.conditions.delta_min ?? 0.40, draft.conditions.delta_max ?? 0.70]}
                    onValueChange={([min, max]) => {
                      updateDraftCondition('delta_min', parseFloat(min.toFixed(2)));
                      updateDraftCondition('delta_max', parseFloat(max.toFixed(2)));
                    }}
                  />
                </div>

                {/* Min DTE */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">Min Days to Expiry</Label>
                    <span className="text-xs font-mono text-foreground">
                      {draft.conditions.dte_min ?? 180}
                    </span>
                  </div>
                  <Slider
                    min={30}
                    max={730}
                    step={10}
                    value={[draft.conditions.dte_min ?? 180]}
                    onValueChange={([v]) => updateDraftCondition('dte_min', v)}
                  />
                </div>

                {/* IV Percentile Max */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">Max IV Percentile</Label>
                    <span className="text-xs font-mono text-foreground">
                      {draft.conditions.iv_percentile_max ?? 50}%
                    </span>
                  </div>
                  <Slider
                    min={0}
                    max={100}
                    step={1}
                    value={[draft.conditions.iv_percentile_max ?? 50]}
                    onValueChange={([v]) => updateDraftCondition('iv_percentile_max', v)}
                  />
                </div>

                {/* Drawdown from SMA50 (Fallen Angel) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">Min Drawdown from 50 SMA % (Fallen Angel)</Label>
                    <span className="text-xs font-mono text-foreground">
                      {draft.conditions.drawdown_from_sma50_min ?? 0}%
                    </span>
                  </div>
                  <Slider
                    min={0}
                    max={60}
                    step={1}
                    value={[draft.conditions.drawdown_from_sma50_min ?? 0]}
                    onValueChange={([v]) => updateDraftCondition('drawdown_from_sma50_min', v)}
                  />
                </div>
              </TabsContent>
            </Tabs>

            {/* Parsed conditions preview */}
            {Object.keys(draft.conditions).length > 0 && (
              <div className="bg-background/50 border border-border rounded p-3">
                <Label className="text-xs text-muted-foreground mb-2 block">Active Conditions</Label>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(draft.conditions).map(([key, val]) => (
                    <button
                      key={key}
                      onClick={() => removeDraftCondition(key)}
                      className="bg-primary/10 text-primary text-xs px-2 py-0.5 rounded font-mono hover:bg-destructive/20 hover:text-destructive transition-colors"
                      title="Click to remove"
                    >
                      {key}: {JSON.stringify(val)} ×
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button onClick={saveStrategy} disabled={saving} className="gap-1">
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                {editIndex !== null ? 'Update' : 'Create'} Strategy
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
