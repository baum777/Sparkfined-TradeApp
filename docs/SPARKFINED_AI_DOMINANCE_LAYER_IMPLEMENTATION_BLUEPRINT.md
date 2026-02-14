## Sparkfined AI‑Dominance Layer Implementation Blueprint (Production‑Grade, Cursor‑Deployable)

### Feature Flag (hart)
- `ENABLE_SPARKFINED_DOMINANCE=true`
- Wenn `false`: **passives Logging only** (Trace/Cost/Metrics), **keine** Autonomie‑/Auto‑Fix‑Loops, **keine** Policy‑Enforcements, **keine** Workstream‑Parallelisierung.

---

## 1) Non‑negotiable Constraints (Speed + Safety, CI‑safe, Back‑compat)
- **Backwards Compatible by Default**: Dominance‑Layer ist **opt‑in** via Feature Flag; ohne Flag ist Runtime‑Verhalten unverändert.
- **CI‑Safe**: deterministische Golden Tasks; begrenzte Retries; keine neuen Flakes.
- **Contracts are law**: bestehende „FROZEN CONTRACTS“ bleiben unverändert; neue Felder nur **additiv** (optional) und versioniert.
- **Scope‑Disziplin**: kleine Workstreams, kleine Diffs; keine großflächigen Refactors ohne Risiko‑Nutzen.
- **Risk‑only approvals**: Freigaben nur bei definierten Risiko‑Triggern (Core Engine, Adapter, CI/Deploy, Large Diff).
- **Cost‑aware execution**: günstige Pfade/Modelle zuerst; teure Provider nur wenn nötig.
- **Full context propagation**: `SparkfinedContext` wird als First‑Class‑Objekt überall durchgereicht (Orchestrator, ToolRouter, Policy Engine, Quality Gates, Trace System).
- **Kein Governance‑Overhead**: exakt vier Memory‑Artefakte (append‑only), keine weiteren Governance‑Files.

---

## 2) Dominance Principles (Systemregeln)
- **Parallel by default**: unabhängige Workstreams parallel; shared/touch‑konfliktige Dateien seriell.
- **Small scope workstreams**: jedes Workstream‑Ziel ist eng, testbar, diff‑limitiert.
- **Auto‑fix until green**: implement → test → fix → retest → validate; kein menschliches Review vor „green state“.
- **Risk‑only review**: Approval nur bei Risiko‑Matches (Abschnitt 6).
- **Cost‑aware**: token/latency/cost werden pro Schritt erfasst; Cost‑Regression blockt riskant teure Änderungen.
- **Memory‑first**: Entscheidungen/Funde werden in Memory‑Artefakten append‑only dokumentiert, bevor Scope erweitert wird.

---

## 3) System‑Topologie (Komponenten)

### 3.1 Komponenten (normativ)
- **Orchestrator**: Workstreams erzeugen, Autonomy Tier setzen, Auto‑Correction Loop steuern, Memory append.
- **ToolRouter**: scoped execution; Tool/Provider‑Wahl nach Budget/Risiko/Tier; parallelisiert sichere Teilaufgaben.
- **Policy Engine**: Risiko‑Matching, Approval‑Trigger, Guardrails, Diff‑Schwellen, Eskalationssignale.
- **Quality Gates**: Golden Tasks (global + subsets), Regression‑Schwellen, Failure Handling.
- **Trace & Cost Layer**: Span‑Tracing, tokens/latency/costEstimateUsd, Cost‑Regression Tracking, Trace‑Export.
- **Memory Artifacts**: vier append‑only Governance‑Files.

### 3.2 Datenfluss (normativ)
1. `SparkfinedContext` initialisieren (Flag, Request, Repo, Trace IDs).
2. Policy Engine klassifiziert Risiko + setzt Autonomy Tier + erzeugt Golden Task Plan.
3. Orchestrator zerlegt in Workstreams (parallel by default) + schreibt `team_plan.md`.
4. Pro Workstream: Auto‑Correction Loop bis „green“ oder Eskalation.
5. Nach „green“: falls Approval nötig → Approval‑Paket erzeugen (Diff‑Stats, Golden Tasks, Trace/Cost).
6. Memory append: Progress/Findings/Decisions.

