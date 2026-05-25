---
id: backendAlertsLocalPostgresDocker
type: service
category: local-dev
canonical: apps/backend-alerts/docker-compose.yml
updated: 2026-05-13
freshness: stable
tags: [backend-alerts, postgres, docker, local-dev]
perf:
  avg_latency_ms: null
  avg_tokens_est: null
  cache_hit_rate: 0.0
optimization_candidates:
  - seeded-dev-dataset
  - makefile-db-lifecycle
---

# backendAlertsLocalPostgresDocker

## Zweck
Lokale Postgres-Ausfuehrung fuer `apps/backend-alerts` per Docker Compose als Standard-Dev-Pfad, ohne Supabase-Abhaengigkeit.

## Scope
- Neue Compose-Definition fuer Postgres 16
- Standard-`DATABASE_URL` auf `postgresql://...@localhost:5432/...`
- Projekt-Skripte `db:up`, `db:down`, `db:logs`
- README-Runbook fuer lokalen Start

## Verifikation
- `docker compose -f apps/backend-alerts/docker-compose.yml config` (exit 0)
- `corepack pnpm -C apps/backend-alerts exec tsc -p tsconfig.json` (exit 0)
