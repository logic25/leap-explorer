import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { description, scanner_type } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

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
            content: `You are a LEAPS options scanner configuration parser. Given a natural language strategy description, extract structured conditions as JSON. Return ONLY a tool call with the extracted conditions.

Available condition keys:
- rsi_max, rsi_min: RSI thresholds (number)
- price_vs_sma50: "above", "below", "near" (within 3%)
- price_vs_sma200: "above", "below", "near"
- volume_ratio_min: minimum volume/avgVolume ratio (number)
- change_pct_min, change_pct_max: daily change % thresholds
- delta_min, delta_max: option delta range
- dte_min: minimum days to expiry
- iv_percentile_max: max IV percentile
- drawdown_from_sma50_min: minimum % below 50 SMA (for Fallen Angel)`,
          },
          {
            role: "user",
            content: `Scanner type: ${scanner_type}\n\nStrategy description:\n${description}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_conditions",
              description: "Extract structured scanner conditions from the strategy description",
              parameters: {
                type: "object",
                properties: {
                  rsi_max: { type: "number" },
                  rsi_min: { type: "number" },
                  price_vs_sma50: { type: "string", enum: ["above", "below", "near"] },
                  price_vs_sma200: { type: "string", enum: ["above", "below", "near"] },
                  volume_ratio_min: { type: "number" },
                  change_pct_min: { type: "number" },
                  change_pct_max: { type: "number" },
                  delta_min: { type: "number" },
                  delta_max: { type: "number" },
                  dte_min: { type: "number" },
                  iv_percentile_max: { type: "number" },
                  drawdown_from_sma50_min: { type: "number" },
                },
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_conditions" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No conditions extracted");

    const conditions = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ conditions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("parse-strategy error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
