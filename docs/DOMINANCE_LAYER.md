# Sparkfined — Dominance Layer (dominance_v1)

Zweck: **Governance + Safety + Kostenkontrolle** für autonome Änderungen/Operationen.  
Implementierung: `backend/src/lib/dominance/*` + Contract `shared/contracts/sparkfined-dominance.ts` (Backend-Mirror vorhanden).

## Autonomy Tiers

- **Tier 1**: Dominance deaktiviert (`ENABLE_SPARKFINED_DOMINANCE != "true"`). Keine Golden Tasks, keine Auto-Korrektur.
- **Tier 2**: Dominance aktiv, keine Approval-Pflicht (default für „kleine“ Diffs).
- **Tier 4**: Dominance aktiv, Approval required (Escalation).
- **Tier 3**: reserviert (vertraglich stabil, aktuell nicht aktiv genutzt).

## Policy Engine

Input: `diffStats { filesChanged, linesAdded, linesDeleted, largestFileDeltaLines?, touchedPaths[] }`

1. **Approval Check** (`requiresApproval`):
   - `core_engine`: `shared/contracts/*`, `backend/src/http/*`, LLM core
   - `adapters`: `backend/src/clients/*` u.ä.
   - `ci_deploy`: `.github/*`, `vercel.json`, `railway.toml`, package/lockfiles
   - `large_diff`: heuristisch (viele Dateien/Lines/large single-file delta)
2. **Risk Level** (`deriveRiskLevel`): `low|medium|high|critical` (konservativ).
3. **Policy Decision** (`decideSparkfinedPolicy`):
   - `guardrails[]` (z.B. ctx propagation, append-only memory, cost-aware)
   - `maxAutoFixIterations` (risk-basiert: 3–5)
   - `goldenTaskPlan` (global + subset mapping)

## Golden Tasks (Quality Gates)

Global Suite (deterministisch, bounded):
- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- `npm run test:backend`
- `npm run test:e2e`

Subset Planning:
- `backend_only`, `frontend_only`, `ci_deploy`, `llm_router_or_adapters` (diff-basiert).

Golden runner:
- führt Befehle via `bash -lc <cmd>` aus,
- bounded retries bei Flaky-Signaturen (max 2 reruns pro failing task),
- Timeout default 10 Minuten pro Command.

## Auto-Correct Loop

`autoCorrectLoop(ctx, workstreamId, deps)`:

1. implement (scoped)
2. run golden subset (quality gate)
3. validate backcompat
4. bei red: targeted fix, iter++ (bis max)

Stop Conditions:
- green → Erfolg
- max iterations exceeded → escalation
- flaky/instabile gates → escalation (policy-dependent)

## Memory Artifacts

Append-only, single-line Records (Newlines werden sanitisiert):
- `team_plan.md`: Workstreams + Golden Subsets
- `team_progress.md`: Zustandswechsel (started/iterating/green/blocked)
- `team_findings.md`: Warn/Info Findings (z.B. red gates)
- `team_decisions.md`: Entscheidungen mit Alternativen/Risiken/Rollback

Ziel: reproduzierbare, auditierbare Runs ohne versteckten State.

## Trace & Cost Layer

Trace:
- IDs: `runId`, `workstreamId?`, `spanId`, `parentSpanId?`
- Events: komponenten-getaggt (`orchestrator`, `policy_engine`, `quality_gates`, …)

Cost:
- optional `tokensIn/tokensOut/modelUsed/latencyMs/costEstimateUsd`
- Pricing Table via `SPARKFINED_PRICING_TABLE_JSON`
- Regression Checks via `SPARKFINED_COST_BASELINE_USD`, `SPARKFINED_COST_WARN_PCT`, `SPARKFINED_COST_BLOCK_PCT`

## Flag Behavior

- `ENABLE_SPARKFINED_DOMINANCE="true"`: Dominance aktiv.
- `SPARKFINED_REPO_ROOT`: Override für Repo Root (sonst git/proc cwd).
- Context env capture ist allowlist-basiert (keine Secrets).

## Escalation Rules (praktisch)

Escalate wenn mindestens eins gilt:
- `requiresApproval.required === true`
- risk `critical`
- Golden Tasks bleiben red nach `maxAutoFixIterations`
- Cost regression status `block`

