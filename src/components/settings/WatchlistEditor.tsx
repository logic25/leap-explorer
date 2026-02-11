import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { List, Plus, X } from 'lucide-react';

interface WatchlistEditorProps {
  watchlist: string[];
  onChange: (watchlist: string[]) => void;
}

export default function WatchlistEditor({ watchlist, onChange }: WatchlistEditorProps) {
  const [newTicker, setNewTicker] = useState('');

  const addTicker = () => {
    const ticker = newTicker.trim().toUpperCase();
    if (ticker && !watchlist.includes(ticker)) {
      onChange([...watchlist, ticker]);
      setNewTicker('');
    }
  };

  const removeTicker = (ticker: string) => {
    onChange(watchlist.filter(t => t !== ticker));
  };

  return (
    <section className="bg-card rounded-lg border border-border p-5 space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <List className="h-4 w-4 text-primary" />
        Watchlist ({watchlist.length} stocks)
      </div>
      <div className="flex gap-2">
        <Input
          value={newTicker}
          onChange={e => setNewTicker(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === 'Enter' && addTicker()}
          placeholder="Add ticker (e.g. AAPL)"
          className="bg-surface-2 border-border font-mono"
        />
        <Button onClick={addTicker} size="sm" disabled={!newTicker.trim()} className="gap-1 shrink-0">
          <Plus className="h-4 w-4" />
          Add
        </Button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {watchlist.map(ticker => (
          <span key={ticker} className="bg-surface-2 border border-border text-xs font-mono px-2 py-1 rounded text-foreground flex items-center gap-1 group">
            {ticker}
            <button onClick={() => removeTicker(ticker)} className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
    </section>
  );
}
