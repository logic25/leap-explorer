
## Plan: Stop Loss, Trailing Stop, and Win Rate Stats

### What's Missing Today

The `positions` table only tracks open positions with basic P&L. There are no columns for:
- Stop loss price or percentage
- Trailing stop logic (move SL up after hitting profit target)
- Closed trade history (exit price, exit date, outcome)
- Win/loss statistics

---

### 1. Database Changes

Add new columns to the `positions` table:

- `stop_loss_pct` (numeric) -- initial stop loss percentage (e.g., -35 means exit at 35% loss)
- `trailing_stop_pct` (numeric, nullable) -- trailing stop % once profit target is hit
- `profit_target_pct` (numeric, nullable) -- the profit % threshold that activates the trailing stop
- `trailing_active` (boolean, default false) -- whether trailing stop has been activated
- `highest_pnl_pct` (numeric, nullable) -- tracks the high-water mark for trailing stop calc
- `exit_price` (numeric, nullable) -- filled when position is closed
- `closed_at` (timestamptz, nullable) -- when the position was closed
- `exit_reason` (text, nullable) -- "stop_loss", "trailing_stop", "manual", "roll", etc.

---

### 2. Portfolio Page Enhancements

**New summary cards:**
- **Win Rate** -- calculated from closed positions (where `status = 'closed'` and `pnl > 0`)
- **Avg Win / Avg Loss** -- average P&L % of winners vs losers
- **Total Closed** -- number of completed trades

**Per-position stop loss display:**
- Show the current SL level in the table (new column)
- Color-code: red if price is near SL, green if trailing stop is active
- Show a small indicator when trailing stop has been activated (e.g., lock icon)

**Editable stop loss per position:**
- Click a position's SL cell to edit stop loss % and trailing stop settings
- Popover or inline edit with fields: Initial SL %, Profit Target %, Trailing Stop %

**Closed positions tab:**
- Add a toggle or tab to view closed/historical trades with exit reason and outcome

---

### 3. Stop Loss Logic

Based on your strategy rules (from project memory):
- Default initial stop loss: **-35%** (configurable per position)
- Trailing stop activates at a configurable profit target (e.g., +50%)
- Once active, trailing stop trails at a set % below the high-water mark (e.g., -20% from peak)
- The `suggestion` field already flags positions -- this will now also flag when a position is near its stop loss

---

### 4. Technical Details

**Migration SQL** adds the new columns to `positions` with sensible defaults (stop_loss_pct defaults to -35).

**Portfolio.tsx changes:**
- Fetch both open and closed positions (two queries or filter client-side)
- Compute win rate, avg win, avg loss from closed positions
- Add SL column to the table with inline edit (popover with slider for SL %, profit target, trailing %)
- Add "Closed Trades" section below open positions
- Show trailing stop status with visual indicator

**Files to modify:**
- `src/pages/Portfolio.tsx` -- major UI additions (stats cards, SL column, closed trades section, inline SL editor)
- Database migration -- add columns to `positions`

**No edge function changes needed** -- the stop loss monitoring/alerting can be added later as a scheduled function. This plan focuses on the UI and data model first.
