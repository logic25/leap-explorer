import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-user-token, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BASE_SYSTEM_PROMPT = `You are a LEAPS options trading assistant. You help users with their systematic LEAPS call trading strategy.

You know about:
- Three scanner types: Value Zone (MA/RSI/Volume), MegaRun (ATR compression), Fallen Angel (drawdown/consolidation)
- Market regime: GREEN (SPY>50/200 MA, VIX<20), YELLOW (SPY<50 but >200, VIX 20-30), RED (SPY<200, VIX>30)
- Entry checklist: Scanner confirmation, weekly chart, option chain metrics (delta, DTE, OI, bid-ask, IV), portfolio sizing, earnings check
- Portfolio rules: Roll up at delta>0.80/gain>100%, warn at DTE<90, suggest exit at -30-40% loss, no averaging down
- LEAPS targets: Jan 2028+, delta 0.50-0.65 (Value/Mega), 0.40-0.55 (Fallen Angel), DTE 700-900+

Always be clear and concise. Use real data when available. If you don't have data, say so.
Format metrics clearly: win rate, Sharpe ratio, CAGR, max drawdown.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Try to get user context from auth token
    let userContext = "";
    const userToken = req.headers.get("x-user-token");
    if (userToken) {
      try {
        const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        // Decode user from token
        const { data: { user } } = await supabase.auth.getUser(userToken);
        if (user) {
          // Fetch positions, goals, recent alerts in parallel
          const [posRes, goalRes, alertRes, stratRes] = await Promise.all([
            supabase.from("positions").select("ticker, strike, expiry, pnl, pnl_pct, delta, dte, status, roll_status, strategy_id").eq("user_id", user.id).eq("status", "open"),
            supabase.from("wealth_goals").select("*").eq("user_id", user.id).maybeSingle(),
            supabase.from("scanner_alerts").select("ticker, scanner_type, all_passed, confluence_score, price, rsi, delta").eq("user_id", user.id).order("created_at", { ascending: false }).limit(10),
            supabase.from("strategies").select("name, scanner_type, enabled").eq("user_id", user.id),
          ]);

          const positions = posRes.data || [];
          const goal = goalRes.data;
          const alerts = alertRes.data || [];
          const strategies = stratRes.data || [];

          const openPnl = positions.reduce((s: number, p: any) => s + (p.pnl || 0), 0);
          const rollReady = positions.filter((p: any) => p.roll_status === "ready_to_roll");

          userContext = `\n\n--- USER CONTEXT (live data) ---`;
          userContext += `\nOpen positions (${positions.length}):`;
          positions.forEach((p: any) => {
            userContext += `\n  ${p.ticker} $${p.strike} ${p.expiry} | P&L: ${(p.pnl_pct || 0).toFixed(1)}% ($${(p.pnl || 0).toFixed(0)}) | Δ${(p.delta || 0).toFixed(2)} | ${p.dte} DTE${p.roll_status ? ` | ${p.roll_status}` : ''}`;
          });
          userContext += `\nTotal open P&L: $${openPnl.toFixed(0)}`;

          if (rollReady.length > 0) {
            userContext += `\n\n🔄 Roll candidates: ${rollReady.map((p: any) => p.ticker).join(', ')}`;
          }

          if (goal) {
            const totalClosedPnl = 0; // Would need closed positions query
            const currentValue = Number(goal.starting_capital) + totalClosedPnl;
            const requiredCagr = (Math.pow(Number(goal.target_value) / Number(goal.starting_capital), 1 / goal.time_horizon_years) - 1) * 100;
            userContext += `\n\nWealth Goal: $${Number(goal.starting_capital).toLocaleString()} → $${Number(goal.target_value).toLocaleString()} in ${goal.time_horizon_years}yr (${requiredCagr.toFixed(1)}% CAGR needed)`;
          }

          if (alerts.length > 0) {
            userContext += `\n\nRecent scan alerts:`;
            alerts.forEach((a: any) => {
              userContext += `\n  ${a.ticker} (${a.scanner_type}) | ${a.all_passed ? '✓ ALL PASSED' : '✗ partial'} | Score: ${a.confluence_score || '?'} | RSI ${a.rsi}`;
            });
          }

          if (strategies.length > 0) {
            userContext += `\n\nStrategies: ${strategies.map((s: any) => `${s.name} (${s.scanner_type}, ${s.enabled ? 'ON' : 'OFF'})`).join(', ')}`;
          }
          userContext += `\n--- END CONTEXT ---`;
        }
      } catch (e) {
        console.error("Failed to fetch user context:", e);
      }
    }

    const systemPrompt = BASE_SYSTEM_PROMPT + userContext;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            ...messages,
          ],
          stream: true,
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits in workspace settings." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(
        JSON.stringify({ error: "AI gateway error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
