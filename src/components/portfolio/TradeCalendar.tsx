import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, format, isSameMonth, isSameDay, addMonths, subMonths,
} from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { Position } from './types';

interface Props {
  closedPositions: Position[];
}

export function TradeCalendar({ closedPositions }: Props) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const dailyPnl = useMemo(() => {
    const map = new Map<string, { pnl: number; trades: Position[] }>();
    for (const p of closedPositions) {
      if (!p.closed_at) continue;
      const key = format(new Date(p.closed_at), 'yyyy-MM-dd');
      const existing = map.get(key) || { pnl: 0, trades: [] };
      existing.pnl += p.pnl || 0;
      existing.trades.push(p);
      map.set(key, existing);
    }
    return map;
  }, [closedPositions]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  const maxAbsPnl = useMemo(() => {
    let max = 0;
    dailyPnl.forEach(v => { max = Math.max(max, Math.abs(v.pnl)); });
    return max || 1;
  }, [dailyPnl]);

  return (
    <div className="bg-card rounded-lg border border-border p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-1 rounded hover:bg-accent transition-colors cursor-pointer">
          <ChevronLeft className="h-4 w-4 text-muted-foreground" />
        </button>
        <span className="text-sm font-semibold text-foreground">{format(currentMonth, 'MMMM yyyy')}</span>
        <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-1 rounded hover:bg-accent transition-colors cursor-pointer">
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} className="text-[10px] text-muted-foreground text-center font-medium uppercase">{d}</div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-1">
        {days.map(day => {
          const key = format(day, 'yyyy-MM-dd');
          const data = dailyPnl.get(key);
          const inMonth = isSameMonth(day, currentMonth);
          const isToday = isSameDay(day, new Date());
          const intensity = data ? Math.min(Math.abs(data.pnl) / maxAbsPnl, 1) : 0;

          let bgClass = '';
          if (data) {
            if (data.pnl > 50) bgClass = 'bg-bullish';
            else if (data.pnl < -50) bgClass = 'bg-bearish';
            else bgClass = 'bg-warning';
          }

          const cell = (
            <div
              className={`relative aspect-square flex flex-col items-center justify-center rounded text-xs transition-colors ${
                !inMonth ? 'opacity-30' : ''
              } ${isToday ? 'ring-1 ring-primary' : ''} ${
                data ? '' : 'hover:bg-accent/50'
              }`}
              style={data ? {
                backgroundColor: `hsl(var(--${data.pnl > 50 ? 'bullish' : data.pnl < -50 ? 'bearish' : 'warning'}) / ${0.1 + intensity * 0.4})`,
              } : undefined}
            >
              <span className={`font-mono ${data ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                {format(day, 'd')}
              </span>
              {data && (
                <span className={`text-[9px] font-mono ${data.pnl >= 0 ? 'text-bullish' : 'text-bearish'}`}>
                  {data.pnl >= 0 ? '+' : ''}{data.pnl.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
              )}
            </div>
          );

          if (!data) return <div key={key}>{cell}</div>;

          return (
            <Popover key={key}>
              <PopoverTrigger asChild>
                <button className="cursor-pointer">{cell}</button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-3 space-y-2" align="center">
                <div className="text-xs font-semibold text-foreground">{format(day, 'MMM d, yyyy')}</div>
                <div className={`text-sm font-mono font-semibold ${data.pnl >= 0 ? 'text-bullish' : 'text-bearish'}`}>
                  Net: {data.pnl >= 0 ? '+' : ''}${data.pnl.toLocaleString()}
                </div>
                <div className="space-y-1">
                  {data.trades.map(t => (
                    <div key={t.id} className="flex justify-between text-xs">
                      <span className="font-mono font-medium text-foreground">{t.ticker}</span>
                      <span className={`font-mono ${(t.pnl || 0) >= 0 ? 'text-bullish' : 'text-bearish'}`}>
                        {(t.pnl || 0) >= 0 ? '+' : ''}${(t.pnl || 0).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          );
        })}
      </div>
    </div>
  );
}
