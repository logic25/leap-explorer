## Portfolio Analytics: Playbook Tracking, Calendar View, and Performance Metrics

### Overview

Enhance the Portfolio page with four additions:

```text
Enhance the Portfolio page with the following four additions and make it the central place for understanding positions, strategy performance, and historical results.

1. Link each position to its originating playbook/strategy
   - Add a new column in the Active Positions table called "Playbook" or "Strategy"
   - Show the name of the playbook/strategy that triggered the entry (e.g. "Value Zone", "Fallen Angel", "Custom Momentum v2")
   - Display it as a clickable badge or link
   - Clicking it filters the positions table to only show trades from that playbook or opens a quick preview of the playbook rules

2. Add Risk/Reward Ratio and Profit Factor summary cards
   - Place two new cards in the top summary row (next to Total Value, % Deployed, Unrealized P&L, etc.)
   - Risk/Reward Ratio: calculated as average win % / |average loss %| across closed positions
     - Also show dollar-weighted version in tooltip: total $ won / total $ risked
     - Label example: "2.3:1 (percentage) • $2.80 per $1 risked (dollar)"
   - Profit Factor: total winning P&L / |total losing P&L| across all closed positions
     - Add small interpretation label: "1.5–2.0 = good | >2.0 = excellent | <1.0 = losing"
   - Both computed client-side from already-fetched closed positions data

3. Add a Calendar view showing daily wins and losses
   - Add a new tab or collapsible section called "Calendar" (alongside Open / Closed positions tabs)
   - Show a monthly calendar grid (use date-fns for date math + simple CSS grid, no external calendar library)
   - Each day cell:
     - Green dot or background intensity for net positive days
     - Crimson for net negative
     - Amber for breakeven or very small net
     - Gray/no color for days with no closed trades
   - Size or opacity of the color reflects magnitude of daily net P&L
   - Add month navigation arrows and a time range selector (Last 30 days / 90 days / 1 year / All time)
   - Hover or click a day to show tooltip or popover with:
     - Net P&L for that day
     - List of trades closed that day

4. Add per-playbook performance breakdown
   - Add a collapsible section or card grid below the summary cards called "Playbook Performance"
   - One card per active playbook (fetched from strategies table, grouped by strategy_id on positions)
   - For each playbook show:
     - Win Rate (% profitable closed trades)
     - Net P&L (total $)
     - Profit Factor (wins / |losses|)
     - R:R Ratio (avg win % / |avg loss %|)
     - Expected Return per Trade = (win rate × avg win %) + ((1 - win rate) × avg loss %)
     - Trade Count (number of closed trades from this playbook)
     - Optional: Avg Holding Period (average days held)
   - Color-code each card by overall profitability (green = strong, amber = neutral, red = weak)
   - Clicking a playbook card filters the positions table to show only trades from that strategy

Technical details:
- Database: Already has strategy_id on positions table (or add it if missing)
- Calculations: all client-side from fetched positions data (open + closed)
- Use existing date-fns library for calendar math
- Keep dark terminal theme (charcoal, emerald green success, crimson danger, amber warnings, cyan-blue accents)
- Ensure mobile-responsive layout
- Default to paper trading mode
- Add plain-English tooltips or Gemini explanations when user asks (e.g. "what does Profit Factor mean?")

Prioritize clean layout:
1. Summary cards row (including new R:R and Profit Factor)
2. Active Positions table with Playbook column
3. Collapsible Playbook Performance section
4. Calendar tab or collapsible section

Make sure all new metrics are clearly labeled and easy to understand.
```