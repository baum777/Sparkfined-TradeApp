# Backend Ownership Decision

## Decision

- **Canonical production backend**: `backend/` (always-on Node server)
- **Production host**: Railway
- **Frontend access**: Vercel rewrites `/api/*` to the Railway backend
- **`api/`**: alternative implementation for serverless experiments and tests
- **`apps/backend-alerts/`**: optional microservice for alerts/push if separated later

## Rationale

- `backend/` is the most complete implementation (routes, jobs, scheduler, DB).
- Railway supports always-on servers, cron jobs, and managed Postgres.
- Vercel Functions require a major refactor of `backend/` (documented elsewhere).

## Scope and Expectations

- `backend/` defines the source of truth for runtime behavior in production.
- `api/` can diverge for testing or alternative deployment, but must not drive production behavior.
- `apps/backend-alerts/` is not required for the v1 production path unless explicitly enabled.

## Deployment Routing

- **Vercel** serves the frontend and rewrites `/api/*` to the Railway backend.
- The Railway domain in `vercel.json` is a placeholder until Issue #6 updates it.

## Environment Variable Ownership (High-Level)

- **Vercel (Frontend)**: `VITE_*` non-secrets, UI toggles, public keys.
- **Railway (Backend)**: secrets, DB credentials, auth secrets, and service keys.

## Change Control

If production ownership changes (e.g., move to Vercel Functions), this document must be updated and all affected docs/configs realigned in the same PR.