---

## 4) SparkfinedContext Model (Strict TypeScript, Propagation überall)

```ts
export type SparkfinedDominanceFlag = boolean;

export type SparkfinedRiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type SparkfinedAutonomyTier = 1 | 2 | 3 | 4;

export type SparkfinedComponent =
  | 'orchestrator'
  | 'tool_router'
  | 'policy_engine'
  | 'quality_gates'
  | 'trace_cost_layer';

export interface SparkfinedTraceIds {
  runId: string;
  workstreamId?: string;
  spanId: string;
  parentSpanId?: string;
}

export interface SparkfinedCostMetrics {
  tokensIn?: number;
  tokensOut?: number;
  modelUsed?: string;
  latencyMs?: number;
  costEstimateUsd?: number;
  costRegression?: {
    baselineUsd?: number;
    deltaUsd?: number;
    deltaPct?: number;
    status: 'ok' | 'warn' | 'block';
  };
}

export interface SparkfinedDiffStats {
  filesChanged: number;
  linesAdded: number;
  linesDeleted: number;
  largestFileDeltaLines?: number;
  touchedPaths: string[];
}

export interface SparkfinedGoldenTasksPlan {
  global: string[];
  workstreamSubsets: Record<string, string[]>;
}

export interface SparkfinedPolicyDecision {
  enabled: SparkfinedDominanceFlag;
  risk: SparkfinedRiskLevel;
  autonomyTier: SparkfinedAutonomyTier;

  requiresApproval: boolean;
  approvalReasons: Array<'core_engine' | 'adapters' | 'ci_deploy' | 'large_diff'>;

  guardrails: string[];
  maxAutoFixIterations: number;

  goldenTaskPlan: SparkfinedGoldenTasksPlan;
}

export interface SparkfinedRequest {
  objective: string;
  constraints?: string[];
  targetAreas?: string[];
  timeBudgetMs?: number;
}

export interface SparkfinedMemoryPointers {
  team_plan_md_path: 'team_plan.md';
  team_progress_md_path: 'team_progress.md';
  team_findings_md_path: 'team_findings.md';
  team_decisions_md_path: 'team_decisions.md';
}

export interface SparkfinedTraceContext {
  ids: SparkfinedTraceIds;
  component: SparkfinedComponent;
  tags?: Record<string, string>;
  cost: SparkfinedCostMetrics;
}

export interface SparkfinedContext {
  version: 'dominance_v1';
  enabled: SparkfinedDominanceFlag;

  request: SparkfinedRequest;

  repo: {
    rootPath: string;
    branch: string;
    commitSha?: string;
  };

  runtime: {
    nowISO: string;
    env: Record<string, string | undefined>;
  };

  risk: {
    level: SparkfinedRiskLevel;
    diff?: SparkfinedDiffStats;
    policy: SparkfinedPolicyDecision;
  };

  autonomy: {
    tier: SparkfinedAutonomyTier;
    escalationSignal?: string;
  };

  trace: SparkfinedTraceContext;
  memory: SparkfinedMemoryPointers;

  propagation: {
    mustPropagate: Array<
      'enabled' | 'request' | 'repo' | 'risk' | 'autonomy' | 'trace' | 'memory'
    >;
  };
}
```

**Propagation‑Regel (hart)**: Jede Dominance‑Komponente nimmt `SparkfinedContext` als ersten Parameter und darf keine Side‑Channels (hidden state) verwenden, die nicht in Trace/Memory sichtbar sind.

---

## 5) Autonomy Ladder (4 Tiers, Allowed Actions, Escalation)

### Tier 1 — Observe/Plan (Read‑Only)
**Allowed**
- Lesen von Code/Docs/Logs
- Workstream‑Plan erstellen + Memory append
- Trace/Cost passiv erfassen

