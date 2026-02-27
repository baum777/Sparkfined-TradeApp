---
Owner: Security Team
Status: active
Version: 1.0
LastUpdated: 2026-02-27
Canonical: true
---

# Security (Ist-Zustand)

## Authentifizierung

### Frontend

- Auth ist aktuell **bewusst deaktiviert** (`VITE_ENABLE_AUTH !== "true"`).
- `AuthService` existiert als Stub, blockiert jedoch Netz-Calls, wenn Auth disabled ist (`src/services/auth/auth.service.ts`).

### Backend `backend/` (Node Server)

- Router extrahiert optional einen JWT aus `Authorization: Bearer <token>` und setzt dann `req.userId = sub`.
- Ohne gültigen Token läuft alles als `userId = "anon"` (siehe `backend/src/http/router.ts`).
- JWT Secret: `JWT_SECRET` (Default `dev-secret`, was production-unsafe ist).

### Backend `api/` (Vercel Functions)

- Auth ist standardmäßig **required** pro Handler (`api/_lib/handler.ts`), außer RouteConfig setzt `auth: "none"`.
- JWT Validation: HS256 + issuer + audience (`api/_lib/auth/jwt.ts`).
- Prod-Secret: `AUTH_JWT_SECRET` muss mind. 32 Zeichen haben (`api/_lib/env.ts`).

### Service `apps/backend-alerts/`

- Simple API-Key Auth:
  - Request Header: `Authorization: Bearer <token>`
  - Token muss exakt `API_KEY` entsprechen (`apps/backend-alerts/src/auth/authMiddleware.ts`)

## Auth Behavior Matrix (Backend vs API)

| Surface | Default Auth | JWT Required | Config Location | Notes |
|---------|--------------|--------------|-----------------|-------|
| `backend/` (canonical) | anon-default | per-route optional | `backend/src/http/router.ts` | Extracts JWT if present, else `userId = "anon"` |
| `api/` (Vercel) | required | default required | `api/_lib/handler.ts` | RouteConfig can set `auth: "none"` to disable |
| `apps/backend-alerts/` | API-Key | always required | `apps/backend-alerts/src/auth/authMiddleware.ts` | Simple Bearer token match against `API_KEY` |

**Rule:** Differences must be intentional and explicitly documented. Clients must handle 401/403 appropriately based on target surface.

## Secret Handling

- **Keine Secrets in `VITE_*`** (landen im Frontend Bundle).
- Secrets gehören in runtime env der jeweiligen Backend-Runtime:
  - `backend/`: `process.env.*` (geladen via `dotenv`)
  - `api/`: Vercel Runtime Env
  - `apps/backend-alerts/`: `process.env.*` (dotenv)

## Rate Limiting

### `backend/`

- In-memory rate limiter (`backend/src/http/rateLimit.ts`), inkl. `setInterval` Cleanup.
- Limits sind pro Path+userId definiert (journal/alerts/oracle/ta/reasoning).
- **Production Hinweis:** in-memory ist nicht cluster-safe (TODO: Redis/KV-backed).

### `api/`

- KV‑backed rate limiting (`api/_lib/rate-limit.ts`).
- Zusätzlich existiert ein globales IP/User Rate Limit (Keys `rl:v1:...`; Kommentar weist auf Prefix/Kompatibilitätsrisiko hin).

## Request IDs / Logging

- `x-request-id` wird serverseitig gesetzt:
  - `backend/`: `backend/src/http/requestId.ts` + `backend/src/http/response.ts`
  - `api/`: `api/_lib/request-id.ts` + `api/_lib/response.ts`
- Logging existiert in beiden Backends; Provider-Calls enthalten explizite Regeln, keine Secrets zu loggen (z.B. LLM Router Prompt-Redactions).

## Cron / interne Endpoints

- `api/` hat einen Production Guard, der `CRON_SECRET` in Production erzwingt (`api/_lib/env.ts`).
- `backend/` hat `GROK_PULSE_CRON_SECRET` als optionalen Secret (genaue Verwendung **TODO**).

## TODOs / Risiken

- **TODO:** Einheitliche Auth-Policy zwischen Frontend + dem tatsächlich in Production genutzten Backend.
- **TODO:** Production-Härtung für `backend/` JWT_SECRET (kein Default) + Secret Rotation.
- **TODO:** Cluster-sicheres Rate Limiting für `backend/` (Redis/KV).

