
-- Add stop loss, trailing stop, and closed trade columns to positions
ALTER TABLE public.positions
  ADD COLUMN stop_loss_pct numeric DEFAULT -35,
  ADD COLUMN trailing_stop_pct numeric,
  ADD COLUMN profit_target_pct numeric,
  ADD COLUMN trailing_active boolean NOT NULL DEFAULT false,
  ADD COLUMN highest_pnl_pct numeric,
  ADD COLUMN exit_price numeric,
  ADD COLUMN closed_at timestamptz,
  ADD COLUMN exit_reason text;
