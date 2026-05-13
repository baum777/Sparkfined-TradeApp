---
id: p0BackendTestGateGuards
type: service
category: backend-test
canonical: backend/tests/setup.ts
updated: 2026-05-13
freshness: stable
tags: [p0, backend, tests, db, network]
perf:
  avg_latency_ms: null
  avg_tokens_est: null
  cache_hit_rate: 0.0
optimization_candidates:
  - ci-matrix-for-db-and-network
  - explicit-skip-metrics
---

# p0BackendTestGateGuards

## Zweck
Fuehrt deterministische Test-Gates fuer DB- und Port-Bind-Abhaengigkeiten ein, damit eingeschraenkte Runtimes nicht mehr mit Hard-Fail abbrechen.

## Scope
- `backend/tests/setup.ts`: fruehe Initialisierung + `__DB_READY__` + `__CAN_BIND_PORT__`
- `backend/tests/helpers/testGuards.ts`: `describeIfDb`, `describeIfNet`, `describeIfDbAndNet`
- Guarded test suites in Integration- und Unit-Tests
- Platzhalter-Suite `journal-insights-context.spec.ts` auf `describe.skip` mit TODOs

## Verifikation
- `corepack pnpm -C backend run test` (exit 0; skip bei fehlender Runtime-Faehigkeit ist explizit)
