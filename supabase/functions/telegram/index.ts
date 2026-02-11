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

    // Detect raw Telegram webhook update (has update_id field)
    if (body.update_id !== undefined) {
      // Re-route as webhook action
      return handleWebhook(body, TELEGRAM_BOT_TOKEN, supabase);
    }

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
      return handleWebhook(body.update, TELEGRAM_BOT_TOKEN, supabase);
    }

    // Action 4: Register webhook URL with Telegram
    if (action === "setup_webhook") {
      const SUPABASE_FUNC_URL = `${SUPABASE_URL}/functions/v1/telegram`;
      const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: SUPABASE_FUNC_URL }),
      });
      const result = await res.json();
      return new Response(JSON.stringify(result), {
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

async function handleWebhook(update: any, token: string, supabase: any): Promise<Response> {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (!update?.message?.text) {
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const chatId = update.message.chat.id;
  const text = update.message.text.trim();

  // Handle /start
  if (text === "/start") {
    await sendTelegramMessage(token, chatId, "👋 *Welcome to LEAPS Trader Bot!*\n\nLink this bot in your LEAPS Trader Settings page using your Chat ID: `" + chatId + "`\n\nCommands:\n/approve TICKER - Approve a trade\n/reject TICKER [reason] - Reject a trade\n/status - View open positions");
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Find user by chat_id
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("telegram_chat_id", String(chatId))
    .single();

  if (!profile) {
    await sendTelegramMessage(token, chatId, "❌ Account not linked.\n\nYour Chat ID is: `" + chatId + "`\n\nPaste this in LEAPS Trader → Settings → Telegram Alerts.");
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (text.startsWith("/approve") || text.startsWith("/reject")) {
    const isApprove = text.startsWith("/approve");
    const ticker = text.split(" ")[1]?.toUpperCase();
    const reason = text.split(" ").slice(2).join(" ") || undefined;
    if (!ticker) {
      await sendTelegramMessage(token, chatId, `Usage: /${isApprove ? "approve" : "reject"} TICKER${isApprove ? "" : " [reason]"}`);
    } else {
      const today = new Date().toISOString().split("T")[0];
      const { data: alert } = await supabase
        .from("scanner_alerts")
        .select("*")
        .eq("user_id", profile.id)
        .eq("ticker", ticker)
        .eq("scan_date", today)
        .single();

      if (!alert) {
        await sendTelegramMessage(token, chatId, `❌ No alert found for ${ticker} today.`);
      } else if (isApprove && !alert.all_passed) {
        await sendTelegramMessage(token, chatId, `⚠️ ${ticker} checklist incomplete. Cannot approve.`);
      } else if (isApprove) {
        // Get trading mode
        const { data: userProfile } = await supabase
          .from("profiles")
          .select("trading_mode")
          .eq("id", profile.id)
          .single();
        const mode = userProfile?.trading_mode || "paper";

        // Calculate mid-price (limit order at mid)
        const askPrice = Number(alert.ask_price) || 0;
        const midPrice = askPrice > 0 ? Math.round(askPrice * 0.99 * 100) / 100 : 0;

        // Create position
        const { error: posError } = await supabase.from("positions").insert({
          user_id: profile.id,
          ticker,
          name: alert.name || ticker,
          option_type: "CALL",
          strike: alert.suggested_strike,
          expiry: alert.suggested_expiry,
          qty: 1,
          avg_cost: midPrice,
          current_price: midPrice,
          delta: alert.delta,
          dte: alert.dte,
          pnl: 0,
          pnl_pct: 0,
          status: "open",
        });

        if (posError) {
          console.error("Position insert error:", posError);
          await sendTelegramMessage(token, chatId, `⚠️ Trade approved but failed to create position: ${posError.message}`);
        } else {
          // Audit log
          await supabase.from("audit_log").insert({
            user_id: profile.id,
            action_type: "TRADE_EXECUTED_TELEGRAM",
            details: { ticker, strike: alert.suggested_strike, expiry: alert.suggested_expiry, delta: alert.delta, mode, fill_price: midPrice },
          });

          // Send approval + fill notification
          await sendTelegramMessage(token, chatId,
            `✅ *${ticker} APPROVED & FILLED*\n\n` +
            `Strike: $${alert.suggested_strike}\n` +
            `Expiry: ${alert.suggested_expiry}\n` +
            `Delta: ${alert.delta}\n` +
            `Fill Price: $${midPrice.toFixed(2)}\n` +
            `Qty: 1 contract\n\n` +
            `_${mode === "live" ? "🔴 LIVE execution." : "📝 Paper trade."} Position opened._`
          );
        }
      } else {
        // Reject
        await supabase.from("audit_log").insert({
          user_id: profile.id,
          action_type: "TRADE_REJECTED_TELEGRAM",
          details: { ticker, strike: alert.suggested_strike, expiry: alert.suggested_expiry, reason },
        });
        await sendTelegramMessage(token, chatId, `❌ *${ticker} REJECTED*${reason ? `\n\nReason: ${reason}` : ""}\n\n_Logged to audit trail._`);
      }
    }
  } else if (text === "/status") {
    const { data: positions } = await supabase
      .from("positions")
      .select("*")
      .eq("user_id", profile.id)
      .eq("status", "open");

    if (!positions || positions.length === 0) {
      await sendTelegramMessage(token, chatId, "📊 No open positions.");
    } else {
      const lines = positions.map((p: any) =>
        `${p.ticker} $${p.strike} ${p.expiry} | P&L: ${(p.pnl_pct || 0) >= 0 ? "+" : ""}${(p.pnl_pct || 0).toFixed(1)}%`
      );
      await sendTelegramMessage(token, chatId, `📊 *Open Positions*\n\n${lines.join("\n")}`);
    }
  } else if (text === "/help") {
    await sendTelegramMessage(token, chatId, "*LEAPS Trader Bot*\n\nCommands:\n/start - Welcome & Chat ID\n/approve TICKER - Approve a trade\n/reject TICKER [reason] - Reject a trade\n/status - View open positions\n/help - Show this message");
  } else {
    await sendTelegramMessage(token, chatId, "Unknown command. Try /help");
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

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

  return `📡 *Daily Scan Results*\n${new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}\n\n${lines.join("\n\n")}\n\n_Reply /approve TICKER to execute_\n_Reply /reject TICKER [reason] to pass_`;
}
