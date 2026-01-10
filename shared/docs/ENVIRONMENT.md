# Environment / Konfiguration (Ist-Zustand)

Ziel: Vollständige Liste aller im Repo **referenzierten** Environment Variables – getrennt nach Frontend (build-time), Vercel Routing (runtime) und Backend(s) (runtime). Unklares ist als **TODO** markiert.

## Grundregel: Secrets niemals ins Frontend

- **Frontend (Vite)**: `import.meta.env.VITE_*` ist **öffentlich** (landet im Bundle).
- **Backend(s)**: `process.env.*` ist runtime‑seitig; Secrets gehören **nur** hierhin.

## Vercel Routing (runtime, `vercel.json`)

| Variable | Secret | Required | Zweck | Verwendet in |
|---|---:|---:|---|---|
| `VERCEL_BACKEND_URL` | ❌ | ✅ (für Production) | Hostname des externen Backends für `/api/*` Rewrite. **Format:** Hostname ohne `https://` und ohne `/api`. | `vercel.json`, `scripts/verify-vercel-api-ownership.mjs` |

## Frontend (Vite) — `VITE_*` (build-time)

| Variable | Secret | Required | Default | Zweck | Verwendet in |
|---|---:|---:|---|---|---|
| `VITE_API_URL` | ❌ | ❌ | `"/api"` | API Base URL für Frontend + SW | `src/services/api/client.ts`, `src/services/reasoning/client.ts`, `src/sw/sw-alerts.ts`, `src/sw/sw-oracle.ts` |
| `VITE_ENABLE_DEV_NAV` | ❌ | ❌ | `"false"` (in `.env.example`) | Dev-Navigation sichtbar machen | `src/config/navigation.ts` |
| `VITE_ENABLE_ANALYTICS` | ❌ | ❌ | `"false"` (in `.env.example`) | Analytics Toggle (Nutzung im Code aktuell **unklar**) | **TODO:** tatsächliche Verwendung im Code verifizieren |
| `VITE_APP_VERSION` | ❌ | ❌ | `"0.1.0"` (in `.env.example`) | UI Versionsanzeige (Nutzung im Code aktuell **unklar**) | **TODO:** tatsächliche Verwendung im Code verifizieren |
| `VITE_SENTRY_DSN` | ❌ | ❌ | — | Sentry DSN (nur sinnvoll, wenn im Code integriert) | **TODO:** tatsächliche Verwendung im Code verifizieren |
| `VITE_ANALYTICS_ID` | ❌ | ❌ | — | Analytics Provider ID (nur sinnvoll, wenn integriert) | **TODO:** tatsächliche Verwendung im Code verifizieren |
| `VITE_ENABLE_AUTH` | ❌ | ❌ | `"false"` (implizit) | Schaltet Auth‑Features in UI frei. Aktuell bewusst deaktiviert. | `src/config/features.ts`, `src/services/api/client.ts`, `src/sw/*`, `src/main.tsx` |
| `VITE_ENABLE_SW_POLLING` | ❌ | ❌ | `"false"` (implizit) | Aktiviert periodische `SW_TICK` Nachrichten in Production Build | `src/main.tsx` |
| `VITE_OFFLINE_QUEUE_MAX_RETRIES` | ❌ | ❌ | `5` | Offline Queue Retry Policy | `src/services/sync/queuePolicy.ts` |
| `VITE_OFFLINE_QUEUE_BASE_DELAY_MS` | ❌ | ❌ | `1000` | Offline Queue Backoff Basis (ms) | `src/services/sync/queuePolicy.ts` |
| `VITE_OFFLINE_QUEUE_MAX_JITTER_MS` | ❌ | ❌ | `250` | Offline Queue Jitter (ms) | `src/services/sync/queuePolicy.ts` |

## Backend: `backend/` (Always-on Node Server) — runtime env

Quelle: `backend/src/config/env.ts` (Zod Schema).
Beispiel-Konfiguration: `backend/.env.example`.

