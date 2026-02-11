-- Add account size and allocation target to profiles so sizing is data-driven
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_size NUMERIC DEFAULT 100000,
  ADD COLUMN IF NOT EXISTS max_allocation_pct NUMERIC DEFAULT 80,
  ADD COLUMN IF NOT EXISTS position_size_pct NUMERIC DEFAULT 3;

-- max_allocation_pct: total portfolio allocation cap (default 80%)
-- position_size_pct: per-position sizing as % of account (default 3%, rule is 2-4%)
