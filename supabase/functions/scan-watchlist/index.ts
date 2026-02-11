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
      const defaultWatchlist: string[] = body.tickers || profile.stock_watchlist || [];

      // Load user strategies from DB
      const { data: userStrategies } = await supabase
        .from("strategies")
        .select("*")
        .eq("user_id", profile.id)
        .eq("enabled", true);

      interface StrategyWithTickers {
        strategy: any | null;
        tickers: string[];
      }
      const strategyRuns: StrategyWithTickers[] = [];

      if (userStrategies && userStrategies.length > 0) {
        for (const strat of userStrategies) {
          const stratTickers: string[] = (strat as any).tickers || [];
          strategyRuns.push({
            strategy: strat,
            tickers: stratTickers.length > 0 ? stratTickers : defaultWatchlist,
          });
        }
      } else {
        strategyRuns.push({ strategy: null, tickers: defaultWatchlist });
      }

      const tickerDataCache: Record<string, any> = {};

      for (const run of strategyRuns) {
        if (run.tickers.length === 0) continue;

        for (const ticker of run.tickers) {
        try {
          let tickerData = tickerDataCache[ticker];
          if (!tickerData) {
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

          const sma50 = bars.length >= 50 ? bars.slice(-50).reduce((s, b) => s + b.c, 0) / 50 : 0;
          const sma200 = bars.length >= 200 ? bars.slice(-200).reduce((s, b) => s + b.c, 0) / 200 : 0;
          const avgVolume = bars.length >= 50 ? bars.slice(-50).reduce((s, b) => s + b.v, 0) / 50 : volume;
          const volRatio = avgVolume > 0 ? volume / avgVolume : 1;
          const rsi = computeRSI(bars, 14);

          // Compute Historical Volatility (HV) from daily returns
          const hvBars = bars.slice(-30);
          const returns = hvBars.slice(1).map((b, i) => Math.log(b.c / hvBars[i].c));
          const meanRet = returns.reduce((s, r) => s + r, 0) / returns.length;
          const variance = returns.reduce((s, r) => s + (r - meanRet) ** 2, 0) / (returns.length - 1);
          const hv = Math.sqrt(variance * 252) * 100; // annualized HV in %

          tickerData = { price, changePct, volume, sma50, sma200, avgVolume, volRatio, rsi, hv };
          tickerDataCache[ticker] = tickerData;

          await sleep(13000);
          }

          const { price, changePct, volume, sma50, sma200, avgVolume, volRatio, rsi, hv } = tickerData;

          // Determine scanner type
          let scannerType: string | null = null;
          if (run.strategy) {
              const conds = run.strategy.conditions || {};
              const metrics: string[] = conds.enabled_metrics || [];
              const hasMetric = (m: string) => metrics.length === 0 || metrics.includes(m);
              let match = true;
              if (hasMetric('rsi') && conds.rsi_max != null && rsi > conds.rsi_max) match = false;
              if (hasMetric('rsi') && conds.rsi_min != null && rsi < conds.rsi_min) match = false;
              if (hasMetric('volume_ratio') && conds.volume_ratio_min != null && volRatio < conds.volume_ratio_min) match = false;
              if (hasMetric('change_pct') && conds.change_pct_min != null && changePct < conds.change_pct_min) match = false;
              if (hasMetric('change_pct') && conds.change_pct_max != null && changePct > conds.change_pct_max) match = false;
              if (hasMetric('price_vs_sma50')) {
                if (conds.price_vs_sma50 === "above" && price <= sma50) match = false;
                if (conds.price_vs_sma50 === "below" && price >= sma50) match = false;
                if (conds.price_vs_sma50 === "near" && Math.abs(price - sma50) / sma50 > 0.03) match = false;
              }
              if (hasMetric('price_vs_sma200')) {
                if (conds.price_vs_sma200 === "above" && price <= sma200) match = false;
                if (conds.price_vs_sma200 === "below" && price >= sma200) match = false;
                if (conds.price_vs_sma200 === "near" && Math.abs(price - sma200) / sma200 > 0.03) match = false;
              }
              if (hasMetric('drawdown_from_sma50') && conds.drawdown_from_sma50_min != null) {
                const drawdown = ((sma50 - price) / sma50) * 100;
                if (drawdown < conds.drawdown_from_sma50_min) match = false;
              }
              if (match) scannerType = run.strategy.scanner_type;
          } else {
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

            const contractsUrl = `https://api.polygon.io/v3/reference/options/contracts?underlying_ticker=${ticker}&contract_type=call&expiration_date.gte=${expGte}&expiration_date.lte=${expLte}&strike_price.gte=${strikeMin}&strike_price.lte=${strikeMax}&limit=20&apiKey=${POLYGON_API_KEY}`;
            const contractsRes = await fetch(contractsUrl);
            const contractsJson = await contractsRes.json();

            if (contractsJson.results && contractsJson.results.length > 0) {
              const contracts = contractsJson.results;
              const best = contracts.reduce((prev: any, curr: any) => {
                return Math.abs(curr.strike_price - price) < Math.abs(prev.strike_price - price) ? curr : prev;
              });

              const expDate = best.expiration_date || "";
              const dte = expDate ? Math.round((new Date(expDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 0;

              let ask = 0, bid = 0, oi = 0, optVolume = 0, iv = null, historicalLow = 0;
              try {
                const optTicker = best.ticker;
                const optAggsUrl = `https://api.polygon.io/v2/aggs/ticker/${optTicker}/prev?adjusted=true&apiKey=${POLYGON_API_KEY}`;
                const optAggsRes = await fetch(optAggsUrl);
                const optAggsData = await optAggsRes.json();
                if (optAggsData.results?.[0]) {
                  const optBar = optAggsData.results[0];
                  ask = optBar.c * 1.02;
                  bid = optBar.c * 0.98;
                  optVolume = optBar.v || 0;
                }

                // Try to get OI from snapshot (free tier may not have this)
                try {
                  const snapshotUrl = `https://api.polygon.io/v3/snapshot/options/${ticker}/${best.ticker}?apiKey=${POLYGON_API_KEY}`;
                  const snapRes = await fetch(snapshotUrl);
                  const snapData = await snapRes.json();
                  if (snapData.results) {
                    oi = snapData.results.open_interest || 0;
                    if (snapData.results.implied_volatility) {
                      iv = Math.round(snapData.results.implied_volatility * 100);
                    }
                    if (snapData.results.greeks) {
                      // Real greeks if available
                    }
                  }
                } catch (e) {
                  console.log(`Snapshot not available for ${best.ticker} (likely free tier)`);
                }

                // Fetch historical low for this option contract
                await sleep(13000);
                const optHistFrom = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
                const optHistTo = new Date().toISOString().split("T")[0];
                const optHistUrl = `https://api.polygon.io/v2/aggs/ticker/${best.ticker}/range/1/day/${optHistFrom}/${optHistTo}?adjusted=true&sort=asc&limit=300&apiKey=${POLYGON_API_KEY}`;
                const optHistRes = await fetch(optHistUrl);
                const optHistData = await optHistRes.json();
                if (optHistData.results && optHistData.results.length > 0) {
                  historicalLow = Math.min(...optHistData.results.map((b: any) => b.l));
                }
              } catch (e) {
                console.log(`Option aggs failed for ${best.ticker}:`, e);
              }

              const mid = (ask + bid) / 2;
              const spread = mid > 0 ? ((ask - bid) / mid) * 100 : 0;
              const slippageEst = mid > 0 ? Math.round((ask - mid) * 100) / 100 : 0;

              // Estimate Greeks
              const moneyness = price / best.strike_price;
              const estDelta = estimateDelta(moneyness, dte);
              const estTheta = estimateTheta(mid > 0 ? mid : price * 0.15, dte, 0.30);
              const estVega = estimateVega(price, dte, 0.30);

              // IV vs HV analysis
              const impliedVol = iv || 30; // fallback estimate
              const ivHvRatio = hv > 0 ? Math.round((impliedVol / hv) * 100) / 100 : null;

              // Volume/OI analysis
              const volumeOiRatio = oi > 0 ? Math.round((optVolume / oi) * 100) / 100 : null;
              const unusualActivity = (optVolume > 0 && oi > 0 && optVolume / oi > 1.5) || volRatio > 2.0;

              // Chain Quality Score (0-100): OI 40%, Volume 30%, Spread 30%
              const oiScore = Math.min(oi / 5000, 1) * 40; // 5000 OI = max score
              const volScore = Math.min(optVolume / 1000, 1) * 30; // 1000 vol = max
              const spreadScore = spread < 1 ? 30 : spread < 3 ? 20 : spread < 5 ? 10 : 0;
              const chainQualityScore = Math.round(oiScore + volScore + spreadScore);

              optionData = {
                suggested_strike: best.strike_price,
                suggested_expiry: expDate,
                delta: Math.round(estDelta * 100) / 100,
                theta: Math.round(estTheta * 100) / 100,
                vega: Math.round(estVega * 100) / 100,
                dte,
                open_interest: oi,
                bid_ask_spread: Math.round(spread * 100) / 100,
                ask_price: Math.round(ask * 100) / 100,
                iv_percentile: iv,
                iv_hv_ratio: ivHvRatio,
                historical_low: historicalLow > 0 ? Math.round(historicalLow * 100) / 100 : null,
                volume_oi_ratio: volumeOiRatio,
                unusual_activity: unusualActivity,
                slippage_est: slippageEst,
                chain_quality_score: chainQualityScore,
                opt_volume: optVolume,
              };
            }
          } catch (e) {
            console.error(`Options fetch failed for ${ticker}:`, e);
          }

          const checklist = buildChecklist(scannerType, price, sma50, sma200, rsi, optionData, hv);
          const allPassed = checklist.every((c: any) => c.passed);
          const passedCount = checklist.filter((c: any) => c.passed).length;
          const confluenceScore = `${passedCount}/${checklist.length}`;

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
            theta: optionData.theta || null,
            vega: optionData.vega || null,
            dte: optionData.dte || null,
            open_interest: optionData.open_interest || null,
            bid_ask_spread: optionData.bid_ask_spread || null,
            iv_percentile: optionData.iv_percentile || null,
            iv_rank: optionData.iv_rank || null,
            iv_hv_ratio: optionData.iv_hv_ratio || null,
            ask_price: optionData.ask_price || null,
            historical_low: optionData.historical_low || null,
            volume_oi_ratio: optionData.volume_oi_ratio || null,
            unusual_activity: optionData.unusual_activity || false,
            slippage_est: optionData.slippage_est || null,
            chain_quality_score: optionData.chain_quality_score || null,
            checklist,
            all_passed: allPassed,
            confluence_score: confluenceScore,
          });

        } catch (e) {
          console.error(`Error processing ${ticker}:`, e);
        }
      }
      } // end strategyRuns loop
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
  if (dte <= 0) return moneyness > 1 ? 1 : 0;
  const t = dte / 365;
  const vol = 0.30;
  const d1 = (Math.log(moneyness) + 0.5 * vol * vol * t) / (vol * Math.sqrt(t));
  return cdf(d1);
}

