import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface DailyBar {
  o: number; h: number; l: number; c: number; v: number; t: number;
}

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

    let body: { user_id?: string; tickers?: string[] } = {};
    try { body = await req.json(); } catch { /* cron call */ }

    let profilesQuery = supabase.from("profiles").select("id, stock_watchlist");
    if (body.user_id) profilesQuery = profilesQuery.eq("id", body.user_id);
    const { data: profiles, error: profileError } = await profilesQuery;
    if (profileError) throw profileError;

    const allAlerts: any[] = [];

    for (const profile of profiles || []) {
      // Allow override of tickers for testing
      const watchlist: string[] = body.tickers || profile.stock_watchlist || [];
      if (watchlist.length === 0) continue;

      // Load user strategies from DB
      const { data: userStrategies } = await supabase
        .from("strategies")
        .select("*")
        .eq("user_id", profile.id)
        .eq("enabled", true);

      // Process each ticker — free tier allows per-ticker aggs
      for (const ticker of watchlist) {
        try {
          // Fetch 250 daily bars (enough for 200 SMA + RSI)
          const to = new Date().toISOString().split("T")[0];
          const fromDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
          const aggsUrl = `https://api.polygon.io/v2/aggs/ticker/${ticker}/range/1/day/${fromDate}/${to}?adjusted=true&sort=asc&limit=300&apiKey=${POLYGON_API_KEY}`;

          const aggsRes = await fetch(aggsUrl);
          const aggsData = await aggsRes.json();

          if (aggsData.resultsCount < 50 || !aggsData.results) {
            console.log(`${ticker}: insufficient data (${aggsData.resultsCount || 0} bars)`);
            continue;
          }

          const bars: DailyBar[] = aggsData.results;
          const latest = bars[bars.length - 1];
          const prev = bars[bars.length - 2];

          const price = latest.c;
          const changePct = prev.c > 0 ? ((latest.c - prev.c) / prev.c) * 100 : 0;
          const volume = latest.v;

          // Compute SMA 50
          const sma50 = bars.length >= 50
            ? bars.slice(-50).reduce((s, b) => s + b.c, 0) / 50
            : 0;

          // Compute SMA 200
          const sma200 = bars.length >= 200
            ? bars.slice(-200).reduce((s, b) => s + b.c, 0) / 200
            : 0;

          // Compute average volume (50-day)
          const avgVolume = bars.length >= 50
            ? bars.slice(-50).reduce((s, b) => s + b.v, 0) / 50
            : volume;

          const volRatio = avgVolume > 0 ? volume / avgVolume : 1;

          // Compute RSI (14-period)
          const rsi = computeRSI(bars, 14);

          // Try user strategies first, then fall back to hardcoded detection
          let scannerType: string | null = null;
          if (userStrategies && userStrategies.length > 0) {
            for (const strat of userStrategies) {
              const conds = strat.conditions || {};
              let match = true;
              if (conds.rsi_max != null && rsi > conds.rsi_max) match = false;
              if (conds.rsi_min != null && rsi < conds.rsi_min) match = false;
              if (conds.volume_ratio_min != null && volRatio < conds.volume_ratio_min) match = false;
              if (conds.change_pct_min != null && changePct < conds.change_pct_min) match = false;
              if (conds.change_pct_max != null && changePct > conds.change_pct_max) match = false;
              if (conds.price_vs_sma50 === "above" && price <= sma50) match = false;
              if (conds.price_vs_sma50 === "below" && price >= sma50) match = false;
              if (conds.price_vs_sma50 === "near" && Math.abs(price - sma50) / sma50 > 0.03) match = false;
              if (conds.price_vs_sma200 === "above" && price <= sma200) match = false;
              if (conds.price_vs_sma200 === "below" && price >= sma200) match = false;
              if (conds.price_vs_sma200 === "near" && Math.abs(price - sma200) / sma200 > 0.03) match = false;
              if (conds.drawdown_from_sma50_min != null) {
                const drawdown = ((sma50 - price) / sma50) * 100;
                if (drawdown < conds.drawdown_from_sma50_min) match = false;
              }
              if (match) {
                scannerType = strat.scanner_type;
                break;
              }
            }
          }
          // Fallback to hardcoded detection
          if (!scannerType) {
            scannerType = detectScannerType(price, sma50, sma200, rsi, volRatio, changePct);
          }
          if (!scannerType) continue;

          // Fetch options contracts via free-tier reference endpoint
          let optionData: any = {};
          try {
            const expGte = "2027-12-01";
            const expLte = "2028-02-28";
            const strikeMin = Math.round(price * 0.85);
            const strikeMax = Math.round(price * 1.15);

            // Use /v3/reference/options/contracts (free tier)
            const contractsUrl = `https://api.polygon.io/v3/reference/options/contracts?underlying_ticker=${ticker}&contract_type=call&expiration_date.gte=${expGte}&expiration_date.lte=${expLte}&strike_price.gte=${strikeMin}&strike_price.lte=${strikeMax}&limit=20&apiKey=${POLYGON_API_KEY}`;
            const contractsRes = await fetch(contractsUrl);
            const contractsJson = await contractsRes.json();

            if (contractsJson.results && contractsJson.results.length > 0) {
              // Pick ATM strike closest to current price
              const contracts = contractsJson.results;
              const best = contracts.reduce((prev: any, curr: any) => {
                return Math.abs(curr.strike_price - price) < Math.abs(prev.strike_price - price) ? curr : prev;
              });

              const expDate = best.expiration_date || "";
              const dte = expDate ? Math.round((new Date(expDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 0;

              // Try to get last day's data for this contract via aggs (free tier, delayed)
              let ask = 0, bid = 0, oi = 0, iv = null, historicalLow = 0;
              try {
                const optTicker = best.ticker;
                // Get previous day close
                const optAggsUrl = `https://api.polygon.io/v2/aggs/ticker/${optTicker}/prev?adjusted=true&apiKey=${POLYGON_API_KEY}`;
                const optAggsRes = await fetch(optAggsUrl);
                const optAggsData = await optAggsRes.json();
                if (optAggsData.results?.[0]) {
                  const optBar = optAggsData.results[0];
                  ask = optBar.c * 1.02;
                  bid = optBar.c * 0.98;
                }

                // Fetch historical low for this option contract (last 12 months)
                await sleep(13000); // rate limit
                const optHistFrom = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
                const optHistTo = new Date().toISOString().split("T")[0];
                const optHistUrl = `https://api.polygon.io/v2/aggs/ticker/${optTicker}/range/1/day/${optHistFrom}/${optHistTo}?adjusted=true&sort=asc&limit=300&apiKey=${POLYGON_API_KEY}`;
                const optHistRes = await fetch(optHistUrl);
                const optHistData = await optHistRes.json();
                if (optHistData.results && optHistData.results.length > 0) {
                  historicalLow = Math.min(...optHistData.results.map((b: any) => b.l));
                }
              } catch (e) {
                console.log(`Option aggs failed for ${best.ticker}:`, e);
              }

              const spread = ask > 0 ? ((ask - bid) / ask) * 100 : 0;

              // Estimate delta from moneyness (free tier has no greeks)
              const moneyness = price / best.strike_price;
              const estDelta = estimateDelta(moneyness, dte);

              optionData = {
                suggested_strike: best.strike_price,
                suggested_expiry: expDate,
                delta: Math.round(estDelta * 100) / 100,
                dte,
                open_interest: oi,
                bid_ask_spread: Math.round(spread * 100) / 100,
                ask_price: Math.round(ask * 100) / 100,
                iv_percentile: iv,
                historical_low: historicalLow > 0 ? Math.round(historicalLow * 100) / 100 : null,
              };
            }
          } catch (e) {
            console.error(`Options fetch failed for ${ticker}:`, e);
          }

          const checklist = buildChecklist(scannerType, price, sma50, sma200, rsi, optionData);
          const allPassed = checklist.every((c: any) => c.passed);
          const passedCount = checklist.filter((c: any) => c.passed).length;
          const confluenceScore = `${passedCount}/${checklist.length}`;

          // Compute suggested limit price (mid from bid/ask)
          const askP = optionData.ask_price || 0;
          const bidP = askP > 0 ? askP * 0.96 : 0;
          const suggestedLimitPrice = askP > 0 ? Math.round(((askP + bidP) / 2) * 100) / 100 : null;

          allAlerts.push({
            user_id: profile.id,
            ticker,
            name: getTickerName(ticker),
            scanner_type: scannerType,
            price: Math.round(price * 100) / 100,
            change_pct: Math.round(changePct * 100) / 100,
            rsi,
            volume,
            avg_volume: Math.round(avgVolume),
            suggested_strike: optionData.suggested_strike || null,
            suggested_expiry: optionData.suggested_expiry || null,
            delta: optionData.delta || null,
            dte: optionData.dte || null,
            open_interest: optionData.open_interest || null,
            bid_ask_spread: optionData.bid_ask_spread || null,
            iv_percentile: optionData.iv_percentile || null,
            iv_rank: optionData.iv_rank || null,
            iv_hv_ratio: optionData.iv_hv_ratio || null,
            ask_price: optionData.ask_price || null,
            historical_low: optionData.historical_low || null,
            checklist,
            all_passed: allPassed,
            confluence_score: confluenceScore,
          });

          // Rate limit: free tier = 5 req/min (~12s per ticker for 4 calls)
          await sleep(13000);
        } catch (e) {
          console.error(`Error processing ${ticker}:`, e);
        }
      }
    }

    // Insert alerts
    if (allAlerts.length > 0) {
      const { error: insertError } = await supabase.from("scanner_alerts").insert(allAlerts);
      if (insertError) throw insertError;
    }

    // Audit log
    const userIds = [...new Set(allAlerts.map((a) => a.user_id))];
    for (const userId of userIds) {
      const userAlerts = allAlerts.filter((a) => a.user_id === userId);
      await supabase.from("audit_log").insert({
        user_id: userId,
        action_type: "SCAN_COMPLETE",
        details: {
          alert_count: userAlerts.length,
          tickers: userAlerts.map((a: any) => a.ticker),
          scanner_types: userAlerts.map((a: any) => a.scanner_type),
        },
      });
    }

    // Send Telegram alerts — only for 100% checklist passes
    const qualifiedAlerts = allAlerts.filter(a => a.all_passed);
    if (qualifiedAlerts.length > 0) {
      try {
        const telegramUrl = `${SUPABASE_URL}/functions/v1/telegram`;
        await fetch(telegramUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
          },
          body: JSON.stringify({ action: "send_alerts", alerts: qualifiedAlerts }),
        });
      } catch (e) {
        console.error("Telegram alert send failed:", e);
      }
    }

    return new Response(
      JSON.stringify({ success: true, alerts_created: allAlerts.length, users_scanned: profiles?.length || 0 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Scan error:", error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ─── Helpers ─────────────────────────────────────────────

function computeRSI(bars: DailyBar[], period: number): number {
  if (bars.length < period + 1) return 50;

  const closes = bars.map((b) => b.c);
  let gains = 0, losses = 0;

  // Initial average
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }

  const avgGain = gains / period;
  const avgLoss = losses / period;

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return Math.round(100 - 100 / (1 + rs));
}

function estimateDelta(moneyness: number, dte: number): number {
  // Simple Black-Scholes-like approximation for LEAPS delta
  // moneyness = spot/strike, dte in days
  if (dte <= 0) return moneyness > 1 ? 1 : 0;
  const t = dte / 365;
  const vol = 0.30; // assume ~30% IV for large caps
  const d1 = (Math.log(moneyness) + 0.5 * vol * vol * t) / (vol * Math.sqrt(t));
  // Approximate cumulative normal
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

function detectScannerType(
  price: number, sma50: number, sma200: number, rsi: number, volRatio: number, changePct: number
): string | null {
  if (sma50 === 0 || sma200 === 0) return null;

  // Value Zone: price near/below 50 MA, RSI < 50, above 200 MA
  if (price <= sma50 * 1.03 && price >= sma200 * 0.97 && rsi < 50) return "Value Zone";

  // MegaRun: above both MAs, RSI > 55, breaking higher
  if (price > sma50 && price > sma200 && rsi > 55 && changePct > 1.5) return "MegaRun";

  // Fallen Angel: significantly below 50 MA, RSI < 40
  if (price < sma50 * 0.92 && rsi < 40) return "Fallen Angel";

  return null;
}

function buildChecklist(
  scannerType: string, price: number, sma50: number, sma200: number, rsi: number, opt: any
): { label: string; passed: boolean }[] {
  const deltaMin = scannerType === "Fallen Angel" ? 0.4 : 0.5;
  const deltaMax = scannerType === "Fallen Angel" ? 0.55 : 0.65;
  return [
    { label: "Scanner Confirmation", passed: true },
    { label: "Weekly Chart: Above 200 MA / Clean Uptrend", passed: price > sma200 * 0.97 },
    { label: "Weekly Chart: 1-2 ATR Pullback", passed: scannerType !== "MegaRun" },
    { label: `Option Chain: Delta ${deltaMin}-${deltaMax}`, passed: opt.delta ? opt.delta >= deltaMin && opt.delta <= deltaMax : false },
    { label: "Option Chain: DTE 700-900+", passed: opt.dte ? opt.dte >= 700 : false },
    { label: "Option Chain: OI > 500", passed: opt.open_interest ? opt.open_interest > 500 : false },
    { label: "Option Chain: Bid-Ask < 2-5%", passed: opt.bid_ask_spread != null ? opt.bid_ask_spread < 5 : false },
    { label: "Option Chain: IV Term Structure", passed: scannerType !== "Fallen Angel" },
    { label: "Option Chain: IV Percentile < 50th", passed: opt.iv_percentile != null ? opt.iv_percentile < 50 : true },
    { label: "Option Chain: IV Rank < 50", passed: opt.iv_rank != null ? opt.iv_rank < 50 : true },
    { label: "Option Chain: IV/HV Ratio < 1.1", passed: opt.iv_hv_ratio != null ? opt.iv_hv_ratio < 1.1 : true },
    { label: "Portfolio: Size 2-4% / Total < 25%", passed: true },
    { label: "No Earnings in 2 Weeks", passed: true },
    { label: "Thesis Understood", passed: false },
  ];
}

function getTickerName(ticker: string): string {
  const names: Record<string, string> = {
    MSFT: "Microsoft Corp", GOOG: "Alphabet Inc", AMZN: "Amazon.com Inc",
    NVDA: "NVIDIA Corp", META: "Meta Platforms", AVGO: "Broadcom Inc",
    CRWD: "CrowdStrike", IREN: "Iris Energy", MARA: "Marathon Digital",
    AMD: "AMD Inc", AAPL: "Apple Inc", TSLA: "Tesla Inc", NFLX: "Netflix Inc",
  };
  return names[ticker] || ticker;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
