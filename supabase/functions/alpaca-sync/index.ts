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
    const ALPACA_API_KEY = Deno.env.get("ALPACA_API_KEY");
    const ALPACA_SECRET_KEY = Deno.env.get("ALPACA_SECRET_KEY");
    if (!ALPACA_API_KEY || !ALPACA_SECRET_KEY) {
      throw new Error("ALPACA_API_KEY or ALPACA_SECRET_KEY not configured");
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let body: { user_id?: string; action?: string } = {};
    try { body = await req.json(); } catch { /* cron call */ }

    // Get all users with open positions
    const { data: openPositions, error: posError } = await supabase
      .from("positions")
      .select("*")
      .eq("status", "open");

    if (posError) throw posError;
    if (!openPositions || openPositions.length === 0) {
      return jsonResponse({ success: true, synced: 0, message: "No open positions" });
    }

    // Group by user to determine trading mode
    const userIds = [...new Set(openPositions.map((p: any) => p.user_id))];
    let totalSynced = 0;

    for (const userId of userIds) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("trading_mode")
        .eq("id", userId)
        .single();

      const mode = profile?.trading_mode || "paper";
      const alpacaBaseUrl = mode === "live"
        ? "https://api.alpaca.markets/v2"
        : "https://paper-api.alpaca.markets/v2";

      const alpacaHeaders = {
        "APCA-API-KEY-ID": ALPACA_API_KEY,
        "APCA-API-SECRET-KEY": ALPACA_SECRET_KEY,
      };

      // 1. Sync recent order fills
      try {
        const ordersRes = await fetch(
          `${alpacaBaseUrl}/orders?status=all&limit=50&direction=desc`,
          { headers: alpacaHeaders }
        );
        const orders = await ordersRes.json();

        if (ordersRes.ok && Array.isArray(orders)) {
          for (const order of orders) {
            if (order.status === "filled" && order.filled_avg_price) {
              // Try to match to a position by symbol
              const symbol = (order.symbol || "").trim();
              const ticker = extractTickerFromOCC(symbol);

              if (ticker) {
                const userPositions = openPositions.filter(
                  (p: any) => p.user_id === userId && p.ticker === ticker
                );

                for (const pos of userPositions) {
                  // Update avg_cost if this was a buy fill and cost was 0 or placeholder
                  if (order.side === "buy" && (!pos.avg_cost || pos.avg_cost === 0)) {
                    await supabase
                      .from("positions")
                      .update({ avg_cost: Number(order.filled_avg_price) })
                      .eq("id", pos.id);
                  }
                }
              }
            }
          }
        }
      } catch (e) {
        console.error(`Order sync failed for user ${userId}:`, e);
      }

      // 2. Sync current positions/prices from Alpaca
      try {
        const positionsRes = await fetch(
          `${alpacaBaseUrl}/positions`,
          { headers: alpacaHeaders }
        );
        const alpacaPositions = await positionsRes.json();

        if (positionsRes.ok && Array.isArray(alpacaPositions)) {
          for (const ap of alpacaPositions) {
            const symbol = (ap.symbol || "").trim();
            const ticker = extractTickerFromOCC(symbol);
            if (!ticker) continue;

            const currentPrice = Number(ap.current_price) || 0;
            const marketValue = Number(ap.market_value) || 0;
            const costBasis = Number(ap.cost_basis) || 0;
            const unrealizedPl = Number(ap.unrealized_pl) || 0;
            const unrealizedPlPct = Number(ap.unrealized_plpc) * 100 || 0;

            // Match to DB positions
            const matchingPositions = openPositions.filter(
              (p: any) => p.user_id === userId && p.ticker === ticker
            );

            for (const pos of matchingPositions) {
              const updates: Record<string, any> = {
                current_price: currentPrice,
                pnl: unrealizedPl / (Number(ap.qty) || 1) * (pos.qty || 1),
                pnl_pct: Math.round(unrealizedPlPct * 100) / 100,
              };

              // Track highest P&L for trailing stop
              if (unrealizedPlPct > (pos.highest_pnl_pct || 0)) {
                updates.highest_pnl_pct = Math.round(unrealizedPlPct * 100) / 100;
              }

              // Check stop loss triggers
              const stopLoss = pos.stop_loss_pct || -35;
              if (unrealizedPlPct <= stopLoss) {
                updates.suggestion_type = "stop_loss";
                updates.suggestion = `⛔ STOP LOSS HIT: ${ticker} at ${unrealizedPlPct.toFixed(1)}% (limit: ${stopLoss}%)`;
              }

              // Check trailing stop
              if (pos.trailing_active && pos.trailing_stop_pct && pos.highest_pnl_pct) {
                const trailLevel = pos.highest_pnl_pct - pos.trailing_stop_pct;
                if (unrealizedPlPct <= trailLevel) {
                  updates.suggestion_type = "trailing_stop";
                  updates.suggestion = `📉 TRAILING STOP: ${ticker} dropped to ${unrealizedPlPct.toFixed(1)}% from peak ${pos.highest_pnl_pct.toFixed(1)}%`;
                }
              }

              await supabase
                .from("positions")
                .update(updates)
                .eq("id", pos.id);

              totalSynced++;
            }
          }
        }
      } catch (e) {
        console.error(`Position sync failed for user ${userId}:`, e);
      }
    }

    // Audit log
    if (totalSynced > 0) {
      for (const userId of userIds) {
        await supabase.from("audit_log").insert({
          user_id: userId,
          action_type: "ALPACA_SYNC",
          details: { positions_synced: totalSynced },
        });
      }
    }

    return jsonResponse({ success: true, synced: totalSynced });
  } catch (error) {
    console.error("Alpaca sync error:", error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Extract base ticker from OCC option symbol (e.g., "NVDA  280121C00130000" → "NVDA")
function extractTickerFromOCC(symbol: string): string | null {
  if (!symbol) return null;
  // OCC format: TICKER(padded to 6) + YYMMDD + C/P + strike*1000
  // If it looks like a plain equity symbol, return as-is
  if (symbol.length <= 6 && !symbol.includes(" ")) return symbol;
  // Extract ticker (first chars before date portion)
  const match = symbol.match(/^([A-Z]+)\s*/);
  return match ? match[1] : null;
}

function jsonResponse(data: any) {
  return new Response(JSON.stringify(data), {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      "Content-Type": "application/json",
    },
  });
}
