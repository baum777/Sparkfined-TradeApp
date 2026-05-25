---
Owner: Security Team
Status: active
Version: 1.1
LastUpdated: 2026-05-09
Canonical: true
---

# Security (Ist-Zustand)

## Authentifizierung

### Frontend

- Auth ist aktuell **bewusst deaktiviert** (`VITE_ENABLE_AUTH !== "true"`).
- `AuthService` existiert als Stub, blockiert jedoch Netz-Calls, wenn Auth disabled ist (`src/services/auth/auth.service.ts`).

### Backend `backend/` (Node Server)

- Router extrahiert JWT aus `Authorization: Bearer <token>` oder `access_token` Cookie und setzt `req.userId = sub`.
- Ohne gültigen Token läuft alles als `userId = "anon"` (siehe `backend/src/http/router.ts`).
- Credentials-basierte Auth (`auth_users_v1`) mit bcrypt-Hashing (salt rounds 12) für Register/Login.
- JWT Secret: `JWT_SECRET`; in Production muss es gesetzt sein, darf nicht `dev-secret` sein und muss mind. 32 Zeichen haben.
- CSRF-Schutz für state-changing Cookie-Auth Requests via Double-Submit (`csrf_token` Cookie + `x-csrf-token` Header).
- CORS nutzt Origin-Whitelist über `BACKEND_CORS_ORIGINS`.

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

- Einheitlicher Counter-Store für HTTP-Limits und globale User/IP-Limits (`backend/src/lib/rateLimit/store.ts`).
- Backend-Limits sind pro Scope/Path/User definiert (`backend/src/http/rateLimit.ts`, `backend/src/lib/rateLimit/limiter.ts`).
- Store-Auswahl über `RATE_LIMIT_STORE=memory|redis`; in Production ist `redis` verpflichtend.
- `REDIS_URL` ist in Production verpflichtend, wenn `RATE_LIMIT_STORE=redis`.

### `api/`

- KV‑backed rate limiting (`api/_lib/rate-limit.ts`).
- Zusätzlich existiert ein globales IP/User Rate Limit (Keys `rl:v1:...`; Kommentar weist auf Prefix/Kompatibilitätsrisiko hin).

## Request IDs / Logging

- `x-request-id` wird serverseitig gesetzt:
  - `backend/`: `backend/src/http/requestId.ts` + `backend/src/http/response.ts`
  - `api/`: `api/_lib/request-id.ts` + `api/_lib/response.ts`
- `backend/` Logger schreibt strukturierte JSON-Logs mit Redaction sensibler Felder (`authorization`, `token`, `secret`, `cookie`, etc.).
- Provider-Calls enthalten zusätzliche Prompt-Redaction/Sanitizing-Regeln.

## CI/CD Security Gates

- CI blockiert bei High/Critical Dependency Findings (`pnpm audit`) in `.github/workflows/ci.yml`.
- SAST läuft verpflichtend als CodeQL-Job (`codeql-sast`) im selben CI-Workflow.

## Incident Response (Owner Gate)

- Incident Response ist Security-Team-owned.
- Ein verbindlicher Kontaktkanal (On-Call Alias/Channel) ist **noch nicht in diesem Repo hinterlegt**.
- Bis dieser Kanal vom Owner freigegeben ist, darf keine feste externe Kontaktadresse in diese Doku aufgenommen werden.
- Mindestprozess bis zur Owner-Freigabe:
  - Security-relevanten Vorfall intern als P0 markieren.
  - Reproduzierbare Evidenz + betroffene Surface (`backend`, `api`, `apps/backend-alerts`) dokumentieren.
  - Security Team als Owner zur Kanal-Freigabe und Priorisierung anfordern.

## Cron / interne Endpoints

- `api/` hat einen Production Guard, der `CRON_SECRET` in Production erzwingt (`api/_lib/env.ts`).
- `backend/` hat `GROK_PULSE_CRON_SECRET` als optionalen Secret (genaue Verwendung **TODO**).

## TODOs / Risiken

- ~~**TODO:** Einheitliche Auth-Policy zwischen Frontend + dem tatsächlich in Production genutzten Backend.~~ → **IN PROGRESS**: Siehe `SECURITY_HARDENING_ROADMAP.md` für Implementierungsplan
- ~~**TODO:** JWT Secret Rotation-Prozess dokumentieren.~~ → **ERLEDIGT**: Script verfügbar unter `scripts/rotate-jwt-secret.mjs`
- **TODO:** Security Team muss verbindlichen Incident-Response-Kontaktkanal freigeben. → **BLOCKED**: Wartet auf Owner-Freigabe
