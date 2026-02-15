# Contributing

Ziel: Änderungen so liefern, dass **Contracts stabil bleiben**, **Tests deterministisch sind** und **Deploy-Topologie nicht „driftet“**.

## Voraussetzungen
- Node.js **20+**
- `pnpm` (Repo ist auf `pnpm@10.x` gepinnt, siehe `package.json#packageManager`)

## Setup

```bash
pnpm install
```

## Lokale Entwicklung

### Frontend (Vite)

```bash
pnpm dev
```

### Backend (canonical, always-on)

```bash
pnpm -C backend dev
```

Backend läuft unter `/api` (siehe Logs) und nutzt `DATABASE_URL` (SQLite default).

## Tests / Quality Gates

```bash
pnpm lint
pnpm typecheck
pnpm build
pnpm test
pnpm test:backend
pnpm test:e2e
```

Hinweis: Der Dominance „Golden Task“ Runner referenziert Kommandos als Strings (z.B. `npm run lint`). Das ist ok, solange die Scripts im Root stabil bleiben.

## Contract-Änderungen (streng)

### HTTP-Envelope
- Success: `{ "status": "ok", "data": ... }`
- Error: `{ "error": { "code", "message", "details?" } }` + `details.requestId` + Header `x-request-id`

### Shared Contracts
- Änderungen in `shared/contracts/*` sind **additive-only** (neue optionale Felder) oder erfordern Version bump.
- Wenn Backend den Contract nicht importieren kann (tsconfig rootDir): **Mirror** in `backend/src/...` byte-for-byte halten.

## Deployment Drift Guardrails

- `vercel.json` rewritet `/api/*` → `https://$VERCEL_BACKEND_URL/api/*`.
- Production darf nicht „unbemerkt“ auf `api/` (Vercel Functions) umschalten, solange dieser Rewrite aktiv ist.

## Feature Flags (Kurz)
- `VITE_ENABLE_AUTH="true"`: UI/SW nutzen credentials + behandeln 401/403 als „auth required“ nur in diesem Modus.
- `ENABLE_SPARKFINED_DOMINANCE="true"`: Dominance Layer aktiv (Policy/Golden Tasks/Memory/Trace).

