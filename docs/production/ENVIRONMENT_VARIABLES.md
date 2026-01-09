## Environment Variables — TradeApp (Production)

Diese Datei listet **alle aktuell im Repo referenzierten** Env Vars + empfohlene Production-Härtung.

---

## Übersicht (Frontend vs Backend)

| Bereich | Mechanismus | Wichtig in Vercel |
|---|---|---|
| Frontend (Vite) | `import.meta.env.VITE_*` | **Build-time** (Values werden in das Bundle eingebettet). |
| Backend (Node) | `process.env` (zod schema) | **Runtime** (bei Vercel Functions: Runtime Env; bei externem Backend: Provider-seitig). |
| Service Worker | kein Env Zugriff (im Browser) | Aktuell hardcoded `"/api"` als API-Basis. |

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
- **[ ]** `VITE_API_URL` nur auf `"/api"` setzen, wenn `/api` auf Vercel garantiert korrekt geroutet ist (Rewrite/Functions).

---

## Backend (Node) — Runtime Env

| Name | Required | Secret? | Default | Scope | Verwendet in |
|---|---:|---:|---|---|---|
| `NODE_ENV` | ✅ | ❌ | `development` | Runtime | `backend/src/config/env.ts` |
| `BACKEND_PORT` | ✅ (nur für Server-Mode) | ❌ | `3000` | Runtime | `backend/src/config/env.ts` |
| `API_BASE_PATH` | ✅ | ❌ | `"/api"` | Runtime | `backend/src/config/env.ts` |
| `DATABASE_URL` | ✅ | ✅ (operationally sensitive) | `sqlite:./.data/tradeapp.sqlite` | Runtime | `backend/src/config/env.ts`, `backend/src/config/config.ts` |
| `LOG_LEVEL` | ✅ | ❌ | `info` | Runtime | `backend/src/config/env.ts` |

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

**Wichtige Production-Hinweise**
- **`DATABASE_URL`**:
  - Aktueller Default ist **lokal** (`sqlite:./.data/...`) → auf Vercel nicht persistent.
  - Für Production muss eine persistente DB gewählt werden; das wird voraussichtlich neue/andere Env Vars erfordern (z.B. `POSTGRES_URL`, `DATABASE_URL` im Postgres-Format etc.).
- **`BACKEND_PORT`**:
  - Für Vercel Functions i.d.R. irrelevant (kein `listen()`), für extern gehosteten Server relevant.

---

## Service Worker (Browser-Kontext)

Aktuell **keine** Env Vars; API-Base ist hardcoded:
- Alerts: `API_BASE = "/api"` in `src/sw/sw-alerts.ts`
- Oracle: `API_BASE = "/api"` in `src/sw/sw-oracle.ts`

**Production-Risiko**
- Wenn Backend external ist und nicht same-origin unter `/api` liegt, bricht SW-Polling (und ggf. CORS/Auth).

---

## “Missing by design” (wahrscheinlich nötig für echte Production)

Diese Variablen sind **nicht** im Code, aber werden typischerweise benötigt, sobald Auth/Users/Secrets “real” sind:
- **[ ]** JWT verify secret / public key / issuer / audience
- **[ ]** Session/Cookie secrets (falls cookies)
- **[ ]** Rate-limit store URL (Redis/Upstash)
- **[ ]** Error tracking DSN für Backend (nicht als `VITE_*`, sondern server-seitig)

