export type ScannerType = 'Value Zone' | 'MegaRun' | 'Fallen Angel';

export type RegimeStatus = 'GREEN' | 'YELLOW' | 'RED';

export interface ScannerAlert {
  id: string;
  ticker: string;
  name: string;
  scannerType: ScannerType;
  price: number;
  change: number;
  changePct: number;
  ma50: number;
  ma200: number;
  rsi: number;
  volume: number;
  avgVolume: number;
  suggestedStrike: number;
  suggestedExpiry: string;
  delta: number;
  dte: number;
  openInterest: number;
  bidAskSpread: number;
  ivPercentile: number;
  askPrice: number;
  historicalLow: number;
  checklist: ChecklistItem[];
  timestamp: string;
}

export interface ChecklistItem {
  label: string;
  passed: boolean;
}

export interface Position {
  id: string;
  ticker: string;
  name: string;
  optionType: string;
  strike: number;
  expiry: string;
  qty: number;
  avgCost: number;
  currentPrice: number;
  pnl: number;
  pnlPct: number;
  delta: number;
  dte: number;
  allocation: number;
  suggestion?: string;
  suggestionType?: 'roll' | 'exit' | 'warning';
}

export const STOCK_LIST = [
  'MSFT', 'GOOG', 'AMZN', 'NVDA', 'META', 'AVGO', 'CRWD', 'IREN', 'MARA', 'AMD'
];

export const mockRegime: { status: RegimeStatus; spyAbove50: boolean; spyAbove200: boolean; vix: number } = {
  status: 'GREEN',
  spyAbove50: true,
  spyAbove200: true,
  vix: 16.4,
};

const checklist = (type: ScannerType): ChecklistItem[] => [
  { label: 'Scanner Confirmation', passed: true },
  { label: 'Weekly Chart: Above 200 MA / Clean Uptrend', passed: true },
  { label: 'Weekly Chart: 1-2 ATR Pullback', passed: type !== 'MegaRun' },
  { label: `Option Chain: Delta ${type === 'Fallen Angel' ? '0.40-0.55' : '0.50-0.65'}`, passed: true },
  { label: 'Option Chain: DTE 700-900+', passed: true },
  { label: 'Option Chain: OI > 500', passed: true },
  { label: 'Option Chain: Bid-Ask < 2-5%', passed: true },
  { label: 'Option Chain: IV Term Structure', passed: type !== 'Fallen Angel' },
  { label: 'Option Chain: IV Percentile < 50th', passed: true },
  { label: 'Portfolio: Size 2-4% / Total < 25%', passed: true },
  { label: 'No Earnings in 2 Weeks', passed: true },
  { label: 'Thesis Understood', passed: false },
];

export const mockAlerts: ScannerAlert[] = [
  {
    id: '1', ticker: 'NVDA', name: 'NVIDIA Corp', scannerType: 'Value Zone',
    price: 142.50, change: 3.20, changePct: 2.3, ma50: 138.00, ma200: 130.50,
    rsi: 42, volume: 58_200_000, avgVolume: 48_500_000,
    suggestedStrike: 140, suggestedExpiry: 'Jan 2028', delta: 0.58, dte: 780,
    openInterest: 12400, bidAskSpread: 1.2, ivPercentile: 38,
    askPrice: 42.50, historicalLow: 35.80,
    checklist: checklist('Value Zone'), timestamp: new Date().toISOString(),
  },
  {
    id: '2', ticker: 'AVGO', name: 'Broadcom Inc', scannerType: 'MegaRun',
    price: 185.30, change: 5.10, changePct: 2.83, ma50: 178.00, ma200: 165.20,
    rsi: 62, volume: 22_100_000, avgVolume: 18_400_000,
    suggestedStrike: 180, suggestedExpiry: 'Jan 2028', delta: 0.61, dte: 810,
    openInterest: 8900, bidAskSpread: 1.8, ivPercentile: 44,
    askPrice: 38.20, historicalLow: 31.50,
    checklist: checklist('MegaRun'), timestamp: new Date().toISOString(),
  },
  {
    id: '3', ticker: 'CRWD', name: 'CrowdStrike', scannerType: 'Fallen Angel',
    price: 198.40, change: -2.80, changePct: -1.39, ma50: 210.00, ma200: 245.00,
    rsi: 35, volume: 9_800_000, avgVolume: 7_200_000,
    suggestedStrike: 200, suggestedExpiry: 'Jan 2028', delta: 0.48, dte: 750,
    openInterest: 5600, bidAskSpread: 2.1, ivPercentile: 32,
    askPrice: 28.90, historicalLow: 22.40,
    checklist: checklist('Fallen Angel'), timestamp: new Date().toISOString(),
  },
];

export const mockPositions: Position[] = [
  {
    id: '1', ticker: 'MSFT', name: 'Microsoft', optionType: 'CALL',
    strike: 420, expiry: 'Jan 2028', qty: 5, avgCost: 52.30, currentPrice: 68.40,
    pnl: 8050, pnlPct: 30.8, delta: 0.72, dte: 620, allocation: 3.2,
  },
  {
    id: '2', ticker: 'GOOG', name: 'Alphabet', optionType: 'CALL',
    strike: 175, expiry: 'Jan 2028', qty: 10, avgCost: 22.10, currentPrice: 31.50,
    pnl: 9400, pnlPct: 42.5, delta: 0.68, dte: 580, allocation: 2.8,
  },
  {
    id: '3', ticker: 'META', name: 'Meta Platforms', optionType: 'CALL',
    strike: 550, expiry: 'Jan 2028', qty: 3, avgCost: 85.20, currentPrice: 62.40,
    pnl: -6840, pnlPct: -26.8, delta: 0.45, dte: 420, allocation: 2.1,
  },
  {
    id: '4', ticker: 'AMD', name: 'AMD Inc', optionType: 'CALL',
    strike: 160, expiry: 'Jun 2027', qty: 8, avgCost: 18.50, currentPrice: 24.80,
    pnl: 5040, pnlPct: 34.1, delta: 0.82, dte: 85, allocation: 1.9,
    suggestion: 'Delta > 0.80 — Consider Roll Up', suggestionType: 'roll',
  },
];
