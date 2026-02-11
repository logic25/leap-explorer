import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const POLYGON_API_KEY = Deno.env.get("POLYGON_API_KEY");
    if (!POLYGON_API_KEY) throw new Error("POLYGON_API_KEY not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch all open positions across all users
    const { data: positions, error: posError } = await supabase
      .from("positions")
      .select("*")
      .eq("status", "open");

    if (posError) throw posError;
    if (!positions || positions.length === 0) {
      return new Response(JSON.stringify({ success: true, checked: 0, rolls_suggested: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let rollsSuggested = 0;

    for (const pos of positions) {
      const pnlPct = pos.pnl_pct || 0;
      const delta = pos.delta || 0;
      const dte = pos.dte || 0;

      // Evaluate roll conditions
      const standardRoll = pnlPct >= 100 && delta > 0.80 && dte > 180;
      const turboRoll = pnlPct >= 150 && delta > 0.85;
      const lowDte = dte > 0 && dte < 180;

      let rollStatus: string | null = null;
      let suggestion = "";

      if (turboRoll) {
        rollStatus = "ready_to_roll";
        suggestion = `🚀 TURBO ROLL: ${pos.ticker} up ${pnlPct.toFixed(0)}%, delta ${delta.toFixed(2)}. Roll to higher strike at 0.55-0.65 delta.`;
      } else if (standardRoll) {
        rollStatus = "ready_to_roll";
        suggestion = `🔄 ROLL UP: ${pos.ticker} up ${pnlPct.toFixed(0)}%, delta ${delta.toFixed(2)}, ${dte} DTE. Roll to higher strike at 0.55-0.65 delta.`;
      } else if (lowDte && pnlPct > 0) {
        rollStatus = "exit_suggested";
        suggestion = `⏰ LOW DTE: ${pos.ticker} has ${dte} DTE remaining with +${pnlPct.toFixed(0)}% gain. Consider exiting — not enough time for a roll.`;
      } else if (lowDte && pnlPct <= 0) {
        rollStatus = "exit_suggested";
        suggestion = `⚠️ LOW DTE: ${pos.ticker} has ${dte} DTE with ${pnlPct.toFixed(0)}% P&L. Consider cutting losses.`;
      }

      // Update position roll_status
      if (rollStatus) {
        await supabase
          .from("positions")
          .update({ roll_status: rollStatus, suggestion })
          .eq("id", pos.id);

        // Try to find next contract via Polygon
        let nextContractInfo = "";
        if (rollStatus === "ready_to_roll") {
          try {
            nextContractInfo = await findNextContract(POLYGON_API_KEY, pos);
          } catch (e) {
            console.error(`Failed to find next contract for ${pos.ticker}:`, e);
            nextContractInfo = "Could not find suitable next contract. Consider holding or redeploying to an anchor position (e.g., MSFT at 0.40-0.50 delta).";
          }
        }

        // Send Telegram alert
        try {
          const telegramUrl = `${SUPABASE_URL}/functions/v1/telegram`;
          const { data: profile } = await supabase
            .from("profiles")
            .select("telegram_chat_id")
            .eq("id", pos.user_id)
            .single();

          if (profile?.telegram_chat_id) {
            const message = formatRollMessage(pos, rollStatus, suggestion, nextContractInfo);
            await fetch(telegramUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
              },
              body: JSON.stringify({
                action: "send_alerts",
                alerts: [{
                  user_id: pos.user_id,
                  _raw_message: message,
                }],
              }),
            });
          }
        } catch (e) {
          console.error(`Telegram alert failed for ${pos.ticker}:`, e);
        }

        // Audit log
        await supabase.from("audit_log").insert({
          user_id: pos.user_id,
          action_type: rollStatus === "ready_to_roll" ? "ROLL_SUGGESTED" : "EXIT_SUGGESTED",
          details: {
            ticker: pos.ticker,
            pnl_pct: pnlPct,
            delta,
            dte,
            roll_status: rollStatus,
          },
        });

        rollsSuggested++;
      } else {
        // Clear any previous roll status
        if (pos.roll_status) {
          await supabase
            .from("positions")
            .update({ roll_status: null })
            .eq("id", pos.id);
        }
      }

      // Rate limit for Polygon calls
      await sleep(13000);
    }

    return new Response(
      JSON.stringify({ success: true, checked: positions.length, rolls_suggested: rollsSuggested }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Check-rolls error:", error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function findNextContract(apiKey: string, pos: any): Promise<string> {
  const price = pos.current_price || pos.avg_cost || 0;
  const currentStrike = pos.strike || 0;

  // Look for strikes above current
  const strikeMin = Math.round(currentStrike * 1.05);
  const strikeMax = Math.round(currentStrike * 1.40);
  const expGte = "2027-12-01";
  const expLte = "2028-06-30";

  const url = `https://api.polygon.io/v3/reference/options/contracts?underlying_ticker=${pos.ticker}&contract_type=call&expiration_date.gte=${expGte}&expiration_date.lte=${expLte}&strike_price.gte=${strikeMin}&strike_price.lte=${strikeMax}&limit=20&apiKey=${apiKey}`;
  const res = await fetch(url);
  const data = await res.json();

  if (!data.results || data.results.length === 0) {
    return "No suitable contracts found above current strike.";
  }

  // Estimate delta for each and find 0.55-0.65 range
  const ticker = pos.ticker;
  const stockPrice = pos.current_price || pos.avg_cost || currentStrike;
  const candidates = data.results
    .map((c: any) => {
      const dte = Math.round((new Date(c.expiration_date).getTime() - Date.now()) / (86400000));
      const moneyness = stockPrice / c.strike_price;
      const delta = estimateDelta(moneyness, dte);
      return { ...c, dte, estDelta: delta };
    })
    .filter((c: any) => c.estDelta >= 0.50 && c.estDelta <= 0.70)
    .sort((a: any, b: any) => Math.abs(a.estDelta - 0.60) - Math.abs(b.estDelta - 0.60));

  if (candidates.length === 0) {
    return "No contracts found in 0.55-0.65 delta range.";
  }

  const best = candidates[0];
  const pocketPct = ((price - (price * 0.6)) / price * 100).toFixed(0);

  return `Suggested: $${best.strike_price} strike, ${best.expiration_date}, est. delta ${best.estDelta.toFixed(2)}, ${best.dte} DTE.`;
}

function estimateDelta(moneyness: number, dte: number): number {
  if (dte <= 0) return moneyness > 1 ? 1 : 0;
  const t = dte / 365;
  const vol = 0.30;
  const d1 = (Math.log(moneyness) + 0.5 * vol * vol * t) / (vol * Math.sqrt(t));
  return cdf(d1);
}

function cdf(x: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1.0 + sign * y);
}

function formatRollMessage(pos: any, status: string, suggestion: string, nextContract: string): string {
  const pnlPct = (pos.pnl_pct || 0).toFixed(0);
  const pnl = (pos.pnl || 0).toFixed(0);

  if (status === "ready_to_roll") {
    return (
      `🔄 *ROLL SUGGESTION — ${pos.ticker}*\n\n` +
      `Current: $${pos.strike} | ${pos.expiry}\n` +
      `P&L: +${pnlPct}% (+$${pnl})\n` +
      `Delta: ${(pos.delta || 0).toFixed(2)} | DTE: ${pos.dte}\n\n` +
      `${nextContract}\n\n` +
      `Reply:\n` +
      `_/approve ${pos.ticker} — to execute_\n` +
      `_/reject ${pos.ticker} — to pass_`
    );
  }

  return (
    `⏰ *EXIT SUGGESTION — ${pos.ticker}*\n\n` +
    `${suggestion}\n\n` +
    `Current: $${pos.strike} | ${pos.expiry}\n` +
    `P&L: ${pnlPct}% ($${pnl})\n` +
    `DTE: ${pos.dte}`
  );
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