**Not allowed**
- Code ändern, Tests ausführen, Git ops

**Escalate → Tier 2**
- `enabled=true` und Risiko ≤ `high`

### Tier 2 — Implement (Scoped, no push)
**Allowed**
- Kleine Code‑Änderungen (workstream‑scoped)
- Golden Subset ausführen
- Auto‑Correction Loop (subset‑green)

**Not allowed**
- CI/Deploy/Core/Adapter ändern (Policy block/approval)
- Commit/Push (außer Policy erlaubt über Tier 3)

**Escalate → Tier 3**
- Workstream subset‑green + diff klein oder Policy verlangt commit proof

### Tier 3 — Commit & Push (Proof‑driven)
**Allowed**
- `git add/commit/push` für green Workstreams
- Approval‑Paket erzeugen (falls erforderlich)
- Erweiterte Regression‑Checks

**Not allowed**
- Approval‑Pflichtbereiche ändern ohne Approval‑Paket‑Flow

**Escalate → Tier 4**
- Risiko `high/critical` oder Approval‑Trigger match

### Tier 4 — Risk‑Controlled Operations (Approval‑gesteuert)
**Allowed (nur wenn Approval‑Trigger matcht und Paket erstellt ist)**
- Core Engine, Adapter, CI/Deploy, Large Diff Änderungen

**Required**
- Golden Global Suite
- Trace/Cost Regression Bericht
- Rollback‑Plan in `team_decisions.md` append

---

## 6) Risk‑Based Policy Engine (Approval nur bei 4 Kategorien)

### 6.1 Approval‑Trigger (exakt)
Approval wird verlangt, wenn mindestens ein Match:

1) **Core engine**
- `shared/contracts/**`
- `backend/src/lib/llm/**`
- `backend/src/routes/llm.ts`
- `backend/src/http/**`

2) **Adapters**
- `backend/src/clients/**`
- `api/_lib/reasoning/*Client.ts`

3) **CI / Deployment**
- `.github/**`
- `vercel.json`, `railway.toml`
- `package.json`, `pnpm-lock.yaml`, `.npmrc`

4) **Large diffs**
- `filesChanged > 15` oder `(linesAdded + linesDeleted) > 800` oder `largestFileDeltaLines > 250`

### 6.2 Matching‑Logik (normativ)
```ts
export function requiresApproval(diff: SparkfinedDiffStats) {
  const reasons: SparkfinedPolicyDecision['approvalReasons'] = [];
  const touches = (re: RegExp) => diff.touchedPaths.some(p => re.test(p));

  const core =
    touches(/^shared\/contracts\//) ||
    touches(/^backend\/src\/lib\/llm\//) ||
    diff.touchedPaths.includes('backend/src/routes/llm.ts') ||
    touches(/^backend\/src\/http\//);

  const adapters =
    touches(/^backend\/src\/clients\//) ||
    touches(/^api\/_lib\/reasoning\/.*Client\.ts$/);

  const ciDeploy =
    touches(/^\.github\//) ||
    ['vercel.json', 'railway.toml', 'package.json', 'pnpm-lock.yaml', '.npmrc'].some(f =>
      diff.touchedPaths.includes(f)
    );

  const total = diff.linesAdded + diff.linesDeleted;
  const large = diff.filesChanged > 15 || total > 800 || (diff.largestFileDeltaLines ?? 0) > 250;

  if (core) reasons.push('core_engine');
  if (adapters) reasons.push('adapters');
  if (ciDeploy) reasons.push('ci_deploy');
  if (large) reasons.push('large_diff');

  return { required: reasons.length > 0, reasons };
}
```

### 6.3 Risk Level Ableitung (konservativ)
- `critical`: core_engine + ci_deploy oder (secrets/auth‑paths + large_diff)
- `high`: irgendein Approval‑Trigger
- `medium`: cross‑module oder neue Dependencies
- `low`: isoliert, klein, keine Dependencies, subset‑green

---

## 7) Auto‑Correction Loop (implement → test → fix → retest → validate)

