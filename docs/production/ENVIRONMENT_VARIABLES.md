## Environment Variables — TradeApp (Production)

Diese Datei listet **alle aktuell im Repo referenzierten** Env Vars + empfohlene Production-Härtung.

---

## Übersicht (Frontend vs Backend)

| Bereich | Mechanismus | Wichtig in Vercel |
|---|---|---|
| Frontend (Vite) | `import.meta.env.VITE_*` | **Build-time** (Values werden in das Bundle eingebettet). |
| Backend (Node) | `process.env` (zod schema) | **Runtime** (bei Vercel Functions: Runtime Env; bei externem Backend: Provider-seitig). |
| Service Worker | via Vite gebundled: `import.meta.env.VITE_*` | **Build-time** (Service Worker wird mitgebaut und kann `VITE_*` nutzen). |
| Vercel Routing | `vercel.json` `{env:...}` | **Runtime** (Rewrites laufen serverseitig bei Vercel). |

---

## Frontend (Vite) — `VITE_*`

> Hinweis: Diese Werte sind **öffentlich**, weil sie im JS-Bundle landen. **Nie** Secrets als `VITE_*` setzen.

| Name | Required | Secret? | Default/Derivation | Scope | Verwendet in |
|---|---:|---:|---|---|---|
| `VITE_API_URL` | ✅ | ❌ | fallback `"/api"` | Build-time | `src/services/api/client.ts` |
| `VITE_ENABLE_DEV_NAV` | ✅ (für kontrolliertes Verhalten) | ❌ | (kein Default; Code vergleicht mit `"true"`) | Build-time | `src/config/navigation.ts`, `src/pages/Settings.tsx` |
| `VITE_ENABLE_ANALYTICS` | ❌ | ❌ | `.env.example` → `false` | Build-time | (aktuell nicht eindeutig genutzt; nur dokumentiert) |
| `VITE_APP_VERSION` | ❌ | ❌ | `.env.example` → `0.1.0` | Build-time | (aktuell nicht eindeutig genutzt; nur dokumentiert) |
| `VITE_SENTRY_DSN` | ❌ | ❌ | leer | Build-time | (nur dokumentiert) |
| `VITE_ANALYTICS_ID` | ❌ | ❌ | leer | Build-time | (nur dokumentiert) |

**Flags/Checks (Production)**
- **[ ]** `VITE_ENABLE_DEV_NAV="false"` setzen (fail-safe: Dev Screens nicht exponieren).
- **[ ]** `VITE_API_URL="/api"` in **Vercel Production + Preview** setzen, wenn `/api` via Rewrite auf das Railway-Backend zeigt (Same-Origin).
- **[ ]** **Keine Secrets im Repo**: alle Env Vars in Vercel/Railway UI setzen, nicht committen.

---

## Backend (Node) — Runtime Env

| Name | Required | Secret? | Default | Scope | Verwendet in |
|---|---:|---:|---|---|---|
| `NODE_ENV` | ✅ | ❌ | `development` | Runtime | `backend/src/config/env.ts` |
| `PORT` | ✅ (für Railway/Provider) | ❌ | `3000` | Runtime | `backend/src/config/env.ts`, `backend/src/config/config.ts` |
| `BACKEND_PORT` | ✅ (nur für Server-Mode) | ❌ | `3000` | Runtime | `backend/src/config/env.ts` |
| `API_BASE_PATH` | ✅ | ❌ | `"/api"` | Runtime | `backend/src/config/env.ts` |
| `DATABASE_URL` | ✅ | ✅ (operationally sensitive) | `sqlite:./.data/tradeapp.sqlite` | Runtime | `backend/src/config/env.ts`, `backend/src/config/config.ts` |
| `LOG_LEVEL` | ✅ | ❌ | `info` | Runtime | `backend/src/config/env.ts` |
| `HELIUS_API_KEY` | ✅ (für Solana Onchain via Helius) | ✅ | — | Runtime | `backend/src/config/env.ts`, `backend/src/domain/solOnchain/adapters/helius.ts` |
| `HELIUS_RPC_URL` | ❌ | ❌ | `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}` | Runtime | `backend/src/domain/solOnchain/adapters/helius.ts` |
| `HELIUS_DAS_RPC_URL` | ❌ | ❌ | Default wie `HELIUS_RPC_URL` (JSON-RPC `getAsset`) | Runtime | `backend/src/domain/solOnchain/adapters/helius.ts` |
| `HELIUS_TIMEOUT_MS` | ❌ | ❌ | Fallback `LLM_TIMEOUT_MS` | Runtime | `backend/src/domain/solOnchain/adapters/helius.ts` |
| `HELIUS_ENHANCED_MAX_PAGES` | ❌ | ❌ | `6` | Runtime | `backend/src/config/env.ts`, `backend/src/domain/solOnchain/getOnchainProvider.ts` |
| `HELIUS_ENHANCED_LIMIT` | ❌ | ❌ | `100` | Runtime | `backend/src/config/env.ts`, `backend/src/domain/solOnchain/getOnchainProvider.ts` |
| `ONCHAIN_TUNING_PROFILE` | ❌ | ❌ | `default` (`default|conservative|aggressive`) | Runtime | `backend/src/config/env.ts`, `backend/src/domain/solChartAnalysis/orchestrator.ts` |

**Hinweis (Determinismus/Cache):**
- Änderungen an `HELIUS_ENHANCED_MAX_PAGES` / `HELIUS_ENHANCED_LIMIT` ändern den Provider-Fingerprint (inkl. `flows:v2`) und damit Onchain-CacheKeys, um Cache-Drift zu vermeiden.

