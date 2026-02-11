import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BookOpen, Loader2, Save, Plus, Trash2, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Strategy {
  id?: string;
  name: string;
  scanner_type: string;
  description: string;
  conditions: Record<string, any>;
  enabled: boolean;
}

interface StrategyPlaybookProps {
  userId: string;
}

const SCANNER_TYPES = ['Value Zone', 'Fallen Angel', 'MegaRun'];

export default function StrategyPlaybook({ userId }: StrategyPlaybookProps) {
  const { toast } = useToast();
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [parsing, setParsing] = useState<string | null>(null);

  useEffect(() => {
    loadStrategies();
  }, [userId]);

  const loadStrategies = async () => {
    const { data } = await supabase
      .from('strategies')
      .select('*')
      .eq('user_id', userId)
      .order('created_at');
    if (data) setStrategies(data as Strategy[]);
    setLoading(false);
  };

  const addStrategy = () => {
    setStrategies(prev => [...prev, {
      name: '',
      scanner_type: SCANNER_TYPES[0],
      description: '',
      conditions: {},
      enabled: true,
    }]);
  };

  const updateStrategy = (index: number, updates: Partial<Strategy>) => {
    setStrategies(prev => prev.map((s, i) => i === index ? { ...s, ...updates } : s));
  };

  const deleteStrategy = async (index: number) => {
    const strategy = strategies[index];
    if (strategy.id) {
      await supabase.from('strategies').delete().eq('id', strategy.id);
    }
    setStrategies(prev => prev.filter((_, i) => i !== index));
    toast({ title: 'Strategy removed' });
  };

  const parseWithAI = async (index: number) => {
    const strategy = strategies[index];
    if (!strategy.description.trim()) return;
    
    const key = strategy.id || String(index);
    setParsing(key);

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-strategy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ description: strategy.description, scanner_type: strategy.scanner_type }),
      });

      if (!response.ok) throw new Error('Failed to parse strategy');
      const { conditions } = await response.json();
      updateStrategy(index, { conditions });
      toast({ title: 'AI parsed conditions', description: `${Object.keys(conditions).length} rules extracted.` });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Parse failed', description: err.message });
    }
    setParsing(null);
  };

  const saveStrategy = async (index: number) => {
    const strategy = strategies[index];
    if (!strategy.name.trim()) {
      toast({ variant: 'destructive', title: 'Name required' });
      return;
    }

    const key = strategy.id || String(index);
    setSaving(key);

    try {
      if (strategy.id) {
        const { error } = await supabase
          .from('strategies')
          .update({
            name: strategy.name,
            scanner_type: strategy.scanner_type,
            description: strategy.description,
            conditions: strategy.conditions,
            enabled: strategy.enabled,
          })
          .eq('id', strategy.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('strategies')
          .insert({
            user_id: userId,
            name: strategy.name,
            scanner_type: strategy.scanner_type,
            description: strategy.description,
            conditions: strategy.conditions,
            enabled: strategy.enabled,
          })
          .select()
          .single();
        if (error) throw error;
        updateStrategy(index, { id: (data as any).id });
      }
      toast({ title: 'Strategy saved' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Save failed', description: err.message });
    }
    setSaving(null);
  };

  if (loading) return <div className="text-muted-foreground text-sm">Loading strategies...</div>;

  return (
    <section className="bg-card rounded-lg border border-border p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <BookOpen className="h-4 w-4 text-primary" />
          Strategy Playbook
        </div>
        <Button variant="outline" size="sm" onClick={addStrategy} className="gap-1">
          <Plus className="h-3 w-3" />
          Add Strategy
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Describe your strategy in plain English. The AI will parse it into scanner conditions.
      </p>

      {strategies.length === 0 && (
        <p className="text-xs text-muted-foreground italic py-4 text-center">No strategies yet. Add one to get started.</p>
      )}

      {strategies.map((strategy, index) => {
        const key = strategy.id || String(index);
        return (
          <div key={key} className="border border-border rounded-lg p-4 space-y-3 bg-surface-2/50">
            <div className="flex gap-2">
              <Input
                value={strategy.name}
                onChange={e => updateStrategy(index, { name: e.target.value })}
                placeholder="Strategy name (e.g. Value Zone)"
                className="bg-surface-2 border-border text-sm"
              />
              <select
                value={strategy.scanner_type}
                onChange={e => updateStrategy(index, { scanner_type: e.target.value })}
                className="bg-surface-2 border border-border rounded-md px-2 text-sm text-foreground"
              >
                {SCANNER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Describe your conditions in plain English</Label>
              <Textarea
                value={strategy.description}
                onChange={e => updateStrategy(index, { description: e.target.value })}
                placeholder="e.g. Stock is near the 50-day MA, RSI below 45, volume at least 1.2x average, price above the 200-day MA..."
                className="bg-surface-2 border-border mt-1 min-h-[80px] text-sm"
              />
            </div>

            {Object.keys(strategy.conditions).length > 0 && (
              <div className="bg-background/50 border border-border rounded p-3">
                <Label className="text-xs text-muted-foreground mb-2 block">Parsed Conditions</Label>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(strategy.conditions).map(([key, val]) => (
                    <span key={key} className="bg-primary/10 text-primary text-xs px-2 py-0.5 rounded font-mono">
                      {key}: {JSON.stringify(val)}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch checked={strategy.enabled} onCheckedChange={e => updateStrategy(index, { enabled: e })} />
                <span className="text-xs text-muted-foreground">{strategy.enabled ? 'Enabled' : 'Disabled'}</span>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => deleteStrategy(index)} className="text-destructive hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => parseWithAI(index)} disabled={parsing === key || !strategy.description.trim()} className="gap-1">
                  {parsing === key ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                  Parse
                </Button>
                <Button size="sm" onClick={() => saveStrategy(index)} disabled={saving === key} className="gap-1">
                  {saving === key ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                  Save
                </Button>
              </div>
            </div>
          </div>
        );
      })}
    </section>
  );
}