### 7.1 Loop‑Definition (hart)
- Kein menschliches Review vor „green“.
- `maxAutoFixIterations` default: 5 (Policy setzt abhängig vom Risiko).

```ts
export type GoldenRunStatus = 'green' | 'red';

export interface GoldenRunResult {
  status: GoldenRunStatus;
  failures: Array<{ task: string; summary: string; logRef?: string }>;
}

export async function autoCorrectLoop(ctx: SparkfinedContext, workstreamId: string) {
  const maxIters = ctx.risk.policy.maxAutoFixIterations;

  for (let iter = 1; iter <= maxIters; iter++) {
    ctx = traceSpan(ctx, { workstreamId, step: `iter_${iter}:implement` });
    await implementScoped(ctx, workstreamId);

    ctx = traceSpan(ctx, { workstreamId, step: `iter_${iter}:test` });
    const res = await runGoldenSubset(ctx, workstreamId);

    if (res.status === 'green') {
      ctx = traceSpan(ctx, { workstreamId, step: `iter_${iter}:validate` });
      await validateBackcompat(ctx, workstreamId);
      return { status: 'green' as const, iterations: iter };
    }

    ctx = traceSpan(ctx, { workstreamId, step: `iter_${iter}:fix` });
    await applyTargetedFix(ctx, workstreamId, res.failures);
  }

  return { status: 'needs_escalation' as const, reason: 'max_iterations_exceeded' };
}
```

### 7.2 Failure Handling
- Flaky‑Verdacht: max 2 reproduzierende Reruns; danach Finding append + Eskalation.
- Fixes sind minimal und failure‑driven; keine breite Umstrukturierung ohne direkten Test/Lint/Type‑Bezug.

---

## 8) Golden Task System (Global + Subsets + Regression Thresholds)

### 8.1 Global Suite (Default)
- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- `npm run test:backend` (falls vorhanden)
- `npm run test:e2e` (falls vorhanden)

### 8.2 Subset‑Mapping (workstream‑scoped)
- **frontend_only** (`src/**`, `apps/web/**`):
  - lint, tsc, build
- **backend_only** (`backend/**`):
  - lint, tsc, test:backend
- **llm_router_or_adapters** (router + clients):
  - subset + relevante unit tests + contract checks
- **ci_deploy**:
  - immer Global Suite

### 8.3 Regression‑Regeln
- **Hard fail**: irgendein Golden Task rot → Auto‑Fix Loop weiter.
- **Cost regression block**: `costRegression.status === 'block'` → Approval Pflicht.
- **Latency regression** (best effort):
  - warn: +30% median
  - block: +60% median oder timeouts↑

---

## 9) Trace & Cost Layer (tokensIn/tokensOut/modelUsed/latency/costEstimateUsd + regression)

### 9.1 Trace Event Schema (normativ)
```ts
export interface SparkfinedTraceEvent {
  atISO: string;
  ids: SparkfinedTraceIds;
  component: SparkfinedComponent;
  step: string;

  riskLevel: SparkfinedRiskLevel;
  autonomyTier: SparkfinedAutonomyTier;

  metrics: SparkfinedCostMetrics;

  attrs?: Record<string, string | number | boolean | null>;
}
```

### 9.2 Cost‑Schätzung (deterministisch, best effort)
- Pricing table: versionierte Map `model -> { inputPer1kUsd, outputPer1kUsd }`
- `costEstimateUsd = (tokensIn/1000)*inRate + (tokensOut/1000)*outRate`
- Wenn Tokens fehlen: cost bleibt `undefined`, Trace wird trotzdem geschrieben.

### 9.3 Integration‑Hook (Sparkfined‑feasible)
- Bei jedem LLM‑Call Trace‑Event emitten mit:
  - `modelUsed`, `tokensIn`, `tokensOut`, `latencyMs`, `costEstimateUsd`
- Keine Speicherung von hidden reasoning content; nur metrische Felder + requestId/spanIds.

---

## 10) Memory Artifacts (genau vier Files, append‑only, strukturiert)

