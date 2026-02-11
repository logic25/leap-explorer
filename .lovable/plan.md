

## Plan: Editable Watchlist, Strategy Playbook, Telegram Test, and AI Price Suggestions

This plan covers four interconnected features that transform your Settings page into a full strategy configuration hub and enhance the trade execution flow.

---

### 1. Editable Watchlist (Settings Page)

Replace the static stock list display with an interactive watchlist manager:

- **Add/remove tickers** with an input field and delete buttons
- **Persist to database** -- the `profiles.stock_watchlist` column (jsonb) already exists and stores your tickers
- **Sync on save** so the scanner uses your updated list
- Remove the hardcoded `STOCK_LIST` from `mock-data.ts` in favor of reading from the database

---

### 2. Natural Language Strategy Playbook

Add a new "Strategy Playbook" section to Settings where you can describe your strategies in plain English and the AI interprets them into scanner conditions:

- **Strategy cards** for each scanner type (Value Zone, Fallen Angel, MegaRun) with a text area for your thesis/conditions in natural language
- **AI parsing**: When you save, the system sends your natural language description to the AI (via the existing chat edge function) to extract structured conditions (RSI thresholds, MA relationships, volume ratios, etc.)
- **Stored in a new `strategies` table** with columns: `id`, `user_id`, `name`, `scanner_type`, `description` (your natural language text), `conditions` (jsonb -- the parsed rules), `enabled` (boolean)
- The `scan-watchlist` function will read from this table instead of using hardcoded `detectScannerType` logic, allowing your custom playbooks to drive the scanner

---

### 3. Telegram Bot Test Flow

To test the full alert-to-approval cycle:

- **Create a "Send Test Alert" button** in Settings (Telegram section) that triggers `scan-watchlist` for just 1-2 tickers (e.g., NVDA, MSFT) against your linked Telegram
- This fires the existing flow: scan -> insert alert -> send Telegram notification -> you reply `/approve TICKER` -> position created -> fill confirmation sent back
- **Fix the webhook**: Ensure the Telegram webhook is registered (call `setup_webhook` action) so replies from your Telegram are routed back to the bot

---

### 4. AI-Suggested Limit Order Price

Enhance the `/approve` flow so the AI suggests an optimal limit price before execution:

- When you `/approve TICKER`, before executing, the bot calls the AI with context: current ask, bid, historical low for the option, IV percentile, and scanner type
- The AI suggests a limit price (e.g., "Suggest $41.20 -- 3% below ask, near 30-day VWAP") with reasoning
- The bot sends this as a confirmation: "AI suggests limit at $41.20. Reply `/confirm TICKER` to execute or `/approve TICKER [price]` to override"
- Adds a two-step flow: `/approve` -> AI suggestion -> `/confirm` or `/approve TICKER 41.20`

---

### Technical Details

**New database table:**
```
strategies:
  - id (uuid, PK)
  - user_id (uuid, references profiles.id)
  - name (text) -- e.g. "Value Zone"
  - scanner_type (text)
  - description (text) -- natural language rules
  - conditions (jsonb) -- AI-parsed structured conditions
  - enabled (boolean, default true)
  - created_at, updated_at (timestamptz)
```

RLS: Users can only read/write their own strategies.

**Files to create/modify:**
- `src/pages/Settings.tsx` -- Add editable watchlist UI + strategy playbook sections + test alert button
- `supabase/functions/scan-watchlist/index.ts` -- Read strategies from DB instead of hardcoded detection
- `supabase/functions/telegram/index.ts` -- Add AI price suggestion step with `/confirm` command
- New migration for `strategies` table

**Edge function changes (telegram):**
- Add `/confirm TICKER` command handler
- Store pending approvals temporarily (in `scanner_alerts` with a `pending_approval` flag or a new `pending_trades` table)
- Call AI gateway for price suggestion using alert context data

