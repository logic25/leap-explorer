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
    const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!TELEGRAM_BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json();
    const { action, user_id, chat_id, alerts } = body;

    // Action 1: Link Telegram account by saving chat_id
    if (action === "link") {
      if (!user_id || !chat_id) {
        return new Response(JSON.stringify({ error: "user_id and chat_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error } = await supabase
        .from("profiles")
        .update({ telegram_chat_id: String(chat_id) })
        .eq("id", user_id);

      if (error) throw error;

      // Send welcome message
      await sendTelegramMessage(
        TELEGRAM_BOT_TOKEN,
        chat_id,
        "✅ *LEAPS Trader Connected!*\n\nYou'll receive daily scan alerts at 4:15 PM EST.\n\nReply with /status to check your positions.",
      );

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action 2: Send alerts to all linked users
    if (action === "send_alerts") {
      const alertsToSend = alerts || [];
      if (alertsToSend.length === 0) {
        return new Response(JSON.stringify({ success: true, sent: 0 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Group alerts by user
      const userAlerts: Record<string, any[]> = {};
      for (const alert of alertsToSend) {
        if (!userAlerts[alert.user_id]) userAlerts[alert.user_id] = [];
        userAlerts[alert.user_id].push(alert);
      }

      let sent = 0;
      for (const [userId, userAlertList] of Object.entries(userAlerts)) {
        // Get user's telegram chat_id
        const { data: profile } = await supabase
          .from("profiles")
          .select("telegram_chat_id")
          .eq("id", userId)
          .single();

        if (!profile?.telegram_chat_id) continue;

        const message = formatAlertMessage(userAlertList);
        await sendTelegramMessage(TELEGRAM_BOT_TOKEN, profile.telegram_chat_id, message);
        sent++;
      }

      return new Response(JSON.stringify({ success: true, sent }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action 3: Handle Telegram webhook (reply-to-approve)
    if (action === "webhook") {
      const update = body.update;
      if (!update?.message?.text) {
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const chatId = update.message.chat.id;
      const text = update.message.text.trim();

      // Find user by chat_id
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("telegram_chat_id", String(chatId))
        .single();

      if (!profile) {
        await sendTelegramMessage(TELEGRAM_BOT_TOKEN, chatId, "❌ Account not linked. Please link your Telegram in LEAPS Trader settings.");
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Handle approve command: /approve TICKER
      if (text.startsWith("/approve")) {
        const ticker = text.split(" ")[1]?.toUpperCase();
        if (!ticker) {
          await sendTelegramMessage(TELEGRAM_BOT_TOKEN, chatId, "Usage: /approve TICKER (e.g., /approve NVDA)");
        } else {
          // Find today's alert for this ticker
          const today = new Date().toISOString().split("T")[0];
          const { data: alert } = await supabase
            .from("scanner_alerts")
            .select("*")
            .eq("user_id", profile.id)
            .eq("ticker", ticker)
            .eq("scan_date", today)
            .single();

          if (!alert) {
            await sendTelegramMessage(TELEGRAM_BOT_TOKEN, chatId, `❌ No alert found for ${ticker} today.`);
          } else if (!alert.all_passed) {
            await sendTelegramMessage(TELEGRAM_BOT_TOKEN, chatId, `⚠️ ${ticker} checklist incomplete (${(alert.checklist as any[]).filter((c: any) => c.passed).length}/${(alert.checklist as any[]).length}). Cannot approve.`);
          } else {
            // Log approval in audit
            await supabase.from("audit_log").insert({
              user_id: profile.id,
              action_type: "TRADE_APPROVED_TELEGRAM",
              details: {
                ticker,
                strike: alert.suggested_strike,
                expiry: alert.suggested_expiry,
                delta: alert.delta,
              },
            });

            await sendTelegramMessage(
              TELEGRAM_BOT_TOKEN,
              chatId,
              `✅ *${ticker} APPROVED*\n\nStrike: $${alert.suggested_strike}\nExpiry: ${alert.suggested_expiry}\nDelta: ${alert.delta}\n\n_Trade logged. Paper mode - no execution._`,
            );
          }
        }
      } else if (text === "/status") {
        const { data: positions } = await supabase
          .from("positions")
          .select("*")
          .eq("user_id", profile.id)
          .eq("status", "open");

        if (!positions || positions.length === 0) {
          await sendTelegramMessage(TELEGRAM_BOT_TOKEN, chatId, "📊 No open positions.");
        } else {
          const lines = positions.map((p: any) =>
            `${p.ticker} $${p.strike} ${p.expiry} | P&L: ${(p.pnl_pct || 0) >= 0 ? "+" : ""}${(p.pnl_pct || 0).toFixed(1)}%`
          );
          await sendTelegramMessage(TELEGRAM_BOT_TOKEN, chatId, `📊 *Open Positions*\n\n${lines.join("\n")}`);
        }
      } else {
        await sendTelegramMessage(
          TELEGRAM_BOT_TOKEN,
          chatId,
          "Commands:\n/approve TICKER - Approve a trade\n/status - View open positions",
        );
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Telegram error:", error);
    return new Response(JSON.stringify({ success: false, error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function sendTelegramMessage(token: string, chatId: string | number, text: string) {
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "Markdown",
    }),
  });
  const data = await res.json();
  if (!data.ok) {
    console.error("Telegram send failed:", data);
  }
  return data;
}

function formatAlertMessage(alerts: any[]): string {
  const lines = alerts.map((a) => {
    const checkPassed = (a.checklist as any[])?.filter((c: any) => c.passed).length || 0;
    const checkTotal = (a.checklist as any[])?.length || 12;
    const emoji = a.scanner_type === "Value Zone" ? "🔵" : a.scanner_type === "MegaRun" ? "🟢" : "🟡";
    return `${emoji} *${a.ticker}* — ${a.scanner_type}\n   $${a.price} | RSI ${a.rsi} | Δ${a.delta || "?"} | ${checkPassed}/${checkTotal} ✓\n   Strike: $${a.suggested_strike || "?"} | ${a.suggested_expiry || "?"}`;
  });

  return `📡 *Daily Scan Results*\n${new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}\n\n${lines.join("\n\n")}\n\n_Reply /approve TICKER to execute_`;
}
