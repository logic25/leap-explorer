import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { PlaybookStats } from './types';

interface Props {
  stats: PlaybookStats[];
  onPlaybookClick: (strategyId: string) => void;
  activeFilter: string | null;
}

export function PlaybookPerformance({ stats, onPlaybookClick, activeFilter }: Props) {
  const [open, setOpen] = useState(true);

  if (stats.length === 0) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 text-sm font-semibold text-foreground hover:text-primary transition-colors cursor-pointer w-full">
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        Playbook Performance
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-3">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {stats.map(s => (
            <PlaybookCard
              key={s.strategyId}
              stats={s}
              onClick={() => onPlaybookClick(s.strategyId)}
              isActive={activeFilter === s.strategyId}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function PlaybookCard({ stats, onClick, isActive }: { stats: PlaybookStats; onClick: () => void; isActive: boolean }) {
  const profitColor =
    stats.netPnl > 0 && stats.profitFactor >= 1.5 ? 'border-bullish/40 bg-bullish/5'
    : stats.netPnl < 0 ? 'border-bearish/40 bg-bearish/5'
    : 'border-warning/40 bg-warning/5';

  return (
    <button
      onClick={onClick}
      className={`text-left rounded-lg border p-4 transition-all cursor-pointer ${profitColor} ${
        isActive ? 'ring-2 ring-primary' : 'hover:ring-1 hover:ring-primary/50'
      }`}
    >
      <div className="font-semibold text-sm text-foreground mb-2">{stats.name}</div>
      <div className="grid grid-cols-2 gap-y-1.5 gap-x-4 text-xs">
        <Stat label="Win Rate" value={`${stats.winRate.toFixed(0)}%`} color={stats.winRate >= 50 ? 'text-bullish' : 'text-bearish'} />
        <Stat label="Net P&L" value={`${stats.netPnl >= 0 ? '+' : ''}$${stats.netPnl.toLocaleString()}`} color={stats.netPnl >= 0 ? 'text-bullish' : 'text-bearish'} />
        <Stat label="Profit Factor" value={stats.profitFactor === Infinity ? '∞' : stats.profitFactor.toFixed(2)} />
        <Stat label="R:R Ratio" value={stats.rrRatio === Infinity ? '∞' : `${stats.rrRatio.toFixed(1)}:1`} />
        <Stat label="Exp. Return" value={`${stats.expectedReturn >= 0 ? '+' : ''}${stats.expectedReturn.toFixed(1)}%`} color={stats.expectedReturn >= 0 ? 'text-bullish' : 'text-bearish'} />
        <Stat label="Trades" value={stats.tradeCount.toString()} />
        {stats.avgHoldingDays > 0 && (
          <Stat label="Avg Hold" value={`${stats.avgHoldingDays.toFixed(0)}d`} />
        )}
      </div>
    </button>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <span className="text-muted-foreground">{label}: </span>
      <span className={`font-mono font-medium ${color || 'text-foreground'}`}>{value}</span>
    </div>
  );
}
