

# LEAPS Trading Dashboard -- Full Upgrade Plan

This is a major upgrade across the entire dashboard. Given the scope, I recommend a phased approach so we can test each piece before moving to the next.

---

## Phase 1: Settings Strategy Modal Fix + Manual Controls

**Problem**: The "Add Strategy" button in Settings currently just appends a blank inline form. You want it to open a proper modal (like the one on Portfolio) with both natural language AI parsing AND manual condition controls (sliders/dropdowns).

**Changes**:
- Upgrade the `StrategyPlaybook` component in Settings (`src/components/settings/StrategyPlaybook.tsx`) to open a modal dialog when "Add Strategy" is clicked
- The modal will have two tabs:
  - **AI Mode**: Describe in plain English, click "Parse" to extract conditions (existing flow, but in a modal)
  - **Manual Mode**: Form controls for each condition -- RSI range slider, volume ratio min, price vs SMA dropdown (above/below/near), drawdown threshold, etc.
- Both modes write to the same `conditions` JSON, so the scanner uses them identically
- Editing an existing strategy also opens the modal pre-filled

---

## Phase 2: Wealth Builder Tab

**New page**: `src/pages/WealthBuilder.tsx` with nav entry "Wealth Builder" (Target icon)

**Features**:
- **Goal Inputs** (editable, saved to a new `wealth_goals` table):
  - Starting capital (default $300K)
  - Target value (default $10M)
  - Time horizon (default 10 years)
  - Auto-calculated required CAGR
- **Visual Progress** (Recharts line chart):
  - Actual growth curve from cumulative closed P&L
  - Required growth curve (compound line to target)
  - Status label: "On pace" / "Behind by X%" / "Ahead by Y%"
- **Gap Metrics Cards**:
  - Current annualized CAGR
  - Required remaining CAGR
  - Projected end value at current pace
- **Strategy Contribution**: Pie/bar chart showing % of gains from each playbook
- **AI Suggestions**: When behind/ahead, call the chat edge function with context to get actionable advice (e.g., "Increase Tier 1 allocation")

**Database**: New `wealth_goals` table with columns: `id`, `user_id`, `starting_capital`, `target_value`, `time_horizon_years`, `created_at`, `updated_at`. RLS: users can only read/write their own row.

---

## Phase 3: Roll Winner Monitoring

**New edge function**: `supabase/functions/check-rolls/index.ts`

- Runs daily (set up via pg_cron at 4:00 PM EST)
- For each user, fetches open positions from the database
- Evaluates roll conditions:
  - Standard: +100% gain AND delta > 0.80 AND > 6 months DTE
  - Turbo: +150% gain AND delta > 0.85
- If triggered: uses Polygon to find next contract (higher strike, 0.55-0.65 delta, OI > 500, tight spread)
- Sends Telegram alert with roll suggestion and suggested limit price
- If no good next strike: suggests hold or redeploy
- If < 6 months DTE: suggests exit instead of roll

**Portfolio UI additions**:
- New "Roll Status" column in positions table
- Badge: "Ready to roll" (green) when conditions are met, with tooltip showing details
- Add `roll_status` field to positions table (nullable string)

---

## Phase 4: Automated Daily Scan Cron

**Current state**: Scans run manually via "Run Scan Now" button. The edge function already exists and works.

**Changes**:
- Set up `pg_cron` + `pg_net` to call `scan-watchlist` daily at 4:15 PM EST (21:15 UTC)
- The scan already sends Telegram alerts for qualifying setups
- Enhance scan to only alert on 100% checklist passes (filter `all_passed = true` before sending Telegram)
- Add IV Rank, IV/HV ratio checks to the checklist in `scan-watchlist/index.ts`
- Add confluence scoring (count of passed items / total)
- Include suggested limit price (mid from Polygon bid/ask) in alert message

---

## Phase 5: Enhanced Gemini Chat + Telegram NL Queries

**Chat edge function** (`supabase/functions/chat/index.ts`):
- Enrich the system prompt with the user's actual data by querying their positions, goals, and recent alerts before calling Gemini
- Support queries like "Any rolls suggested?", "Are we on track for $10M?", "Backtest Fallen Angel with -50% stops"
- Pass user context (open positions, wealth goal progress, recent scan results) as part of the system message

**Telegram integration** (`supabase/functions/telegram/index.ts`):
- For unrecognized commands (not /approve, /reject, etc.), forward the message to the chat edge function and return the AI response
- This enables natural language queries via Telegram (e.g., "Any good trades today?")

---

## Technical Details

### Database Migrations

1. **`wealth_goals` table**:
```sql
CREATE TABLE wealth_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  starting_capital numeric NOT NULL DEFAULT 300000,
  target_value numeric NOT NULL DEFAULT 10000000,
  time_horizon_years integer NOT NULL DEFAULT 10,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE wealth_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own goals" ON wealth_goals
  FOR ALL USING (auth.uid() = user_id);
```

2. **Add `roll_status` to positions**:
```sql
ALTER TABLE positions ADD COLUMN roll_status text;
```

3. **pg_cron jobs** (via SQL insert, not migration):
   - Daily scan at 21:15 UTC (4:15 PM EST)
   - Daily roll check at 21:00 UTC (4:00 PM EST)

### New Files
- `src/pages/WealthBuilder.tsx` -- Goal tracker page
- `supabase/functions/check-rolls/index.ts` -- Roll monitoring function

### Modified Files
- `src/components/settings/StrategyPlaybook.tsx` -- Modal with manual controls
- `src/components/Layout.tsx` -- Add Wealth Builder nav item
- `src/App.tsx` -- Add /wealth-builder route
- `src/components/portfolio/PositionRow.tsx` -- Roll status badge
- `supabase/functions/scan-watchlist/index.ts` -- Enhanced checklist, confluence, cron-ready
- `supabase/functions/telegram/index.ts` -- NL query forwarding to chat
- `supabase/functions/chat/index.ts` -- User-context-aware system prompt
- `supabase/config.toml` -- Add check-rolls function

### Implementation Order
1. Phase 1 (Settings modal fix) -- quick win, addresses immediate UX issue
2. Phase 2 (Wealth Builder) -- new standalone page, no dependencies
3. Phase 3 (Roll monitoring) -- new edge function + portfolio UI
4. Phase 4 (Cron automation) -- builds on existing scan function
5. Phase 5 (Enhanced AI) -- ties everything together