### 10.1 Dateien (exakt)
- `team_plan.md`
- `team_progress.md`
- `team_findings.md`
- `team_decisions.md`

### 10.2 Append‑Only Records (hart)
**`team_plan.md`**
```
[YYYY-MM-DDTHH:MM:SSZ] PLAN v1 | runId=<id> | objective="<...>" | workstreams=[{id,name,scope,DoD,goldenSubset}]
```

**`team_progress.md`**
```
[YYYY-MM-DDTHH:MM:SSZ] PROGRESS v1 | runId=<id> | workstreamId=<id> | state=started|iterating|green|blocked | note="<...>"
```

**`team_findings.md`**
```
[YYYY-MM-DDTHH:MM:SSZ] FINDING v1 | runId=<id> | severity=info|warn|block | area="<path/component>" | finding="<...>" | evidence="<tests/trace>"
```

**`team_decisions.md`**
```
[YYYY-MM-DDTHH:MM:SSZ] DECISION v1 | runId=<id> | decision="<...>" | alternatives="<...>" | rationale="<...>" | risks="<...>" | rollback="<...>"
```

---

## 11) File Structure Suggestions (minimal invasive, back‑compat)

### Option A (empfohlen): shared contract + backend implementation
- `shared/contracts/sparkfined-dominance.ts` (nur Typen/Contracts, optional frozen)
- `backend/src/lib/dominance/`
  - `context.ts`
  - `policyEngine.ts`
  - `orchestrator.ts`
  - `toolRouter.ts`
  - `qualityGates.ts`
  - `trace.ts`
  - `costModel.ts`
  - `memoryArtifacts.ts`

### Option B: Nur Cursor‑Directive (wenn zunächst nur Prompt‑Layer)
- `docs/ai/SPARKFINED_DOMINANCE_BLUEPRINT.md` (dieser Blueprint)
- später Runtime‑Integration (Flag + Trace/Cost zuerst)

---

## 12) Explizite Implementierungsreihenfolge (strict order)

### Phase 1 — Flag + Context Backbone
- Flag‑Parsing (`ENABLE_SPARKFINED_DOMINANCE`)
- `SparkfinedContext` Builder + Validator
- `enabled=false` → passives Logging only

### Phase 2 — Trace & Cost (passiv zuerst)
- Trace spans + costEstimateUsd + costRegression baseline read/write
- Integration‑Hooks für LLM‑Calls/Usage‑Metriken

### Phase 3 — Policy Engine (Risk‑Matching)
- Diff/Path‑Matching → Approval reasons
- riskLevel + autonomyTier + guardrails + iterations cap

### Phase 4 — Quality Gates (Golden Tasks)
- Global suite + subset mapping
- deterministische Runner + begrenzte Retries

### Phase 5 — Orchestrator (Workstreams + Auto‑Fix)
- Workstream slicing (parallel by default)
- Auto‑Correction Loop bis green / escalation
- Memory append (plan/progress/findings/decisions)

### Phase 6 — ToolRouter (scoped, cost‑aware)
- cheap‑first, escalate‑only‑when‑needed
- scoped execution + context redaction rules

### Phase 7 — Approval Packaging (risk‑only, post‑green)
- Nur nach green: Diff‑Stats + Golden Results + Trace/Cost Auszug + Rollback‑Notiz

### Phase 8 — Memory Writers (append‑only hardening)
- Strikte append‑only writes
- Keine zusätzlichen Governance‑Files

---

## 13) Dominance Enforcement Rules (hart)
- `enabled=false`: keine Blocker, keine Loops, keine Policy‑Stops; nur Trace/Cost/Metrics.
- `enabled=true`:
  - Auto‑Correction Loop läuft immer bis subset‑green oder Iterations‑Cap.
  - Approval wird nie vor green ausgelöst.
  - Approval wird immer ausgelöst, wenn Trigger matchen (Abschnitt 6).
  - Large diffs werden automatisch gesplittet in Workstreams oder blockiert (wenn unteilbar).