| Variable | Secret | Required | Default | Zweck |
|---|---:|---:|---|---|
| `NODE_ENV` | ❌ | ❌ | `development` | Runtime Mode |
| `PORT` | ❌ | ❌ | `3000` | Legacy/compat (nicht primär genutzt; siehe `BACKEND_PORT`) |
| `DATABASE_PATH` | ❌ | ❌ | `./.data/tradeapp.sqlite` | Legacy/compat |
| `API_BASE_PATH` | ❌ | ❌ | `/api` | API Prefix (Router konstruiert aktuell hart `'/api'`; siehe **TODO** unten) |
| `BACKEND_PORT` | ❌ | ❌ | `3000` | Server Port (wird in `backend/src/config/config.ts` verwendet) |
| `DATABASE_URL` | ✅ (operational) | ❌ | `sqlite:./.data/tradeapp.sqlite` | DB Connection (SQLite default) |
| `LOG_LEVEL` | ❌ | ❌ | `info` | Logging Level |
| `JWT_SECRET` | ✅ | ❌ | `dev-secret` | JWT Verify/Sign Secret (Auth ist optional; ohne Header wird `userId=anon`) |
| `API_KEY` | ✅ | ❌ | — | API-Key Auth (derzeit optional; konkrete Nutzung **TODO**) |
| `VAPID_SUBJECT` | ❌ | ❌ | `mailto:admin@example.com` | Web Push VAPID Subject |
| `VAPID_PUBLIC_KEY` | ❌ | ❌ | — | Web Push VAPID Public Key |
| `VAPID_PRIVATE_KEY` | ✅ | ❌ | — | Web Push VAPID Private Key |
| `OPENAI_API_KEY` | ✅ | ❌ | — | OpenAI Calls (optional, aber erforderlich wenn genutzt) |
| `OPENAI_BASE_URL` | ❌ | ❌ | `https://api.openai.com/v1` | OpenAI Base URL |
| `OPENAI_MODEL_JOURNAL` | ❌ | ❌ | — | Model Override |
| `OPENAI_MODEL_INSIGHTS` | ❌ | ❌ | — | Model Override |
| `OPENAI_MODEL_CHARTS` | ❌ | ❌ | — | Model Override |
| `DEEPSEEK_API_KEY` | ✅ | ❌ | — | DeepSeek Provider |
| `DEEPSEEK_BASE_URL` | ❌ | ❌ | `https://api.deepseek.com` | DeepSeek Base URL |
| `DEEPSEEK_MODEL_REASONING` | ❌ | ❌ | `deepseek-reasoner` | Model |
| `DEEPSEEK_MODEL_ROUTER` | ❌ | ❌ | `deepseek-reasoner` | Router Model |
| `DEEPSEEK_MODEL_ANSWER` | ❌ | ❌ | `deepseek-chat` | Answer Model |
| `OPUS_MODEL` | ❌ | ❌ | — | „Opus“ Model Name (wird über OpenAI endpoint genutzt; siehe `backend/src/clients/opusClient.ts`) |
| `GROK_API_KEY` | ✅ | ❌ | — | Grok (x.ai) API Key |
| `GROK_BASE_URL` | ❌ | ❌ | `https://api.x.ai/v1` | Grok Base URL |
| `MORALIS_API_KEY` | ✅ | ❌ | — | Moralis Solana Gateway (für Pulse Token Metadata) |
| `GROK_PULSE_CRON_SECRET` | ✅ | ❌ | — | Cron-Secret (Grok Pulse Refresh; Details **TODO**) |
| `MAX_DAILY_GROK_CALLS` | ❌ | ❌ | `900` | Budget/Limit |
| `PULSE_TOKEN_ADDRESSES` | ❌ | ❌ | `""` | Komma‑separierte Token Mints für Pulse |
| `PULSE_TICKER_MAP` | ❌ | ❌ | — | Optionales Mapping `"SOL=...,USDC=..."` |
| `KV_REST_API_URL` | ✅ | ❌ | — | Vercel KV URL (optional; Backend hat KV/Store‑Code) |
| `KV_REST_API_TOKEN` | ✅ | ❌ | — | Vercel KV Token |
| `LLM_ROUTER_ENABLED` | ❌ | ❌ | `true` | LLM Router Aktiv |
| `LLM_ROUTER_DEBUG` | ❌ | ❌ | `false` | Debug |
| `LLM_TIMEOUT_MS` | ❌ | ❌ | `20000` | Timeout |
| `LLM_MAX_RETRIES` | ❌ | ❌ | `2` | Retries |
| `LLM_BUDGET_DEFAULT` | ❌ | ❌ | `low` | Budget Tier |
| `LLM_TIER_DEFAULT` | ❌ | ❌ | `free` | Default Tier |
| `LLM_FALLBACK_PROVIDER` | ❌ | ❌ | — | Fallback Provider (`deepseek|openai|grok`) |
| `HELIUS_API_KEY` | ✅ | ✅ | — | Helius Solana Onchain Provider |
| `HELIUS_RPC_URL` | ❌ | ❌ | abgeleitet | Optional RPC URL |
| `HELIUS_DAS_RPC_URL` | ❌ | ❌ | abgeleitet | Optional DAS RPC URL |
| `HELIUS_TIMEOUT_MS` | ❌ | ❌ | abgeleitet | Timeout override |
| `HELIUS_ENHANCED_MAX_PAGES` | ❌ | ❌ | — | Enhanced TX paging cap |
| `HELIUS_ENHANCED_LIMIT` | ❌ | ❌ | — | Enhanced TX page limit |
| `ONCHAIN_TUNING_PROFILE` | ❌ | ❌ | `default` | Onchain gating tuning |
| `WATCHER_INTERVAL_MS` | ❌ | ❌ | `5000` | Watcher Interval (Alerts/Polling intern) |
| `EVALUATION_BATCH_SIZE` | ❌ | ❌ | `200` | Batch Size |
| `EVENT_RETENTION_DAYS` | ❌ | ❌ | `30` | Retention |
| `SSE_HEARTBEAT_MS` | ❌ | ❌ | `20000` | SSE Heartbeat |

