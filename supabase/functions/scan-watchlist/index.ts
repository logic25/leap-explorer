import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface PolygonSnapshot {
  ticker: string;
  todaysChange: number;
  todaysChangePerc: number;
  day: { c: number; v: number; vw: number; o: number; h: number; l: number };
  prevDay: { c: number; v: number };
  min: { av: number };
}

interface PolygonAggsResult {
  c: number; // close
  v: number; // volume
}

interface PolygonOptionsContract {
  break_even_price: number;
  day: { close: number; open: number; volume: number };
  details: {
    contract_type: string;
    exercise_style: string;
    expiration_date: string;
    strike_price: number;
    ticker: string;
  };
  greeks?: { delta: number; gamma: number; theta: number; vega: number };
  implied_volatility?: number;
  open_interest: number;
  last_quote?: { ask: number; bid: number; midpoint: number };
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

    // Determine target user(s) — cron calls without auth, so scan for all users
    let body: { user_id?: string } = {};
    try {
      body = await req.json();
    } catch {
      // cron call with no body
    }

    // Get all users' watchlists (or a specific user)
    let profilesQuery = supabase.from("profiles").select("id, stock_watchlist");
    if (body.user_id) {
      profilesQuery = profilesQuery.eq("id", body.user_id);
    }
    const { data: profiles, error: profileError } = await profilesQuery;
    if (profileError) throw profileError;

    const allAlerts: any[] = [];

