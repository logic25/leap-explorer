import type { ScannerType } from '@/lib/mock-data';

const badgeConfig: Record<ScannerType, string> = {
  'Value Zone': 'bg-primary/15 text-primary border-primary/30',
  'MegaRun': 'bg-bullish/15 text-bullish border-bullish/30',
  'Fallen Angel': 'bg-warning/15 text-warning border-warning/30',
};

export function ScannerBadge({ type }: { type: ScannerType }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${badgeConfig[type]}`}>
      {type}
    </span>
  );
}
