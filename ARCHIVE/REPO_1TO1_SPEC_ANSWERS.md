# REPO-1:1 SPEZIFIZIERUNG — 5 KONKRETE ANTWORTEN

**Date**: 2024-12-19  
**Scope**: `backend/src/lib/dominance/*`

---

## 1. EXAKTE DATEIEN/EXPORTS

### Dateien existieren:

| Pfad | Existiert | Exports |
|------|-----------|---------|
| `backend/src/lib/dominance/orchestrator.ts` | ✅ EXISTS | `autoCorrectLoop`, `sliceWorkstreams`, `writeTeamPlanIfEnabled`, `SparkfinedWorkstream`, `GoldenRunStatus`, `GoldenRunResult`, `AutoCorrectLoopResult` |
| `backend/src/lib/dominance/policyEngine.ts` | ✅ EXISTS | `requiresApproval`, `deriveRiskLevel`, `defaultGoldenGlobalSuite`, `planGoldenTasks`, `decideSparkfinedPolicy` |
| `backend/src/lib/dominance/qualityGates.ts` | ✅ EXISTS | `runGoldenTasks`, `GoldenRunStatus`, `GoldenRunResult` |
| `backend/src/lib/dominance/toolRouter.ts` | ✅ EXISTS | `routeToolCall`, `SparkfinedToolProvider`, `SparkfinedToolRouteDecision` |
| `backend/src/lib/dominance/memoryArtifacts.ts` | ✅ EXISTS | `appendTeamPlan`, `appendTeamProgress`, `appendTeamFinding`, `appendTeamDecision` |
| `backend/src/lib/dominance/contracts.ts` | ✅ EXISTS | `SparkfinedContext`, `SparkfinedRequest`, `SparkfinedPolicyDecision`, `SparkfinedDiffStats`, `SparkfinedComponent`, `SparkfinedMemoryPointers`, `SparkfinedTraceContext`, etc. |

### Weitere relevante Dateien:

| Pfad | Existiert | Exports |
|------|-----------|---------|
| `backend/src/lib/dominance/context.ts` | ✅ EXISTS | `buildSparkfinedContext`, `parseSparkfinedDominanceFlag`, `getRepoRootPath`, `getRepoBranch`, `getRepoCommitSha`, `assertValidSparkfinedContext` |
| `backend/src/lib/dominance/trace.ts` | ✅ EXISTS | `traceSpan`, `newTraceIds`, `emitSparkfinedTraceEvent`, `enrichCostMetrics` |
| `backend/src/lib/dominance/costModel.ts` | ✅ EXISTS | (nicht gelesen, aber referenziert) |
| `backend/src/lib/dominance/index.ts` | ✅ EXISTS | Re-exports aller oben genannten |

---

## 2. SPARKFINEDCONTEXT — PFAD + TYPNAME

### Pfad:
- **Primär**: `backend/src/lib/dominance/contracts.ts`
- **Mirror**: `shared/contracts/sparkfined-dominance.ts` (laut Kommentar in contracts.ts)

### Typname:
- **Exakt**: `SparkfinedContext` (nicht `DominanceContext`)

### `ctx.memory` existiert:
- ✅ **JA**, existiert

### Keys in `ctx.memory`:
```typescript
interface SparkfinedMemoryPointers {
  team_plan_md_path: 'team_plan.md';
  team_progress_md_path: 'team_progress.md';
  team_findings_md_path: 'team_findings.md';
  team_decisions_md_path: 'team_decisions.md';
}
```

**Real**: 4 Keys, alle mit Literal-Typ `'team_*.md'` (nicht `string`).

---

## 3. AUTOCORRECTLOOP — SIGNATUR + AUFRUF

### Funktion-Signatur:
```typescript
export async function autoCorrectLoop(
  ctx0: SparkfinedContext,
  workstreamId: string,
  deps: {
    implementScoped: (ctx: SparkfinedContext, workstreamId: string) => Promise<void>;
    runGoldenSubset: (ctx: SparkfinedContext, workstreamId: string) => Promise<GoldenRunResult>;
    validateBackcompat: (ctx: SparkfinedContext, workstreamId: string) => Promise<void>;
    applyTargetedFix: (
      ctx: SparkfinedContext,
      workstreamId: string,
      failures: GoldenRunResult['failures']
    ) => Promise<void>;
  }
): Promise<AutoCorrectLoopResult>
```

### Rückgabetyp:
```typescript
export type AutoCorrectLoopResult =
  | { status: 'green'; iterations: number }
  | { status: 'disabled'; reason: 'dominance_flag_off' }
  | { status: 'needs_escalation'; reason: 'max_iterations_exceeded' | 'golden_flaky' };
```

### `deps` Injection:
- **Methode**: **Parameter** (nicht import, nicht global)
- **Typ**: Inline-Interface im Parameter
- **Aufruf-Pattern**: Caller muss alle 4 Funktionen als Objekt übergeben

