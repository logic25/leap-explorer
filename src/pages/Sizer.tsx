import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Calculator, AlertTriangle } from 'lucide-react';

/**
 * Position Sizer — decide contracts given equity, starter %, and premium.
 *
 * This is a sizing calculator, not a recommendation. "Max loss" assumes the
 * LEAP goes to zero — realistic for deep OTM, a worst case for ITM.
 */
export default function Sizer() {
  const [equity, setEquity] = useState<number>(100_000);
  const [starterPct, setStarterPct] = useState<number>(20);
  const [premium, setPremium] = useState<number>(40);
  const [maxLossPctPortfolio, setMaxLossPctPortfolio] = useState<number>(3);

  const result = useMemo(() => {
    const budget = (equity * starterPct) / 100;
    const costPerContract = premium * 100;
    const contractsByBudget = costPerContract > 0 ? Math.floor(budget / costPerContract) : 0;

    // Max-loss cap: don't let a single position blow up more than X% of portfolio.
    const maxLossBudget = (equity * maxLossPctPortfolio) / 100;
    const contractsByMaxLoss = costPerContract > 0 ? Math.floor(maxLossBudget / costPerContract) : 0;

    const contracts = Math.min(contractsByBudget, contractsByMaxLoss);
    const deployed = contracts * costPerContract;
    const pctOfEquity = equity > 0 ? (deployed / equity) * 100 : 0;
    const binding = contracts === contractsByMaxLoss && contractsByMaxLoss < contractsByBudget
      ? 'max-loss'
      : 'starter';

    return { budget, costPerContract, contracts, contractsByBudget, contractsByMaxLoss, deployed, pctOfEquity, binding };
  }, [equity, starterPct, premium, maxLossPctPortfolio]);

  return (
    <div className="space-y-6 animate-slide-in max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
          <Calculator className="h-5 w-5" />
          Position Sizer
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          How many contracts, given your portfolio and the premium you're looking at.
        </p>
      </div>

      <Card className="p-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Portfolio equity ($)" value={equity} onChange={setEquity} step={1000} />
          <Field label="Starter allocation (%)" value={starterPct} onChange={setStarterPct} step={1} hint="Typical LEAP starter: 10–25%" />
          <Field label="Premium per contract ($)" value={premium} onChange={setPremium} step={1} hint="The ask price shown in the chain" />
          <Field label="Max loss per position (% of portfolio)" value={maxLossPctPortfolio} onChange={setMaxLossPctPortfolio} step={0.5} hint="Hard cap. Common: 2–4%" />
        </div>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Stat label="Contracts" value={result.contracts.toString()} highlight />
        <Stat label="Capital deployed" value={`$${result.deployed.toLocaleString()}`} />
        <Stat label="% of portfolio" value={`${result.pctOfEquity.toFixed(2)}%`} />
      </div>

      <Card className="p-5 space-y-3 text-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Row label="Starter budget" value={`$${result.budget.toLocaleString()}`} />
          <Row label="Cost per contract" value={`$${result.costPerContract.toLocaleString()}`} />
          <Row label="Contracts allowed by starter %" value={result.contractsByBudget.toString()} />
          <Row label="Contracts allowed by max-loss %" value={result.contractsByMaxLoss.toString()} />
        </div>
        {result.binding === 'max-loss' && result.contracts > 0 && (
          <div className="flex items-start gap-2 text-warning bg-warning/10 rounded p-3 text-xs">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              Max-loss cap is the binding constraint. You could afford more with your starter %,
              but a single position to zero would exceed {maxLossPctPortfolio}% of the portfolio.
            </span>
          </div>
        )}
        {result.contracts === 0 && result.costPerContract > 0 && (
          <div className="flex items-start gap-2 text-bearish bg-bearish/10 rounded p-3 text-xs">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              Premium is too large relative to your caps. Lower the premium (cheaper strike/expiry)
              or raise the starter/max-loss limits.
            </span>
          </div>
        )}
      </Card>
    </div>
  );
}

function Field({ label, value, onChange, step, hint }: { label: string; value: number; onChange: (v: number) => void; step?: number; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        step={step}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="font-mono"
      />
      {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`bg-card rounded-lg border border-border px-4 py-3 ${highlight ? 'border-l-2 border-l-primary' : ''}`}>
      <div className="text-[11px] text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className="text-2xl font-semibold font-mono text-foreground mt-0.5">{value}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono text-foreground">{value}</span>
    </div>
  );
}
