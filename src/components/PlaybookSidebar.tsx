import { useState, useEffect } from 'react';
import { ChevronRight, ChevronLeft, BookOpen, Plus, Pencil, Trash2, Power, PowerOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import PlaybookModal from '@/components/PlaybookModal';

interface Strategy {
  id?: string;
  name: string;
  scanner_type: string;
  description: string;
  conditions: Record<string, any>;
  enabled: boolean;
  tickers: string[];
}

export default function PlaybookSidebar() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(true);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);

  useEffect(() => {
    if (user) loadStrategies();
  }, [user]);

  const loadStrategies = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('strategies')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at');
    if (data) setStrategies(data.map((d: any) => ({ ...d, tickers: d.tickers || [] })) as Strategy[]);
    setLoading(false);
  };

  const toggleEnabled = async (index: number) => {
    const s = strategies[index];
    const enabled = !s.enabled;
    setStrategies(prev => prev.map((st, i) => i === index ? { ...st, enabled } : st));
    if (s.id) {
      await supabase.from('strategies').update({ enabled }).eq('id', s.id);
    }
  };

  const deleteStrategy = async (index: number) => {
    const s = strategies[index];
    if (s.id) await supabase.from('strategies').delete().eq('id', s.id);
    setStrategies(prev => prev.filter((_, i) => i !== index));
    toast({ title: 'Playbook removed' });
  };

  const openEdit = (index: number) => {
    setEditIndex(index);
    setModalOpen(true);
  };

  const openNew = () => {
    setEditIndex(null);
    setModalOpen(true);
  };

  const handleSaved = (saved: Strategy) => {
    if (editIndex !== null) {
      setStrategies(prev => prev.map((s, i) => i === editIndex ? saved : s));
    } else {
      setStrategies(prev => [...prev, saved]);
    }
    setModalOpen(false);
  };

  return (
    <>
      <aside
        className={`
          hidden lg:flex flex-col border-l border-border bg-card h-full shrink-0
          transition-all duration-300 ease-in-out overflow-hidden
          ${expanded ? 'w-64' : 'w-10'}
        `}
      >
        {/* Toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center justify-center h-14 border-b border-border text-muted-foreground hover:text-foreground transition-colors shrink-0"
          title={expanded ? 'Collapse playbooks' : 'Expand playbooks'}
        >
          {expanded ? <ChevronRight className="h-4 w-4" /> : <BookOpen className="h-4 w-4" />}
        </button>

        {expanded && (
          <div className="flex-1 overflow-auto p-3 space-y-3 scrollbar-thin">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Playbooks</span>
              <Button variant="ghost" size="sm" onClick={openNew} className="h-6 w-6 p-0">
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>

            {loading && <p className="text-xs text-muted-foreground">Loading…</p>}

            {!loading && strategies.length === 0 && (
              <div className="text-center py-6 space-y-2">
                <BookOpen className="h-8 w-8 mx-auto text-muted-foreground/40" />
                <p className="text-xs text-muted-foreground">No playbooks yet</p>
                <Button variant="outline" size="sm" onClick={openNew} className="gap-1 text-xs">
                  <Plus className="h-3 w-3" /> Create First Playbook
                </Button>
              </div>
            )}

            {strategies.map((s, i) => (
              <div
                key={s.id || i}
                className={`rounded-md border p-2.5 space-y-1.5 transition-colors ${
                  s.enabled ? 'border-border bg-surface-2/50' : 'border-border/50 bg-muted/30 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-foreground truncate max-w-[120px]">{s.name || 'Unnamed'}</span>
                  <div className="flex items-center gap-0.5">
                    <button onClick={() => toggleEnabled(i)} className="p-1 rounded hover:bg-accent transition-colors" title={s.enabled ? 'Disable' : 'Enable'}>
                      {s.enabled ? <Power className="h-3 w-3 text-bullish" /> : <PowerOff className="h-3 w-3 text-muted-foreground" />}
                    </button>
                    <button onClick={() => openEdit(i)} className="p-1 rounded hover:bg-accent transition-colors">
                      <Pencil className="h-3 w-3 text-muted-foreground" />
                    </button>
                    <button onClick={() => deleteStrategy(i)} className="p-1 rounded hover:bg-accent transition-colors">
                      <Trash2 className="h-3 w-3 text-destructive/70" />
                    </button>
                  </div>
                </div>
                <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">{s.scanner_type}</span>
                {s.tickers.length > 0 && (
                  <div className="flex flex-wrap gap-0.5">
                    {s.tickers.slice(0, 5).map(t => (
                      <span key={t} className="text-[10px] font-mono text-muted-foreground bg-accent px-1 rounded">{t}</span>
                    ))}
                    {s.tickers.length > 5 && <span className="text-[10px] text-muted-foreground">+{s.tickers.length - 5}</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </aside>

      <PlaybookModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        strategy={editIndex !== null ? strategies[editIndex] : undefined}
        onSaved={handleSaved}
      />
    </>
  );
}
