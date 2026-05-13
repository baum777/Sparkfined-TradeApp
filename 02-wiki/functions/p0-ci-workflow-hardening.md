---
id: p0CiWorkflowHardening
type: service
category: ci
canonical: .github/workflows/deploy.yml
updated: 2026-05-13
freshness: stable
tags: [p0, ci, deploy, vercel]
perf:
  avg_latency_ms: null
  avg_tokens_est: null
  cache_hit_rate: 0.0
optimization_candidates:
  - deployment-health-endpoint-check
  - post-deploy-contract-smoke
---

# p0CiWorkflowHardening

## Zweck
Ersetzt Placeholder-CI durch ausfuehrbare `pnpm`- und Vercel-Deploy-Schritte mit Secret-Gating und Smoke-Check.

## Scope
- `.github/workflows/deploy.yml`
  - `pnpm` Setup + Install + Build
  - verpflichtende Secrets (`VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`)
  - Preview- und Production-Deploy via `pnpm dlx vercel@latest deploy`
  - URL-basierter `curl` Smoke-Check
- `.github/workflows/pr-checks.yml`
  - Coverage: `pnpm exec vitest run --coverage`
  - Accessibility: `@axe-core/cli` gegen lokale Preview

## Verifikation
- Lokal strukturell geprueft; echte Workflow-Ausfuehrung erfordert GitHub Actions + gesetzte Vercel-Secrets