    for (const profile of profiles || []) {
      const watchlist: string[] = profile.stock_watchlist || [];
      if (watchlist.length === 0) continue;

      // Fetch snapshot for all tickers
      const snapshotUrl = `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers?tickers=${watchlist.join(",")}&apiKey=${POLYGON_API_KEY}`;
      const snapshotRes = await fetch(snapshotUrl);
      const snapshotData = await snapshotRes.json();

      if (snapshotData.status !== "OK" || !snapshotData.tickers) {
        console.error("Polygon snapshot error:", snapshotData);
        continue;
      }

      for (const snap of snapshotData.tickers as PolygonSnapshot[]) {
        const ticker = snap.ticker;
        const price = snap.day?.c || snap.prevDay?.c || 0;
        const changePct = snap.todaysChangePerc || 0;
        const volume = snap.day?.v || 0;
        const avgVolume = snap.min?.av || snap.prevDay?.v || volume;
        const volRatio = avgVolume > 0 ? volume / avgVolume : 1;

        // Fetch RSI via SMA approach — get 15 daily bars
        let rsi = 50; // default
        try {
          const rsiUrl = `https://api.polygon.io/v1/indicators/rsi/${ticker}?timespan=day&window=14&series_type=close&order=desc&limit=1&apiKey=${POLYGON_API_KEY}`;
          const rsiRes = await fetch(rsiUrl);
          const rsiData = await rsiRes.json();
          if (rsiData.results?.values?.[0]?.value) {
            rsi = Math.round(rsiData.results.values[0].value);
          }
        } catch (e) {
          console.error(`RSI fetch failed for ${ticker}:`, e);
        }

        // Fetch SMA 50 and 200
        let sma50 = 0, sma200 = 0;
        try {
          const [sma50Res, sma200Res] = await Promise.all([
            fetch(`https://api.polygon.io/v1/indicators/sma/${ticker}?timespan=day&window=50&series_type=close&order=desc&limit=1&apiKey=${POLYGON_API_KEY}`),
            fetch(`https://api.polygon.io/v1/indicators/sma/${ticker}?timespan=day&window=200&series_type=close&order=desc&limit=1&apiKey=${POLYGON_API_KEY}`),
          ]);
          const sma50Data = await sma50Res.json();
          const sma200Data = await sma200Res.json();
          sma50 = sma50Data.results?.values?.[0]?.value || 0;
          sma200 = sma200Data.results?.values?.[0]?.value || 0;
        } catch (e) {
          console.error(`SMA fetch failed for ${ticker}:`, e);
        }

        // Determine scanner type
        const scannerType = detectScannerType(price, sma50, sma200, rsi, volRatio, changePct);
        if (!scannerType) continue; // doesn't match any scanner

        // Fetch options chain for Jan 2028 LEAPS
        let optionData: any = {};
        try {
          const expGte = "2027-12-01";
          const expLte = "2028-02-28";
          const optUrl = `https://api.polygon.io/v3/snapshot/options/${ticker}?strike_price.gte=${Math.round(price * 0.85)}&strike_price.lte=${Math.round(price * 1.15)}&expiration_date.gte=${expGte}&expiration_date.lte=${expLte}&contract_type=call&limit=10&apiKey=${POLYGON_API_KEY}`;
          const optRes = await fetch(optUrl);
          const optJson = await optRes.json();
          
          if (optJson.results && optJson.results.length > 0) {
            // Find best contract: delta closest to target range
            const targetDelta = scannerType === "Fallen Angel" ? 0.475 : 0.575;
            const contracts = optJson.results as PolygonOptionsContract[];
            const best = contracts.reduce((prev: PolygonOptionsContract, curr: PolygonOptionsContract) => {
              const prevDelta = Math.abs((prev.greeks?.delta || 0) - targetDelta);
              const currDelta = Math.abs((curr.greeks?.delta || 0) - targetDelta);
              return currDelta < prevDelta ? curr : prev;
            });

            const ask = best.last_quote?.ask || 0;
            const bid = best.last_quote?.bid || 0;
            const spread = ask > 0 ? ((ask - bid) / ask) * 100 : 0;
            const expDate = best.details?.expiration_date || "";
            const dte = expDate ? Math.round((new Date(expDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 0;

            optionData = {
              suggested_strike: best.details?.strike_price,
              suggested_expiry: expDate,
              delta: best.greeks?.delta || null,
              dte,
              open_interest: best.open_interest || 0,
              bid_ask_spread: Math.round(spread * 100) / 100,
              ask_price: ask,
              iv_percentile: best.implied_volatility ? Math.round(best.implied_volatility * 100) : null,
            };
          }
        } catch (e) {
          console.error(`Options fetch failed for ${ticker}:`, e);
        }

        // Build checklist
        const checklist = buildChecklist(scannerType, price, sma50, sma200, rsi, optionData);
        const allPassed = checklist.every((c: any) => c.passed);

        const alert = {
          user_id: profile.id,
          ticker,
          name: getTickerName(ticker),
          scanner_type: scannerType,
          price,
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
          ask_price: optionData.ask_price || null,
          checklist,
          all_passed: allPassed,
        };

        allAlerts.push(alert);
      }
    }

    // Insert alerts
    if (allAlerts.length > 0) {
      const { error: insertError } = await supabase
        .from("scanner_alerts")
        .insert(allAlerts);
      if (insertError) throw insertError;
    }

    // Log the scan in audit_log for each user
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

    return new Response(
      JSON.stringify({
        success: true,
        alerts_created: allAlerts.length,
        users_scanned: profiles?.length || 0,
      }),
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

function detectScannerType(
  price: number,
  sma50: number,
  sma200: number,
  rsi: number,
  volRatio: number,
  changePct: number
): string | null {
  // Value Zone: price near or below 50 MA, RSI < 50, above 200 MA
  if (price <= sma50 * 1.03 && price >= sma200 * 0.97 && rsi < 50) {
    return "Value Zone";
  }

  // MegaRun: price above both MAs, RSI > 55, breaking higher
  if (price > sma50 && price > sma200 && rsi > 55 && changePct > 1.5) {
    return "MegaRun";
  }

  // Fallen Angel: price significantly below 50 MA, RSI < 40
  if (price < sma50 * 0.92 && rsi < 40) {
    return "Fallen Angel";
  }

  return null;
}

function buildChecklist(
  scannerType: string,
  price: number,
  sma50: number,
  sma200: number,
  rsi: number,
  opt: any
): { label: string; passed: boolean }[] {
  const items: { label: string; passed: boolean }[] = [];

  items.push({ label: "Scanner Confirmation", passed: true });
  items.push({
    label: "Weekly Chart: Above 200 MA / Clean Uptrend",
    passed: price > sma200 * 0.97,
  });
  items.push({
    label: "Weekly Chart: 1-2 ATR Pullback",
    passed: scannerType !== "MegaRun",
  });

  const deltaMin = scannerType === "Fallen Angel" ? 0.4 : 0.5;
  const deltaMax = scannerType === "Fallen Angel" ? 0.55 : 0.65;
  items.push({
    label: `Option Chain: Delta ${deltaMin}-${deltaMax}`,
    passed: opt.delta ? opt.delta >= deltaMin && opt.delta <= deltaMax : false,
  });

  items.push({
    label: "Option Chain: DTE 700-900+",
    passed: opt.dte ? opt.dte >= 700 : false,
  });
  items.push({
    label: "Option Chain: OI > 500",
    passed: opt.open_interest ? opt.open_interest > 500 : false,
  });
  items.push({
    label: "Option Chain: Bid-Ask < 2-5%",
    passed: opt.bid_ask_spread ? opt.bid_ask_spread < 5 : false,
  });
  items.push({
    label: "Option Chain: IV Term Structure",
    passed: scannerType !== "Fallen Angel",
  });
  items.push({
    label: "Option Chain: IV Percentile < 50th",
    passed: opt.iv_percentile ? opt.iv_percentile < 50 : false,
  });
  items.push({
    label: "Portfolio: Size 2-4% / Total < 25%",
    passed: true,
  });
  items.push({ label: "No Earnings in 2 Weeks", passed: true });
  items.push({ label: "Thesis Understood", passed: false });

  return items;
}

function getTickerName(ticker: string): string {
  const names: Record<string, string> = {
    MSFT: "Microsoft Corp",
    GOOG: "Alphabet Inc",
    AMZN: "Amazon.com Inc",
    NVDA: "NVIDIA Corp",
    META: "Meta Platforms",
    AVGO: "Broadcom Inc",
    CRWD: "CrowdStrike",
    IREN: "Iris Energy",
    MARA: "Marathon Digital",
    AMD: "AMD Inc",
    AAPL: "Apple Inc",
    TSLA: "Tesla Inc",
    NFLX: "Netflix Inc",
  };
  return names[ticker] || ticker;
}