**TODO (Drift):** `API_BASE_PATH` ist konfigurierbar, aber der Router in `backend/src/app.ts` konstruiert aktuell `new Router('/api')` fix.

## Backend: `api/` (Vercel Serverless) — runtime env

Quelle: `api/_lib/env.ts` (Zod Schema).

| Variable | Secret | Required (Prod) | Default | Zweck |
|---|---:|---:|---|---|
| `NODE_ENV` | ❌ | ❌ | `development` | Runtime Mode |
| `AUTH_JWT_SECRET` | ✅ | ✅ | (dev default; prod: required) | JWT Sign/Verify Secret |
| `AUTH_JWT_ISSUER` | ❌ | ❌ | `tradeapp-api` | JWT Claim |
| `AUTH_JWT_AUDIENCE` | ❌ | ❌ | `tradeapp-ui` | JWT Claim |
| `AUTH_JWT_CLOCK_TOLERANCE_SECONDS` | ❌ | ❌ | `30` | JWT clock tolerance |
| `KV_REST_API_URL` | ✅ | ❌ | — | Vercel KV URL |
| `KV_REST_API_TOKEN` | ✅ | ❌ | — | Vercel KV Token |
| `KV_REST_API_READ_ONLY_TOKEN` | ✅ | ❌ | — | Read-only Token |
| `CRON_SECRET` | ✅ | ✅ | — | Cron Endpoint Protection (prod guard) |
| `DEXPAPRIKA_API_KEY` | ✅ | ❌ | — | DexPaprika API Key (optional) |
| `DEXPAPRIKA_BASE_URL` | ❌ | ❌ | `https://api.dexpaprika.com` | DexPaprika Base URL |
| `MORALIS_API_KEY` | ✅ | ❌ | — | Moralis API Key |
| `MORALIS_BASE_URL` | ❌ | ❌ | `https://solana-gateway.moralis.io` | Moralis Base URL |
| `ONCHAIN_CONTEXT_PROVIDER_TIMEOUT_MS` | ❌ | ❌ | `1200` | Provider Timeout Budget |
| `ONCHAIN_CONTEXT_TOTAL_BUDGET_MS` | ❌ | ❌ | `2000` | Total Budget |
| `OPENAI_API_KEY` | ✅ | ❌ | — | OpenAI |
| `OPENAI_BASE_URL` | ❌ | ❌ | — | OpenAI Base URL |
| `OPENAI_MODEL_JOURNAL` | ❌ | ❌ | — | Model Override |
| `OPENAI_MODEL_INSIGHTS` | ❌ | ❌ | — | Model Override |
| `OPENAI_MODEL_CHARTS` | ❌ | ❌ | — | Model Override |
| `DEEPSEEK_API_KEY` | ✅ | ❌ | — | DeepSeek |
| `DEEPSEEK_BASE_URL` | ❌ | ❌ | — | DeepSeek Base URL |
| `DEEPSEEK_MODEL_REASONING` | ❌ | ❌ | — | Model |
| `GROK_API_KEY` | ✅ | ❌ | — | Grok |
| `GROK_BASE_URL` | ❌ | ❌ | — | Grok Base URL |
| `GROK_MODEL_PULSE` | ❌ | ❌ | — | Grok Model |
| `GROK_PULSE_REFRESH_SECRET` | ✅ | ❌ | — | Pulse Refresh Secret |
| `OPUS_MODEL` | ❌ | ❌ | — | Model Name |
| `REASONING_BACKEND_URL` | ❌ | ❌ | — | Optional Upstream/Proxy für Reasoning (**TODO:** genaue Nutzung verifizieren) |
| `AUTO_CAPTURE_ENABLED` | ❌ | ❌ | `false` | Phase B Feature Flag |
| `AUTO_CAPTURE_INTELLIGENCE_ENABLED` | ❌ | ❌ | `false` | Phase C Feature Flag |
| `SYMBOL_RESOLUTION_ENABLED` | ❌ | ❌ | `false` | Feature Flag |
| `HELIUS_WEBHOOK_SECRET` | ✅ | abhängig | — | Helius Webhook Verification (nur wenn Auto Capture aktiv) |
| `HELIUS_API_KEY` | ✅ | abhängig | — | Helius API Key (nur wenn Auto Capture aktiv) |
| `HELIUS_WEBHOOK_ID` | ✅ | abhängig | — | Helius Webhook ID (nur wenn Auto Capture aktiv) |
| `HELIUS_SOURCE_LABEL` | ❌ | ❌ | `helius` | Label |

