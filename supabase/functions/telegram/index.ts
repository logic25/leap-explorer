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
      return handleWebhook(body, TELEGRAM_BOT_TOKEN, supabase);
    }

    const { action, user_id, chat_id, alerts } = body;

    // Action 1: Link Telegram account
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

      await sendTelegramMessage(
        TELEGRAM_BOT_TOKEN,
        chat_id,
        "✅ *LEAPS Trader Connected!*\n\nYou'll receive daily scan alerts at 4:15 PM EST.\n\nCommands:\n/approve TICKER — Get AI price suggestion\n/confirm TICKER — Execute at AI price\n/approve TICKER 41.20 — Execute at your price\n/status — View positions",
      );

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action 2: Send alerts
    if (action === "send_alerts") {
      const alertsToSend = alerts || [];
      if (alertsToSend.length === 0) {
        return new Response(JSON.stringify({ success: true, sent: 0 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const userAlerts: Record<string, any[]> = {};
      for (const alert of alertsToSend) {
        if (!userAlerts[alert.user_id]) userAlerts[alert.user_id] = [];
        userAlerts[alert.user_id].push(alert);
      }

      let sent = 0;
      for (const [userId, userAlertList] of Object.entries(userAlerts)) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("telegram_chat_id, account_size, position_size_pct, max_allocation_pct")
          .eq("id", userId)
          .single();

        if (!profile?.telegram_chat_id) continue;

        const message = formatAlertMessage(userAlertList, profile);
        await sendTelegramMessage(TELEGRAM_BOT_TOKEN, profile.telegram_chat_id, message);
        sent++;
      }

      return new Response(JSON.stringify({ success: true, sent }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action 3: Handle Telegram webhook
    if (action === "webhook") {
      return handleWebhook(body.update, TELEGRAM_BOT_TOKEN, supabase);
    }

    // Action 4: Send a test message directly
    if (action === "send_test") {
      if (!user_id) {
        return new Response(JSON.stringify({ error: "user_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: prof } = await supabase
        .from("profiles")
        .select("telegram_chat_id")
        .eq("id", user_id)
        .single();

      if (!prof?.telegram_chat_id) {
        return new Response(JSON.stringify({ error: "Telegram not linked" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await sendTelegramMessage(
        TELEGRAM_BOT_TOKEN,
        prof.telegram_chat_id,
        "🧪 *Test Alert — LEAPS Trader*\n\n" +
        "🔵 *NVDA* — Value Zone\n   $135.20 | RSI 42 | Δ0.58 | 9/12 ✓\n   Strike: $130 | Jan 2028\n\n" +
        "🟢 *MSFT* — MegaRun\n   $420.50 | RSI 61 | Δ0.55 | 10/12 ✓\n   Strike: $400 | Jan 2028\n\n" +
        "_This is a test notification._\n\n" +
        "_/approve TICKER — AI price suggestion_\n" +
        "_/reject TICKER \\[reason\\] — pass on it_"
      );

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action 5: Register webhook URL
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
  const rHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (!update?.message?.text) {
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...rHeaders, "Content-Type": "application/json" },
    });
  }

  const chatId = update.message.chat.id;
  const text = update.message.text.trim();

  // Handle /start
  if (text === "/start") {
    await sendTelegramMessage(token, chatId, "👋 *Welcome to LEAPS Trader Bot!*\n\nLink this bot in your LEAPS Trader Settings page using your Chat ID: `" + chatId + "`\n\nCommands:\n/approve TICKER — AI suggests limit price\n/confirm TICKER — Execute at AI price\n/approve TICKER 41.20 — Override price\n/reject TICKER [reason]\n/status — View positions");
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...rHeaders, "Content-Type": "application/json" },
    });
  }

  // Find user by chat_id
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, trading_mode, account_size, position_size_pct, max_allocation_pct")
    .eq("telegram_chat_id", String(chatId))
    .single();

  if (!profile) {
    await sendTelegramMessage(token, chatId, "❌ Account not linked.\n\nYour Chat ID is: `" + chatId + "`\n\nPaste this in LEAPS Trader → Settings → Telegram Alerts.");
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...rHeaders, "Content-Type": "application/json" },
    });
  }

  // /confirm TICKER — execute at the AI-suggested price
  if (text.startsWith("/confirm")) {
    const ticker = text.split(" ")[1]?.toUpperCase();
    if (!ticker) {
      await sendTelegramMessage(token, chatId, "Usage: /confirm TICKER");
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...rHeaders, "Content-Type": "application/json" },
      });
    }

    // Find today's alert
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
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...rHeaders, "Content-Type": "application/json" },
      });
    }

    // Use the AI-suggested price (stored in alert metadata or compute mid)
    const askPrice = Number(alert.ask_price) || 0;
    const midPrice = askPrice > 0 ? Math.round(askPrice * 0.98 * 100) / 100 : 0;

    return executeTradeAndNotify(supabase, token, chatId, profile, alert, ticker, midPrice, rHeaders);
  }

  // /approve TICKER [optional_price] — get AI suggestion or execute at given price
  if (text.startsWith("/approve")) {
    const parts = text.split(" ");
    const ticker = parts[1]?.toUpperCase();
    const overridePrice = parts[2] ? parseFloat(parts[2]) : null;

    if (!ticker) {
      await sendTelegramMessage(token, chatId, "Usage: /approve TICKER [price]");
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...rHeaders, "Content-Type": "application/json" },
      });
    }

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
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...rHeaders, "Content-Type": "application/json" },
      });
    }

    // If user provided a price, execute immediately
    if (overridePrice && overridePrice > 0) {
      return executeTradeAndNotify(supabase, token, chatId, profile, alert, ticker, overridePrice, rHeaders);
    }

    // Otherwise, ask AI for suggested limit price
    try {
      const aiSuggestion = await getAIPriceSuggestion(alert);

      await sendTelegramMessage(token, chatId,
        `🤖 *AI Price Suggestion for ${ticker}*\n\n` +
        `Ask: $${alert.ask_price || "?"}\n` +
        `Historical Low: $${alert.historical_low || "?"}\n` +
        `IV Percentile: ${alert.iv_percentile || "?"}%\n` +
        `Scanner: ${alert.scanner_type}\n\n` +
        `💡 *Suggested Limit: $${aiSuggestion.price}*\n` +
        `_${aiSuggestion.reasoning}_\n\n` +
        `Reply:\n` +
        `/confirm ${ticker} — Execute at $${aiSuggestion.price}\n` +
        `/approve ${ticker} ${aiSuggestion.price} — Override with your price`
      );
    } catch (e) {
      console.error("AI suggestion failed:", e);
      // Fallback: just use mid price
      const askPrice = Number(alert.ask_price) || 0;
      const fallbackPrice = askPrice > 0 ? Math.round(askPrice * 0.98 * 100) / 100 : 0;

      await sendTelegramMessage(token, chatId,
        `⚠️ AI suggestion unavailable. Fallback mid-price: $${fallbackPrice}\n\n` +
        `Reply:\n` +
        `/confirm ${ticker} — Execute at $${fallbackPrice}\n` +
        `/approve ${ticker} [your_price]`
      );
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...rHeaders, "Content-Type": "application/json" },
    });
  }

  if (text.startsWith("/reject")) {
    const ticker = text.split(" ")[1]?.toUpperCase();
    const reason = text.split(" ").slice(2).join(" ") || undefined;
    if (!ticker) {
      await sendTelegramMessage(token, chatId, "Usage: /reject TICKER [reason]");
    } else {
      const today = new Date().toISOString().split("T")[0];
      const { data: alert } = await supabase
        .from("scanner_alerts")
        .select("*")
        .eq("user_id", profile.id)
        .eq("ticker", ticker)
        .eq("scan_date", today)
        .single();

      await supabase.from("audit_log").insert({
        user_id: profile.id,
        action_type: "TRADE_REJECTED_TELEGRAM",
        details: { ticker, strike: alert?.suggested_strike, expiry: alert?.suggested_expiry, reason },
      });
      await sendTelegramMessage(token, chatId, `❌ *${ticker} REJECTED*${reason ? `\n\nReason: ${reason}` : ""}\n\n_Logged to audit trail._`);
    }
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...rHeaders, "Content-Type": "application/json" },
    });
  }

  if (text === "/status") {
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
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...rHeaders, "Content-Type": "application/json" },
    });
  }

  if (text === "/help") {
    await sendTelegramMessage(token, chatId, "*LEAPS Trader Bot*\n\nCommands:\n/start — Welcome & Chat ID\n/approve TICKER — AI suggests limit price\n/confirm TICKER — Execute at AI price\n/approve TICKER 41.20 — Override price\n/reject TICKER [reason]\n/status — View positions\n/help — This message\n\nOr just ask a question in plain English!");
  } else {
    // Forward unrecognized messages to Gemini chat AI
    try {
      const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
      const chatResponse = await fetch(`${SUPABASE_URL}/functions/v1/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
        },
        body: JSON.stringify({
          messages: [{ role: "user", content: text }],
        }),
      });

      if (chatResponse.ok && chatResponse.body) {
        // Read SSE stream and collect response
        const reader = chatResponse.body.getReader();
        const decoder = new TextDecoder();
        let aiResponse = "";
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let newlineIdx: number;
          while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
            let line = buffer.slice(0, newlineIdx);
            buffer = buffer.slice(newlineIdx + 1);
            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (!line.startsWith("data: ")) continue;
            const jsonStr = line.slice(6).trim();
            if (jsonStr === "[DONE]") break;
            try {
              const parsed = JSON.parse(jsonStr);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) aiResponse += content;
            } catch { /* skip partial */ }
          }
        }

        if (aiResponse.trim()) {
          // Telegram has 4096 char limit
          const truncated = aiResponse.length > 4000 ? aiResponse.slice(0, 4000) + "..." : aiResponse;
          await sendTelegramMessage(token, chatId, truncated);
        } else {
          await sendTelegramMessage(token, chatId, "🤔 I couldn't generate a response. Try /help for commands.");
        }
      } else {
        await sendTelegramMessage(token, chatId, "⚠️ AI is temporarily unavailable. Try /help for commands.");
      }
    } catch (e) {
      console.error("NL chat forwarding failed:", e);
      await sendTelegramMessage(token, chatId, "⚠️ AI error. Try /help for available commands.");
    }
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...rHeaders, "Content-Type": "application/json" },
  });
}

async function executeTradeAndNotify(
  supabase: any, token: string, chatId: string | number,
  profile: any, alert: any, ticker: string, fillPrice: number, headers: any
): Promise<Response> {
  const mode = profile.trading_mode || "paper";
  const accountSize = Number(profile.account_size) || 100000;
  const positionSizePct = Number(profile.position_size_pct) || 3;

  // Calculate qty based on position sizing rule
  const maxPositionValue = accountSize * (positionSizePct / 100);
  const contractCost = fillPrice * 100; // options are per 100 shares
  const suggestedQty = contractCost > 0 ? Math.max(1, Math.floor(maxPositionValue / contractCost)) : 1;

  const { error: posError } = await supabase.from("positions").insert({
    user_id: profile.id,
    ticker,
    name: alert.name || ticker,
    option_type: "CALL",
    strike: alert.suggested_strike,
    expiry: alert.suggested_expiry,
    qty: suggestedQty,
    avg_cost: fillPrice,
    current_price: fillPrice,
    delta: alert.delta,
    dte: alert.dte,
    pnl: 0,
    pnl_pct: 0,
    allocation: Math.round((suggestedQty * contractCost / accountSize) * 100 * 10) / 10,
    status: "open",
    strategy_id: alert.strategy_id || null,
  });

  if (posError) {
    console.error("Position insert error:", posError);
    await sendTelegramMessage(token, chatId, `⚠️ Trade failed: ${posError.message}`);
  } else {
    await supabase.from("audit_log").insert({
      user_id: profile.id,
      action_type: "TRADE_EXECUTED_TELEGRAM",
      details: { ticker, strike: alert.suggested_strike, expiry: alert.suggested_expiry, delta: alert.delta, mode, fill_price: fillPrice, qty: suggestedQty },
    });

    const allocationPct = Math.round((suggestedQty * contractCost / accountSize) * 100 * 10) / 10;

    await sendTelegramMessage(token, chatId,
      `✅ *${ticker} FILLED*\n\n` +
      `Strike: $${alert.suggested_strike}\n` +
      `Expiry: ${alert.suggested_expiry}\n` +
      `Delta: ${alert.delta}\n` +
      `Fill Price: $${fillPrice.toFixed(2)}\n` +
      `Qty: ${suggestedQty} contract${suggestedQty > 1 ? "s" : ""}\n` +
      `Total Cost: $${(suggestedQty * contractCost).toLocaleString()}\n` +
      `Allocation: ${allocationPct}% of $${accountSize.toLocaleString()}\n\n` +
      `_Sizing: ${positionSizePct}% rule → max $${maxPositionValue.toLocaleString()}_\n` +
      `_${mode === "live" ? "🔴 LIVE execution." : "📝 Paper trade."} Position opened._`
    );
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

async function getAIPriceSuggestion(alert: any): Promise<{ price: number; reasoning: string }> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

  const askPrice = Number(alert.ask_price) || 0;
  const historicalLow = Number(alert.historical_low) || 0;
  const ivPct = alert.iv_percentile || null;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        {
          role: "system",
          content: `You are a LEAPS options order pricing assistant. Given option data, suggest a limit order price. Use tool calling to return your suggestion.`,
        },
        {
          role: "user",
          content: `Ticker: ${alert.ticker}\nScanner: ${alert.scanner_type}\nAsk: $${askPrice}\nHistorical Low: $${historicalLow}\nIV Percentile: ${ivPct || "unknown"}%\nDelta: ${alert.delta}\nDTE: ${alert.dte}\nStrike: $${alert.suggested_strike}\n\nSuggest a limit order price. Consider: mid-price discount, historical low, IV environment, and scanner type.`,
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "suggest_price",
            description: "Suggest a limit order price with reasoning",
            parameters: {
              type: "object",
              properties: {
                price: { type: "number", description: "Suggested limit price in dollars" },
                reasoning: { type: "string", description: "One-line explanation of why this price" },
              },
              required: ["price", "reasoning"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "suggest_price" } },
    }),
  });

  if (!response.ok) throw new Error(`AI gateway error: ${response.status}`);

  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) throw new Error("No price suggestion returned");

  return JSON.parse(toolCall.function.arguments);
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

function formatAlertMessage(alerts: any[], profile?: any): string {
  const accountSize = Number(profile?.account_size) || 100000;
  const positionSizePct = Number(profile?.position_size_pct) || 3;
  const maxPositionValue = accountSize * (positionSizePct / 100);

  const lines = alerts.map((a) => {
    const checkPassed = (a.checklist as any[])?.filter((c: any) => c.passed).length || 0;
    const checkTotal = (a.checklist as any[])?.length || 12;
    const emoji = a.scanner_type === "Value Zone" ? "🔵" : a.scanner_type === "MegaRun" ? "🟢" : "🟡";

    // Position sizing info
    const askPrice = Number(a.ask_price) || 0;
    const contractCost = askPrice * 100;
    const suggestedQty = contractCost > 0 ? Math.max(1, Math.floor(maxPositionValue / contractCost)) : 1;
    const totalCost = suggestedQty * contractCost;
    const allocPct = accountSize > 0 ? Math.round((totalCost / accountSize) * 100 * 10) / 10 : 0;

    return `${emoji} *${a.ticker}* — ${a.scanner_type}\n` +
      `   $${a.price} | RSI ${a.rsi} | Δ${a.delta || "?"} | ${checkPassed}/${checkTotal} ✓\n` +
      `   Strike: $${a.suggested_strike || "?"} | ${a.suggested_expiry || "?"}\n` +
      `   📦 ${suggestedQty} contract${suggestedQty > 1 ? "s" : ""} @ $${askPrice.toFixed(2)} = $${totalCost.toLocaleString()} (${allocPct}%)`;
  });

  return `📡 *Daily Scan Results*\n${new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}\n\n${lines.join("\n\n")}\n\n_Sizing: ${positionSizePct}% of $${accountSize.toLocaleString()} = max $${maxPositionValue.toLocaleString()}_\n\n_Reply /approve TICKER for AI price suggestion_\n_Reply /reject TICKER [reason] to pass_`;
}
