
-- Profiles table (linked to auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  trading_mode TEXT NOT NULL DEFAULT 'paper' CHECK (trading_mode IN ('paper', 'live')),
  stock_watchlist JSONB NOT NULL DEFAULT '["MSFT","GOOG","AMZN","NVDA","META","AVGO","CRWD","IREN","MARA","AMD"]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Scanner alerts
CREATE TABLE public.scanner_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ticker TEXT NOT NULL,
  name TEXT,
  scanner_type TEXT NOT NULL CHECK (scanner_type IN ('Value Zone', 'MegaRun', 'Fallen Angel')),
  scan_date DATE NOT NULL DEFAULT CURRENT_DATE,
  price NUMERIC,
  change_pct NUMERIC,
  rsi NUMERIC,
  volume BIGINT,
  avg_volume BIGINT,
  suggested_strike NUMERIC,
  suggested_expiry TEXT,
  delta NUMERIC,
  dte INTEGER,
  open_interest INTEGER,
  bid_ask_spread NUMERIC,
  iv_percentile NUMERIC,
  iv_rank NUMERIC,
  iv_hv_ratio NUMERIC,
  ask_price NUMERIC,
  historical_low NUMERIC,
  checklist JSONB NOT NULL DEFAULT '[]'::jsonb,
  confluence_score TEXT CHECK (confluence_score IN ('High', 'Medium', 'Low')),
  all_passed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.scanner_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own alerts" ON public.scanner_alerts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System inserts alerts" ON public.scanner_alerts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own alerts" ON public.scanner_alerts FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_scanner_alerts_user_date ON public.scanner_alerts(user_id, scan_date DESC);

-- Active positions
CREATE TABLE public.positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ticker TEXT NOT NULL,
  name TEXT,
  option_type TEXT NOT NULL DEFAULT 'CALL',
  strike NUMERIC NOT NULL,
  expiry TEXT,
  qty INTEGER NOT NULL DEFAULT 1,
  avg_cost NUMERIC,
  current_price NUMERIC,
  pnl NUMERIC,
  pnl_pct NUMERIC,
  delta NUMERIC,
  dte INTEGER,
  allocation NUMERIC,
  suggestion TEXT,
  suggestion_type TEXT CHECK (suggestion_type IN ('roll', 'exit', 'warning', 'hedge')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'rolled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own positions" ON public.positions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users manage own positions" ON public.positions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own positions" ON public.positions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own positions" ON public.positions FOR DELETE USING (auth.uid() = user_id);

-- Audit log (append-only for users)
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own audit log" ON public.audit_log FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users append audit log" ON public.audit_log FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_audit_log_user ON public.audit_log(user_id, created_at DESC);

-- Chat messages
CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own messages" ON public.chat_messages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own messages" ON public.chat_messages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own messages" ON public.chat_messages FOR DELETE USING (auth.uid() = user_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_positions_updated_at BEFORE UPDATE ON public.positions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