## Service: `apps/backend-alerts/` — runtime env

Quelle: `apps/backend-alerts/src/env.ts` (Zod Schema).

| Variable | Secret | Required | Default | Zweck |
|---|---:|---:|---|---|
| `PORT` | ❌ | ❌ | `3000` | HTTP Port |
| `NODE_ENV` | ❌ | ❌ | `development` | Runtime Mode |
| `DATABASE_URL` | ✅ | ✅ | — | Postgres Connection String |
| `API_KEY` | ✅ | ✅ | — | Bearer Token für geschützte Endpoints |
| `VAPID_SUBJECT` | ❌ | ✅ | — | Web Push VAPID Subject |
| `VAPID_PUBLIC_KEY` | ❌ | ✅ | — | Web Push VAPID Public Key |
| `VAPID_PRIVATE_KEY` | ✅ | ✅ | — | Web Push VAPID Private Key |
| `WATCHER_INTERVAL_MS` | ❌ | ❌ | `5000` | Watcher Loop |
| `EVALUATION_BATCH_SIZE` | ❌ | ❌ | `200` | Batch size |
| `EVENT_RETENTION_DAYS` | ❌ | ❌ | `30` | Retention |
| `SSE_HEARTBEAT_MS` | ❌ | ❌ | `20000` | SSE Heartbeat |
| `ERROR_DEDUPE_MINUTES` | ❌ | ❌ | `10` | Error dedupe window |

