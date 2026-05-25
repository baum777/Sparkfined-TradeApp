---
id: llmExecuteProviderUsage
type: route
category: llm
canonical: backend/src/routes/llm.ts
updated: 2026-05-09
freshness: stable
tags: [provider-usage, llm-router, v2]
perf:
  avg_latency_ms: null
  avg_tokens_est: null
  cache_hit_rate: 0.0
optimization_candidates:
  - provider_success_rates
  - provider_latency_ranking
---

# llmExecuteProviderUsage

## Zweck
Persistiert echte Provider-Usage fuer finale `/api/llm/execute` Provider-Calls in `usageTracker`.

## Scope
- Erfolg: `recordCall`, `recordLatency`, `recordTokens`
- Fehler: `recordError`
- UseCase-Mapping: `chart_* -> charts`, `journal_* -> journal`, `sentiment_alpha -> grok_pulse`, sonst `insights`

## Verifikation
- `corepack pnpm -C backend exec vitest run tests/integration/llm-execute.spec.ts -t "records final provider usage"`