---

## AI / LLM Router (Backend-only)

> Diese Werte sind **Secrets / runtime-only**. **Nie** als `VITE_*` setzen.

| Name | Required | Secret? | Default | Scope | Verwendet in |
|---|---:|---:|---|---|---|
| `DEEPSEEK_API_KEY` | ✅ (wenn Router/DeepSeek genutzt) | ✅ | — | Runtime | `backend/src/config/env.ts`, `backend/src/lib/llm/providers/deepseek.ts` |
| `DEEPSEEK_BASE_URL` | ❌ | ❌ | `https://api.deepseek.com` | Runtime | `backend/src/config/env.ts` |
| `DEEPSEEK_MODEL_ROUTER` | ❌ | ❌ | `deepseek-reasoner` | Runtime | `backend/src/config/env.ts` |
| `DEEPSEEK_MODEL_ANSWER` | ❌ | ❌ | `deepseek-chat` | Runtime | `backend/src/config/env.ts` |
| `OPENAI_API_KEY` | ❌ | ✅ | — | Runtime | `backend/src/config/env.ts`, `backend/src/lib/llm/providers/openai.ts` |
| `OPENAI_BASE_URL` | ❌ | ❌ | `https://api.openai.com/v1` | Runtime | `backend/src/config/env.ts` |
| `GROK_API_KEY` | ❌ | ✅ | — | Runtime | `backend/src/config/env.ts`, `backend/src/lib/llm/providers/grok.ts` |
| `GROK_BASE_URL` | ❌ | ❌ | `https://api.x.ai/v1` | Runtime | `backend/src/config/env.ts` |
| `LLM_ROUTER_ENABLED` | ❌ | ❌ | `true` | Runtime | `backend/src/config/env.ts`, `backend/src/routes/llm.ts` |
| `LLM_ROUTER_DEBUG` | ❌ | ❌ | `false` | Runtime | `backend/src/config/env.ts` |
| `LLM_TIMEOUT_MS` | ❌ | ❌ | `20000` | Runtime | `backend/src/config/env.ts` |
| `LLM_MAX_RETRIES` | ❌ | ❌ | `2` | Runtime | `backend/src/config/env.ts` |
| `LLM_BUDGET_DEFAULT` | ❌ | ❌ | `low` | Runtime | `backend/src/config/env.ts` |
| `LLM_TIER_DEFAULT` | ❌ | ❌ | `free` | Runtime | `backend/src/config/env.ts`, `backend/src/lib/llm/tierPolicy.ts` |

**Wichtige Production-Hinweise**
- **`DATABASE_URL`**:
  - Lokal: `sqlite:./.data/tradeapp.sqlite`
  - Production: **Postgres** (z.B. Railway/Neon/Supabase), Format: `postgres://user:pass@host:5432/db`
  - SQLite ist nicht persistent bei Container-Restarts → **nicht** für Production verwenden.
- **`BACKEND_PORT`**:
  - Für Vercel Functions i.d.R. irrelevant (kein `listen()`), für extern gehosteten Server relevant.

---

## Tier Policy (LLM) — Kurzüberblick

Das Backend unterstützt ein **striktes Tier-System** zur Kontrolle von **Kosten, Latenz, Token-Limits und Provider-Rechten**:

- **Tiers**: `free`, `standard`, `pro`, `high`
- **Default**: `LLM_TIER_DEFAULT` (falls Request kein `tier` setzt)
- **Wichtig (free)**:
  - **OpenAI** ist **nur** erlaubt für `taskKind in ["journal_teaser","chart_teaser"]` und wird auf **S/R + Stoploss** (Bullet-Liste) begrenzt.
  - **Grok** ist **nur** erlaubt für `taskKind="sentiment_alpha"` und wird **kurz** gehalten (<= 200 Tokens).
- **Hinweis zu `LLM_TIMEOUT_MS` / `LLM_MAX_RETRIES`**:
  - Werden server-seitig als **globale Kappen/Overrides** verwendet; zusätzlich greifen tier-spezifische Defaults.

---

## Service Worker (Browser-Kontext)

Der Service Worker wird von Vite mitgebaut und kann deshalb `import.meta.env.VITE_*` nutzen:
- Alerts: `API_BASE = import.meta.env.VITE_API_URL || "/api"` in `src/sw/sw-alerts.ts`
- Oracle: `API_BASE = import.meta.env.VITE_API_URL || "/api"` in `src/sw/sw-oracle.ts`

**Production-Risiko**
- Wenn Backend external ist und nicht same-origin unter `/api` liegt, bricht SW-Polling (und ggf. CORS/Auth).

---

## Vercel Routing — `vercel.json` Rewrite

Der Rewrite in `vercel.json` leitet `/api/*` an das Railway-Backend weiter. **Wichtig**: `VERCEL_BACKEND_URL` muss gesetzt sein.

**TODO vor Deploy**
- Setze `VERCEL_BACKEND_URL` in Vercel (z.B. `tradeapp-backend-production.up.railway.app`).

---

## “Missing by design” (wahrscheinlich nötig für echte Production)

Diese Variablen sind **nicht** im Code, aber werden typischerweise benötigt, sobald Auth/Users/Secrets “real” sind:
- **[ ]** JWT verify secret / public key / issuer / audience
- **[ ]** Session/Cookie secrets (falls cookies)
- **[ ]** Rate-limit store URL (Redis/Upstash)
- **[ ]** Error tracking DSN für Backend (nicht als `VITE_*`, sondern server-seitig)
