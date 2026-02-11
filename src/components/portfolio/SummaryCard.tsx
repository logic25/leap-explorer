import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface SummaryCardProps {
  label: string;
  value: string;
  color?: string;
  sub?: string;
  icon?: React.ReactNode;
  tooltip?: string;
}

export function SummaryCard({ label, value, color, sub, icon, tooltip }: SummaryCardProps) {
  const card = (
    <div className="bg-card rounded-lg border border-border px-4 py-3">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground uppercase tracking-wider">
        {icon}
        {label}
      </div>
      <div className={`text-2xl font-semibold font-mono mt-0.5 ${color || 'text-foreground'}`}>{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );

  if (!tooltip) return card;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{card}</TooltipTrigger>
        <TooltipContent className="max-w-xs text-xs">
          <p>{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
