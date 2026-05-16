---
Owner: DevOps Team
Status: active
Version: 1.0
LastUpdated: 2026-05-16
Canonical: true
---

# Deployment

## Production Routing (Frontend)

**Source:** `vercel.json`

- Frontend is deployed as a Vite SPA.
- Build command: `pnpm run build`
- Output directory: `dist`
- Production rewrite: `/api/(.*)` → `https://$VERCEL_BACKEND_URL/api/$1`
- All other paths rewrite to `/index.html`

```mermaid
flowchart LR
    Browser["Browser"] --> Vercel["Vercel SPA Hosting\ndist/"]
    Vercel -->|"rewrite /api/(.*)"| Backend["Railway backend\nbackend/"]
    Browser -. "registerSW() in PROD" .-> SW["Service Worker"]
    SW -->|"alerts/events + oracle/daily\nwhen messaged"| Backend
    Backend --> DB["SQLite / Postgres"]
    Backend --> Providers["Jupiter / Helius / LLM / Market data"]
    Vercel -. "optional separate project" .-> ApiFns["api/ Vercel Functions"]
    Vercel -. "separate deployable" .-> AlertsSvc["apps/backend-alerts"]
```

**Consequence:** Production API traffic from the SPA always targets same-origin `/api/*` and is server-side rewritten to the canonical backend.

## Backend Hosting (Railway)

**Source:** `railway.toml`

- Root directory: `backend`
- Builder: Docker
- Start command: `node dist/server.js`
- Health check: `/api/health`

This is an always-on Node process, not a serverless deployment.

## Additional Deployables

### `apps/backend-alerts/`
- separate service with its own `apps/backend-alerts/railway.toml`
- start command: `pnpm start`
- health check: `/health`

### `api/` (Vercel Functions Backend)
- implemented in the repo
- deployable as a separate Vercel project
- not canonical for this frontend while the root `vercel.json` owns `/api/*`

## Guardrails Against API Drift

**Source:** `scripts/verify-vercel-api-ownership.mjs`

Policy:
- no relative `/api/*` rewrite destinations in production
- no `/api` rewrite exceptions
- `api/` ownership must stay explicit and mechanically verifiable

Goal:
- prevent mixed ownership such as “half external backend, half Vercel Functions”

## Local vs Production Differences

| Topic | Local | Production |
|-------|-------|------------|
| API Routing | Vite Proxy `/api` → `http://localhost:3000` | Vercel Rewrite `/api/(.*)` → `https://$VERCEL_BACKEND_URL/api/$1` |
| Backend Runtime | `backend/` Node server via `pnpm -C backend dev` | External hosted Node server via Railway |
| Service Worker | not registered | registered via `virtual:pwa-register` |
| SW Data Fetching | not active | handler exists, but polling remains message-driven (`SW_TICK`) |

**Observed:** The current repo does **not** reference a `VITE_ENABLE_SW_POLLING` flag. Production SW registration is unconditional; actual polling depends on worker messages.

## Feature Flags

### `VITE_RESEARCH_EMBED_TERMINAL`
- default: `false`
- enables the Embedded Terminal inside Research

### `VITE_SENTRY_DSN`
- default: unset
- initializes Sentry in production and development-safe no-op mode otherwise

### Other runtime flags
See `shared/docs/ENVIRONMENT.md` for the full matrix.

## Monitoring & Error Tracking

### Sentry Integration
- initialized in `src/lib/monitoring/sentry.ts`
- tagged with current route and the `VITE_RESEARCH_EMBED_TERMINAL` flag
- browser tracing + replay enabled when DSN is configured
- expected offline fetch failures are filtered before send

## Pre-Beta Hardening

### Error Boundaries
- global app boundary
- dedicated Terminal boundary
- dedicated Discover boundary
- guarded Embedded Terminal inside Research

### Safety Warnings
- slippage warning above 5%
- priority fee warning above 50k microLamports
- both remain informational, not blocking

## Environment Variables

Key deployment variables:
- `VERCEL_BACKEND_URL`
- `VITE_RESEARCH_EMBED_TERMINAL`
- `VITE_SENTRY_DSN`
- `VITE_SOLANA_CLUSTER`
- `VITE_SOLANA_RPC_URL`

See [Environment](../shared/docs/ENVIRONMENT.md) for details.

## Health Checks

**Backend**
- `/api/health`
- used by Railway deployment health verification

**Frontend**
- no dedicated health endpoint
- SPA rewrite serves all client routes through `index.html`

## Related Documentation

- [Architecture](./ARCHITECTURE.md)
- [Environment](../shared/docs/ENVIRONMENT.md)
- [Security](./SECURITY.md)
