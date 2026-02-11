# Move Watchlist Into Strategy (Per-Strategy Tickers)

## Problem

The watchlist is currently a single global list on the user profile. All strategies scan all tickers. This limits flexibility -- users can't assign specific tickers to specific strategies. Also the ability to create new scanners and select what fields you're scannig for.

## Solution

Add a `tickers` field to each strategy so every strategy has its own watchlist. The global watchlist becomes optional (backward-compatible fallback). The scanner checks each strategy's own ticker list first.

## Changes

### 1. Database Migration

- Add `tickers TEXT[]` column to the `strategies` table (default `'{}'`).

### 2. Strategy Playbook UI (`src/components/settings/StrategyPlaybook.tsx`)

- Add an inline watchlist editor inside the strategy modal (both New and Edit flows).
- Display a small ticker chip list below each strategy card.
- Update the `Strategy` interface to include `tickers: string[]`.

### 3. Scan Edge Function (`supabase/functions/scan-watchlist/index.ts`)

- For each user, iterate over enabled strategies.
- Use `strategy.tickers` as the ticker list (fall back to `profile.stock_watchlist` if empty).
- This replaces the current "scan all tickers, then match strategies" loop with a "per-strategy scan" approach.

### 4. Settings Page (`src/pages/Settings.tsx`)

- Keep the global Watchlist section but label it as a "Default Watchlist" fallback.
- Add helper text explaining that per-strategy tickers override the default.

## Technical Details

```text
strategies table (after migration)
+------------+----------+---------+
| column     | type     | default |
+------------+----------+---------+
| ...existing columns...          |
| tickers    | TEXT[]   | '{}'    |
+------------+----------+---------+
```

Scan logic change:

```text
BEFORE:
  For each user:
    tickers = profile.stock_watchlist
    For each ticker:
      For each strategy: check match

AFTER:
  For each user:
    For each enabled strategy:
      tickers = strategy.tickers (or profile.stock_watchlist if empty)
      For each ticker: check match against this strategy only
```

### Files Modified

- `supabase/migrations/` -- new migration adding `tickers` column
- `src/components/settings/StrategyPlaybook.tsx` -- inline ticker editor in modal + chips on cards
- `supabase/functions/scan-watchlist/index.ts` -- per-strategy ticker loop
- `src/pages/Settings.tsx` -- rename Watchlist section to "Default Watchlist"