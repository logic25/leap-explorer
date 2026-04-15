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
  theta: number;
  vega: number;
  dte: number;
  openInterest: number;
  bidAskSpread: number;
  ivPercentile: number;
  ivRank?: number;
  ivHvRatio?: number;
  askPrice: number;
  historicalLow: number;
  volumeOiRatio?: number;
  unusualActivity?: boolean;
  slippageEst?: number;
  chainQualityScore?: number;
  convexityScore?: number;
  checklist: ChecklistItem[];
  timestamp: string;
}

/**
 * Convexity Score — composite 0-100 rank for ordering LEAPs by "cheap + durable".
 * Higher = better convexity.
 *
 * Inputs (normalized 0-1, then weighted):
 *   - delta            (want 0.55-0.75; too low = OTM lottery, too high = stock proxy)
 *   - DTE              (want ≥ 365; more time = more durability)
 *   - IV percentile    (want ≤ 30; low IV = cheap premium vs own history)
 *   - chain quality    (want high; proxy for OI + spread + slippage)
 *
 * This is a ranking tool, not a pricing model. Use it to compare candidates,
 * not to decide whether any single contract is "fair".
 */
export function computeConvexityScore(a: {
  delta: number;
  dte: number;
  ivPercentile: number;
  chainQualityScore?: number;
}): number {
  // Delta sweet spot: peak at 0.65, fall off on either side.
  const deltaFit = Math.max(0, 1 - Math.abs(a.delta - 0.65) / 0.35);
  // DTE: 0 at 90d, saturates at 900d.
  const dteFit = Math.max(0, Math.min(1, (a.dte - 90) / (900 - 90)));
  // IV percentile: 100 → 0, 0 → 1 (lower IV = cheaper).
  const ivFit = Math.max(0, 1 - a.ivPercentile / 100);
  // Chain quality is already 0-100.
  const qualityFit = (a.chainQualityScore ?? 50) / 100;

  const score =
    deltaFit * 0.30 +
    dteFit * 0.25 +
    ivFit * 0.25 +
    qualityFit * 0.20;

  return Math.round(score * 100);
}

export interface ChecklistItem {
  label: string;
  passed: boolean;
  category?: string;
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
  { label: 'Scanner Confirmation', passed: true, category: 'scanner' },
  { label: 'Weekly Chart: Above 200 MA / Clean Uptrend', passed: true, category: 'scanner' },
  { label: 'Weekly Chart: 1-2 ATR Pullback', passed: type !== 'MegaRun', category: 'scanner' },
  { label: `Delta ${type === 'Fallen Angel' ? '0.40-0.55' : '0.50-0.65'}`, passed: true, category: 'greeks' },
  { label: 'DTE 700-900+', passed: true, category: 'greeks' },
  { label: 'Theta < -$0.05/day', passed: true, category: 'greeks' },
  { label: 'OI > 1,000 (liquid)', passed: true, category: 'liquidity' },
  { label: 'OI > 500 (minimum)', passed: true, category: 'liquidity' },
  { label: 'Bid-Ask Spread < 5%', passed: true, category: 'spread' },
  { label: 'Bid-Ask Spread < 2% (ideal)', passed: true, category: 'spread' },
  { label: 'Est. Slippage < $0.50', passed: true, category: 'spread' },
  { label: 'IV Percentile < 50th', passed: true, category: 'iv' },
  { label: 'IV Rank < 50', passed: true, category: 'iv' },
  { label: 'IV/HV Ratio < 1.3', passed: type !== 'Fallen Angel', category: 'iv' },
  { label: 'Options Volume > 0', passed: true, category: 'volume' },
  { label: 'Volume/OI Ratio < 3', passed: true, category: 'volume' },
  { label: 'Chain Quality Score > 50', passed: true, category: 'quality' },
  { label: 'Portfolio: Size 2-4% / Total < 25%', passed: true, category: 'portfolio' },
  { label: 'No Earnings in 2 Weeks', passed: true, category: 'portfolio' },
  { label: 'Thesis Understood', passed: false, category: 'portfolio' },
];

const rawMockAlerts: ScannerAlert[] = [
  {
    id: '1', ticker: 'NVDA', name: 'NVIDIA Corp', scannerType: 'Value Zone',
    price: 142.50, change: 3.20, changePct: 2.3, ma50: 138.00, ma200: 130.50,
    rsi: 42, volume: 58_200_000, avgVolume: 48_500_000,
    suggestedStrike: 140, suggestedExpiry: 'Jan 2028', delta: 0.58, theta: -0.03, vega: 0.45, dte: 780,
    openInterest: 12400, bidAskSpread: 1.2, ivPercentile: 38, ivRank: 35, ivHvRatio: 0.95,
    askPrice: 42.50, historicalLow: 35.80, volumeOiRatio: 0.8, unusualActivity: false,
    slippageEst: 0.21, chainQualityScore: 82,
    checklist: checklist('Value Zone'), timestamp: new Date().toISOString(),
  },
  {
    id: '2', ticker: 'AVGO', name: 'Broadcom Inc', scannerType: 'MegaRun',
    price: 185.30, change: 5.10, changePct: 2.83, ma50: 178.00, ma200: 165.20,
    rsi: 62, volume: 22_100_000, avgVolume: 18_400_000,
    suggestedStrike: 180, suggestedExpiry: 'Jan 2028', delta: 0.61, theta: -0.04, vega: 0.52, dte: 810,
    openInterest: 8900, bidAskSpread: 1.8, ivPercentile: 44, ivRank: 42, ivHvRatio: 1.05,
    askPrice: 38.20, historicalLow: 31.50, volumeOiRatio: 1.2, unusualActivity: false,
    slippageEst: 0.34, chainQualityScore: 71,
    checklist: checklist('MegaRun'), timestamp: new Date().toISOString(),
  },
  {
    id: '3', ticker: 'CRWD', name: 'CrowdStrike', scannerType: 'Fallen Angel',
    price: 198.40, change: -2.80, changePct: -1.39, ma50: 210.00, ma200: 245.00,
    rsi: 35, volume: 9_800_000, avgVolume: 7_200_000,
    suggestedStrike: 200, suggestedExpiry: 'Jan 2028', delta: 0.48, theta: -0.02, vega: 0.38, dte: 750,
    openInterest: 5600, bidAskSpread: 2.1, ivPercentile: 32, ivRank: 28, ivHvRatio: 1.35,
    askPrice: 28.90, historicalLow: 22.40, volumeOiRatio: 0.5, unusualActivity: false,
    slippageEst: 0.30, chainQualityScore: 58,
    checklist: checklist('Fallen Angel'), timestamp: new Date().toISOString(),
  },
];

export const mockAlerts: ScannerAlert[] = rawMockAlerts.map((a) => ({
  ...a,
  convexityScore: computeConvexityScore(a),
}));

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