### Beispiel-Aufruf (nicht im Repo gefunden):
```typescript
const result = await autoCorrectLoop(ctx, workstreamId, {
  implementScoped: async (ctx, wsId) => { /* ... */ },
  runGoldenSubset: async (ctx, wsId) => { /* ... */ },
  validateBackcompat: async (ctx, wsId) => { /* ... */ },
  applyTargetedFix: async (ctx, wsId, failures) => { /* ... */ },
});
```

---

## 4. MEMORY-ARTIFACTS IMPLEMENTIERUNG

### Pfade werden geschrieben:
- ✅ **JA**, alle 4 Pfade werden geschrieben:
  - `team_plan.md` (via `appendTeamPlan`)
  - `team_progress.md` (via `appendTeamProgress`)
  - `team_findings.md` (via `appendTeamFinding`)
  - `team_decisions.md` (via `appendTeamDecision`)

### Pfad-Auflösung:
```typescript
function resolveMemoryPath(ctx: SparkfinedContext, key: keyof SparkfinedContext['memory']): string {
  const rel = ctx.memory[key]; // z.B. 'team_plan.md'
  return join(ctx.repo.rootPath, rel); // z.B. '/repo/root/team_plan.md'
}
```

### Append-only Enforcement:
- **Code-Level**: `appendLine()` nutzt `fs.appendFile()` (kein `writeFile`)
- **Policy-Level**: `sanitizeValue()` entfernt Newlines → single-line records
- **Tests**: Nicht geprüft (keine Tests für append-only gefunden)

### Storage:
- **Dateisystem** (nicht DB, nicht KV)
- **Pfad**: `ctx.repo.rootPath` (git root oder `SPARKFINED_REPO_ROOT` env)
- **Format**: Single-line Records mit ISO-Timestamp + strukturierte Felder

### Beispiel-Format:
```
[2024-12-19T10:30:00.000Z] PLAN v1 | runId=abc-123 | objective="..." | workstreams=[...]
[2024-12-19T10:30:05.000Z] PROGRESS v1 | runId=abc-123 | workstreamId=ws-456 | state=started | note="..."
```

---

## 5. REPO-GOVERNANCE (CI/TESTS/DOD)

### Golden Tasks (exakte Commands):

**Global Suite** (aus `policyEngine.ts:defaultGoldenGlobalSuite()`):
```typescript
[
  'npm run lint',
  'npx tsc --noEmit',
  'npm run build',
  'npm run test:backend',
  'npm run test:e2e'
]
```

**Subsets** (aus `policyEngine.ts:planGoldenTasks()`):
- `backend_only`: `['npm run lint', 'npx tsc --noEmit', 'npm run test:backend']`
- `frontend_only`: `['npm run lint', 'npx tsc --noEmit', 'npm run build']`
- `llm_router_or_adapters`: `['npm run lint', 'npx tsc --noEmit', 'npm run build', 'npm run test:backend']`
- `ci_deploy`: Global Suite
- `default`: Global Suite

**Hinweis**: Commands nutzen `npm run`, nicht `pnpm`. Repo nutzt `pnpm`, aber Golden Tasks referenzieren `npm`.

### Feature-Flag:

- **Name**: `ENABLE_SPARKFINED_DOMINANCE`
- **Ort**: Environment Variable (Runtime)
- **Parser**: `backend/src/lib/dominance/context.ts:parseSparkfinedDominanceFlag()`
- **Logik**: `env.ENABLE_SPARKFINED_DOMINANCE === 'true'` (string comparison)
- **Default**: `false` (wenn nicht gesetzt)

### Human-Review (PR Gate):

**Aktuell**: Nicht explizit in Code/CI gefunden.

**Policy-basiert**:
- `requiresApproval.required === true` → Escalation (aber nicht automatisch PR-Block)
- `risk === 'critical'` → Escalation (aber nicht automatisch PR-Block)
- `autonomyTier === 4` → Approval required (aber nicht automatisch PR-Block)

**CI/Tests**:
- Keine explizite PR-Gate-Logik in `.github/workflows` gefunden
- `CONTRIBUTING.md` erwähnt "Tests müssen passen", aber keine automatische Block-Logik

**Fazit**: Human-Review ist **Policy-basiert** (Escalation), nicht **automatisch PR-Block**.

---

## ZUSAMMENFASSUNG

| Frage | Antwort |
|-------|---------|
| 1. Dateien/Exports | ✅ Alle 6 Dateien existieren, Exports dokumentiert |
| 2. SparkfinedContext | ✅ `backend/src/lib/dominance/contracts.ts`, `ctx.memory` mit 4 Keys |
| 3. autoCorrectLoop | ✅ Parameter-basierte `deps` Injection, `AutoCorrectLoopResult` Return |
| 4. Memory-Artifacts | ✅ Dateisystem, append-only via `fs.appendFile()`, 4 Pfade |
| 5. Governance | ✅ Golden Tasks: `npm run lint|build|test:backend|test:e2e`, Flag: `ENABLE_SPARKFINED_DOMINANCE`, Review: Policy-basiert (nicht PR-Block) |

---

**END OF ANSWERS**

