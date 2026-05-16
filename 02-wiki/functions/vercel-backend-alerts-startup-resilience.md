---
id: vercelBackendAlertsStartupResilience
type: service
category: vercel-runtime
canonical: apps/backend-alerts/src/env.ts
updated: 2026-05-13
freshness: stable
tags: [vercel, backend-alerts, runtime, env]
perf:
  avg_latency_ms: null
  avg_tokens_est: null
  cache_hit_rate: 0.0
optimization_candidates:
  - project-root-alignment
  - env-sync-automation
---

# vercelBackendAlertsStartupResilience

## Zweck
Verhindert Function-Startabbruch auf Vercel bei fehlenden Runtime-Secrets, indem die Env-Auswertung fuer Modul-Importe tolerant bleibt und harte Validierung nur im Service-Entrypoint erfolgt.

## Scope
- `apps/backend-alerts/src/env.ts`: defaults + `assertRequiredServiceEnv`
- `apps/backend-alerts/src/index.ts`: harte Env-Pruefung vor Migration/Watcher
- `apps/backend-alerts/src/server.ts`: Root-Endpoint fuer saubere Basisantwort
- `apps/backend-alerts/vercel.json` + `apps/backend-alerts/api/index.ts`: Vercel-Konfiguration im effektiven Root

## Verifikation
- `corepack pnpm -C apps/backend-alerts exec tsc -p tsconfig.json` (exit 0)
- `corepack pnpm dlx vercel build --prod --yes --scope forgedfromwood` (exit 0)
- Runtime-Logs vor Fix: `ZodError` auf `DATABASE_URL`, `API_KEY`, `VAPID_*` beim `GET /`
