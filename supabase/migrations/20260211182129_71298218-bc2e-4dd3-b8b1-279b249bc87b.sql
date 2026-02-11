
-- Add theta and vega columns to scanner_alerts
ALTER TABLE public.scanner_alerts ADD COLUMN IF NOT EXISTS theta numeric;
ALTER TABLE public.scanner_alerts ADD COLUMN IF NOT EXISTS vega numeric;
ALTER TABLE public.scanner_alerts ADD COLUMN IF NOT EXISTS volume_oi_ratio numeric;
ALTER TABLE public.scanner_alerts ADD COLUMN IF NOT EXISTS unusual_activity boolean DEFAULT false;
ALTER TABLE public.scanner_alerts ADD COLUMN IF NOT EXISTS slippage_est numeric;
ALTER TABLE public.scanner_alerts ADD COLUMN IF NOT EXISTS chain_quality_score integer;

-- Add theta and vega columns to positions
ALTER TABLE public.positions ADD COLUMN IF NOT EXISTS theta numeric;
ALTER TABLE public.positions ADD COLUMN IF NOT EXISTS vega numeric;
