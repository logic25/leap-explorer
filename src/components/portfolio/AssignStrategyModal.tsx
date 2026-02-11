import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { Strategy, Position } from './types';
import { toast } from 'sonner';

interface Props {
  strategies: Strategy[];
  positions: Position[];
  onStrategiesChange: (strategies: Strategy[]) => void;
  onPositionsChange: (positions: Position[]) => void;
}

export function AssignStrategyModal({ strategies, positions, onStrategiesChange, onPositionsChange }: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'new' | 'assign'>('new');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [scannerType, setScannerType] = useState('daily');
  // Assign mode
  const [selectedStrategy, setSelectedStrategy] = useState('');
  const [selectedPosition, setSelectedPosition] = useState('');

  const handleCreateStrategy = async () => {
    if (!user || !name.trim()) return;
    const { data, error } = await supabase.from('strategies').insert({
      name: name.trim(),
      description: description.trim(),
      scanner_type: scannerType,
      user_id: user.id,
    }).select().single();

    if (error) {
      toast.error('Failed to create strategy');
      return;
    }
    onStrategiesChange([...strategies, data as Strategy]);
    toast.success(`Strategy "${name}" created`);
    setName('');
    setDescription('');
    setOpen(false);
  };

  const handleAssignStrategy = async () => {
    if (!selectedStrategy || !selectedPosition) return;
    const { error } = await supabase.from('positions')
      .update({ strategy_id: selectedStrategy })
      .eq('id', selectedPosition);

    if (error) {
      toast.error('Failed to assign strategy');
      return;
    }
    onPositionsChange(positions.map(p =>
      p.id === selectedPosition ? { ...p, strategy_id: selectedStrategy } : p
    ));
    toast.success('Strategy assigned to position');
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="text-xs gap-1">
          <Plus className="h-3 w-3" /> Add Strategy
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Strategy / Playbook</DialogTitle>
        </DialogHeader>

        <div className="flex gap-2 mb-4">
          <Button
            size="sm"
            variant={mode === 'new' ? 'default' : 'outline'}
            onClick={() => setMode('new')}
            className="text-xs"
          >
            Create New
          </Button>
          <Button
            size="sm"
            variant={mode === 'assign' ? 'default' : 'outline'}
            onClick={() => setMode('assign')}
            className="text-xs"
          >
            Assign to Position
          </Button>
        </div>

        {mode === 'new' ? (
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground">Name</Label>
              <Input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Value Zone, Fallen Angel"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Description</Label>
              <Input
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Brief description of strategy rules"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Scanner Type</Label>
              <Select value={scannerType} onValueChange={setScannerType}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline" size="sm">Cancel</Button></DialogClose>
              <Button size="sm" onClick={handleCreateStrategy} disabled={!name.trim()}>Create</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground">Strategy</Label>
              <Select value={selectedStrategy} onValueChange={setSelectedStrategy}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select a strategy" />
                </SelectTrigger>
                <SelectContent>
                  {strategies.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Position</Label>
              <Select value={selectedPosition} onValueChange={setSelectedPosition}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select a position" />
                </SelectTrigger>
                <SelectContent>
                  {positions.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.ticker} — {p.option_type} ${p.strike}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline" size="sm">Cancel</Button></DialogClose>
              <Button size="sm" onClick={handleAssignStrategy} disabled={!selectedStrategy || !selectedPosition}>
                Assign
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
