
-- Create wealth_goals table
CREATE TABLE public.wealth_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  starting_capital numeric NOT NULL DEFAULT 300000,
  target_value numeric NOT NULL DEFAULT 10000000,
  time_horizon_years integer NOT NULL DEFAULT 10,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.wealth_goals ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own goals" ON public.wealth_goals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own goals" ON public.wealth_goals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own goals" ON public.wealth_goals FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own goals" ON public.wealth_goals FOR DELETE USING (auth.uid() = user_id);

-- Timestamp trigger
CREATE TRIGGER update_wealth_goals_updated_at
  BEFORE UPDATE ON public.wealth_goals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add roll_status to positions
ALTER TABLE public.positions ADD COLUMN IF NOT EXISTS roll_status text;