function estimateTheta(premium: number, dte: number, iv: number): number {
  // Simplified theta estimate: -premium * iv / (2 * sqrt(DTE/365) * 365)
  if (dte <= 0) return 0;
  const t = dte / 365;
  return -(premium * iv) / (2 * Math.sqrt(t) * 365);
}

function estimateVega(spotPrice: number, dte: number, iv: number): number {
  // Simplified vega: S * sqrt(T) * N'(d1) / 100
  if (dte <= 0) return 0;
  const t = dte / 365;
  return (spotPrice * Math.sqrt(t) * 0.3989) / 100; // N'(0) ≈ 0.3989
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
  if (price <= sma50 * 1.03 && price >= sma200 * 0.97 && rsi < 50) return "Value Zone";
  if (price > sma50 && price > sma200 && rsi > 55 && changePct > 1.5) return "MegaRun";
  if (price < sma50 * 0.92 && rsi < 40) return "Fallen Angel";
  return null;
}

function buildChecklist(
  scannerType: string, price: number, sma50: number, sma200: number, rsi: number, opt: any, hv: number
): { label: string; passed: boolean; category?: string }[] {
  const deltaMin = scannerType === "Fallen Angel" ? 0.4 : 0.5;
  const deltaMax = scannerType === "Fallen Angel" ? 0.55 : 0.65;

  return [
    // Scanner
    { label: "Scanner Confirmation", passed: true, category: "scanner" },
    { label: "Weekly Chart: Above 200 MA / Clean Uptrend", passed: price > sma200 * 0.97, category: "scanner" },
    { label: "Weekly Chart: 1-2 ATR Pullback", passed: scannerType !== "MegaRun", category: "scanner" },

    // Greeks
    { label: `Delta ${deltaMin}-${deltaMax}`, passed: opt.delta ? opt.delta >= deltaMin && opt.delta <= deltaMax : false, category: "greeks" },
    { label: "DTE 700-900+", passed: opt.dte ? opt.dte >= 700 : false, category: "greeks" },
    { label: "Theta < -$0.05/day (acceptable decay)", passed: opt.theta != null ? opt.theta > -0.10 : true, category: "greeks" },

    // Liquidity (OI)
    { label: "OI > 1,000 (liquid)", passed: opt.open_interest ? opt.open_interest >= 1000 : false, category: "liquidity" },
    { label: "OI > 500 (minimum)", passed: opt.open_interest ? opt.open_interest > 500 : false, category: "liquidity" },

    // Spread
    { label: "Bid-Ask Spread < 5%", passed: opt.bid_ask_spread != null ? opt.bid_ask_spread < 5 : false, category: "spread" },
    { label: "Bid-Ask Spread < 2% (ideal)", passed: opt.bid_ask_spread != null ? opt.bid_ask_spread < 2 : false, category: "spread" },
    { label: `Est. Slippage < $0.50`, passed: opt.slippage_est != null ? opt.slippage_est < 0.50 : true, category: "spread" },

    // IV
    { label: "IV Percentile < 50th", passed: opt.iv_percentile != null ? opt.iv_percentile < 50 : true, category: "iv" },
    { label: "IV Rank < 50", passed: opt.iv_rank != null ? opt.iv_rank < 50 : true, category: "iv" },
    { label: "IV/HV Ratio < 1.3 (not overpriced)", passed: opt.iv_hv_ratio != null ? opt.iv_hv_ratio < 1.3 : true, category: "iv" },

    // Volume
    { label: "Options Volume > 0", passed: opt.opt_volume != null ? opt.opt_volume > 0 : false, category: "volume" },
    { label: "Volume/OI Ratio < 3 (not front-run)", passed: opt.volume_oi_ratio != null ? opt.volume_oi_ratio < 3 : true, category: "volume" },

    // Chain Quality
    { label: "Chain Quality Score > 50", passed: opt.chain_quality_score != null ? opt.chain_quality_score > 50 : false, category: "quality" },

    // Portfolio
    { label: "Portfolio: Size 2-4% / Total < 25%", passed: true, category: "portfolio" },
    { label: "No Earnings in 2 Weeks", passed: true, category: "portfolio" },
    { label: "Thesis Understood", passed: false, category: "portfolio" },
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
