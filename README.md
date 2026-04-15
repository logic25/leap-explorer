# LEAP Explorer

A LEAP-focused options scanner, playbook, and portfolio tracker. Built for finding cheap convexity on high-conviction underlyings and managing positions across the full lifecycle (entry → roll → exit).

## Features

- **Scanner** — Value Zone, MegaRun, and Fallen Angel scanners with RSI, IV percentile, IV/HV ratio, delta, theta, DTE, OI, spread, and chain-quality scoring. Configurable columns per user.
- **LEAP View** — one-click preset: filters for delta ≥ 0.65, DTE ≥ 365, IV percentile ≤ 30, and sorts by convexity score.
- **Convexity Score** — composite rank across delta, DTE, IV percentile, and chain quality. Lets you compare cheap LEAPs across tickers.
- **Position Sizer** — enter portfolio equity, starter %, and premium → get contracts, max loss, and % of portfolio at risk.
- **Playbook** — chart pattern + checklist workflow tied to each scanner type.
- **Portfolio** — open positions with P&L, delta, DTE warnings, and roll suggestions via the `check-rolls` edge function.
- **Backtester** — historical strategy evaluation.
- **Chat** — strategy assistant (`chat` edge function).
- **Integrations** — Polygon (market data), Alpaca (positions), Telegram (alerts).

## Stack

Vite + React + TypeScript + shadcn-ui + Tailwind · Supabase (auth, Postgres, edge functions) · Polygon · Alpaca · Telegram

## Local development

```sh
npm i
cp .env.example .env  # fill in your own Supabase project values
npm run dev
```

Supabase edge-function secrets (`POLYGON_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, Alpaca/Telegram tokens) are configured in the Supabase dashboard — not in this repo.

## Deploy

Deployed via Lovable. Push to `main` and Lovable rebuilds.
