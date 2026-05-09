---
Owner: DevOps Team
Status: active
Version: 1.1
LastUpdated: 2026-05-09
Canonical: true
---

# Deployment

**Last Updated:** 2026-05-09

---

## Production Routing (Frontend)

**Source:** `vercel.json`

- Frontend built as Vite SPA (`buildCommand: "npm run build"`, output `dist/`)
- **Rewrite Rule:**
  - `source: /api/(.*)`
  - `destination: https://$VERCEL_BACKEND_URL/api/$1`
- All other paths rewrite to `/index.html` (SPA routing)

**Consequence:**
- Production API calls go to `/api/*` (same-origin) and are server-side rewritten by Vercel to external backend.

---

## Backend Hosting (Railway)

**Source:** `railway.toml` (repo root)

- Deploys `backend/` as Docker service:
  - Dockerfile: `backend/Dockerfile`
  - Start: `node dist/backend/src/server.js`
  - Healthcheck: `/api/health`

**Important:** This is an always-on process (not Vercel Functions compatible).

---

## Backend Hosting (Fly.io Alternative)

**Source:** `fly.toml` (repo root)

- Deploys the canonical `backend/` via Dockerfile (`backend/Dockerfile`)
- HTTP Health Check: `GET /api/health`
- Runs as always-on service (`min_machines_running = 1`, `auto_stop_machines = "off"`)
- Uses persistent volume mount for SQLite: `/app/backend/.data`

### Minimal Setup

1. Install and authenticate:
   - `fly auth login`
2. Create app (or adjust `app` in `fly.toml` first):
   - `fly apps create <unique-app-name>`
3. Create persistent volume (same region as `primary_region`):
   - `fly volumes create backend_data --region <region> --size 5`
4. Set required secrets/env:
   - `fly secrets set JWT_SECRET="<>=32chars" HELIUS_API_KEY="<...>" REDIS_URL="<...>"`
   - `fly secrets set BACKEND_CORS_ORIGINS="https://<frontend-domain>"`
5. Deploy:
   - `fly deploy --ha=false`

### Single-Instance Requirement

- Wegen in-memory Discover Cache und internen Scheduler-Jobs muss das Backend aktuell als **eine Instanz** laufen.
- Auf Fly: initial mit `fly deploy --ha=false` und danach bei Bedarf explizit auf 1 Maschine halten:
  - `fly scale count 1`

---

## Additional Deployables

### `apps/backend-alerts/`
- Separate service (Express + Postgres + Watcher/SSE/Push)
- Own Railway configuration and start scripts

### `api/` (Vercel Functions Backend)
- Implemented in repo, but **not canonical** for this frontend project
- Can be deployed as separate Vercel project, but not used while `vercel.json` rewrites `/api/*` to `VERCEL_BACKEND_URL`

---

## Guardrails Against API Drift

**Source:** `scripts/verify-vercel-api-ownership.mjs`

**Policy:**
- In production, no `/api/*` subpath may point to relative `/api/*` destinations (would activate Vercel Functions)
- No `/api` rewrite exceptions allowed (allowlist is empty)

**Goal:**
- API ownership remains clear, prevents "half Vercel Functions, half external backend"

---

## Local vs Production Differences

| Topic | Local | Production |
|-------|-------|------------|
| API Routing | Vite Proxy `/api` → `http://localhost:3000` | Vercel Rewrite `/api/(.*)` → `https://$VERCEL_BACKEND_URL/api/$1` |
| Backend Runtime | `backend/` Node Server (listen) | External hosted Node Server (Railway oder Fly.io) |
| Service Worker | Dev: not registered | Production Build: registered optionally (see `VITE_ENABLE_SW_POLLING`) |

---

## Feature Flags

### `VITE_RESEARCH_EMBED_TERMINAL`
- **Default:** `false`
- **Purpose:** Enable Trading Terminal in Research tab
- **Behavior:** When `true`, Terminal appears as collapsible drawer in Research
- **Rollback:** Set to `false` to disable instantly

### `VITE_SENTRY_DSN`
- **Default:** Not set (Sentry disabled)
- **Purpose:** Error tracking in production
- **Format:** `https://<key>@<org>.ingest.sentry.io/<project>`
- **Behavior:** If not set, Sentry is no-op (dev-friendly)

### Other Flags
See `shared/docs/ENVIRONMENT.md` for complete list.

---

## Monitoring & Error Tracking

### Sentry Integration

**Setup:**
1. Create Sentry project
2. Set `VITE_SENTRY_DSN` in production environment
3. Errors automatically captured from ErrorBoundary

**Features:**
- Environment tagging (production/development)
- Feature flag tagging (`VITE_RESEARCH_EMBED_TERMINAL`)
- Route tracking (updates on navigation)
- Browser tracing integration
- Session replay integration (masked)
- Before-send filtering (ignores expected errors)

**Sourcemaps (Optional):**
- Build with `--sourcemap` flag
- Upload via `@sentry/cli` or Vite plugin
- Required for readable stack traces in production

---

## Pre-Beta Hardening

### Error Boundaries
- Global boundary wraps entire app
- Terminal page has dedicated boundary
- Discover Overlay has dedicated boundary
- Research embedded terminal has dedicated boundary
- Fallback UI with error ID, reset, and reload actions

### Safety Warnings
- **Slippage Warning:** Shows when slippage >5% (500 bps)
- **Priority Fee Warning:** Shows when priority fee >50k microLamports
- Both warnings are informational (non-blocking)

See `PRE_BETA_HARDENING_SUMMARY.md` for implementation details.

---

## Environment Variables

**Complete List:** `shared/docs/ENVIRONMENT.md`

**Key Variables:**
- `VERCEL_BACKEND_URL` - Backend hostname for `/api/*` rewrite
- `VITE_RESEARCH_EMBED_TERMINAL` - Trading Terminal in Research integration flag
- `VITE_SENTRY_DSN` - Sentry DSN for error tracking
- `VITE_SOLANA_CLUSTER` - devnet | mainnet-beta
- `VITE_SOLANA_RPC_URL` - Custom RPC endpoint (optional)

---

## Health Checks

**Backend:**
- Endpoint: `/api/health`
- Used by Railway/Fly.io for health checks

**Frontend:**
- No explicit health check endpoint
- SPA routing handles all paths

---

## Related Documentation

- [Architecture](./ARCHITECTURE.md) - System architecture
- [Environment](../shared/docs/ENVIRONMENT.md) - Complete env var list
- [Security](./SECURITY.md) - Security constraints
