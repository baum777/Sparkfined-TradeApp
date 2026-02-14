import { randomUUID } from 'crypto';
import type { SparkfinedContext, SparkfinedDiffStats } from './contracts.js';
import { traceSpan } from './trace.js';
import { appendTeamPlan, appendTeamProgress, appendTeamFinding } from './memoryArtifacts.js';

export interface SparkfinedWorkstream {
  id: string;
  name: string;
  scope: string;
  DoD: string;
  goldenSubset: string;
  touchedPaths: string[];
}

function groupKeyForPath(p: string): string {
  if (p.startsWith('backend/')) return 'backend';
  if (p.startsWith('api/')) return 'api';
  if (p.startsWith('apps/')) return 'apps';
  if (p.startsWith('src/') || p.startsWith('public/')) return 'frontend';
  if (p.startsWith('shared/')) return 'shared';
  if (p.startsWith('.github/') || p === 'vercel.json' || p === 'railway.toml') return 'ci_deploy';
  if (p === 'package.json' || p === 'pnpm-lock.yaml' || p === '.npmrc') return 'ci_deploy';
  return 'root';
}

function defaultGoldenSubsetForGroup(g: string): string {
  if (g === 'ci_deploy') return 'ci_deploy';
  if (g === 'backend' || g === 'api' || g === 'shared') return 'backend_only';
  if (g === 'frontend' || g === 'apps') return 'frontend_only';
  return 'default';
}

/**
 * Parallel-by-default slicing: independent path groups become independent workstreams.
 * Shared/touch-conflicting files are not auto-detected here; callers may enforce serial execution.
 */
export function sliceWorkstreams(ctx: SparkfinedContext, diff: SparkfinedDiffStats): SparkfinedWorkstream[] {
  // Keep ctx as first-class parameter (propagation rule); mark as used for TS noUnusedParameters.
  void ctx;
  const byGroup = new Map<string, string[]>();
  for (const p of diff.touchedPaths) {
    const g = groupKeyForPath(p);
    const arr = byGroup.get(g) ?? [];
    arr.push(p);
    byGroup.set(g, arr);
  }

  const workstreams: SparkfinedWorkstream[] = [];
  for (const [g, paths] of byGroup.entries()) {
    const id = `ws_${randomUUID()}`;
    workstreams.push({
      id,
      name: `dominance:${g}`,
      scope: `touchedPaths=${paths.length} group=${g}`,
      DoD: 'subset-green + back-compat validate',
      goldenSubset: defaultGoldenSubsetForGroup(g),
      touchedPaths: paths.slice().sort(),
    });
  }

  // Deterministic ordering for planning output.
  workstreams.sort((a, b) => a.name.localeCompare(b.name));
  return workstreams;
}

export async function writeTeamPlanIfEnabled(ctx: SparkfinedContext, workstreams: SparkfinedWorkstream[]): Promise<void> {
  if (!ctx.enabled) return;
  await appendTeamPlan(ctx, {
    objective: ctx.request.objective,
    workstreams: workstreams.map(ws => ({
      id: ws.id,
      name: ws.name,
      scope: ws.scope,
      DoD: ws.DoD,
      goldenSubset: ws.goldenSubset,
    })),
  });
}

export type GoldenRunStatus = 'green' | 'red';

export interface GoldenRunResult {
  status: GoldenRunStatus;
  failures: Array<{ task: string; summary: string; logRef?: string }>;
}

export type AutoCorrectLoopResult =
  | { status: 'green'; iterations: number }
  | { status: 'disabled'; reason: 'dominance_flag_off' }
  | { status: 'needs_escalation'; reason: 'max_iterations_exceeded' | 'golden_flaky' };

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
): Promise<AutoCorrectLoopResult> {
  if (!ctx0.enabled) return { status: 'disabled', reason: 'dominance_flag_off' };

  const maxIters = ctx0.risk.policy.maxAutoFixIterations;
  let ctx = ctx0;

  await appendTeamProgress(ctx, { workstreamId, state: 'started', note: 'autoCorrectLoop started' });

  for (let iter = 1; iter <= maxIters; iter++) {
    ctx = traceSpan(ctx, { workstreamId, step: `iter_${iter}:implement`, component: 'orchestrator' });
    await appendTeamProgress(ctx, { workstreamId, state: 'iterating', note: `iter ${iter}: implement` });
    await deps.implementScoped(ctx, workstreamId);

    ctx = traceSpan(ctx, { workstreamId, step: `iter_${iter}:test`, component: 'quality_gates' });
    const res = await deps.runGoldenSubset(ctx, workstreamId);

    if (res.status === 'green') {
      ctx = traceSpan(ctx, { workstreamId, step: `iter_${iter}:validate`, component: 'orchestrator' });
      await deps.validateBackcompat(ctx, workstreamId);
      await appendTeamProgress(ctx, { workstreamId, state: 'green', note: `green after ${iter} iteration(s)` });
      return { status: 'green', iterations: iter };
    }

    // Flaky suspicion: bounded reruns handled inside quality gates runner.
    await appendTeamFinding(ctx, {
      severity: 'warn',
      area: 'quality_gates',
      finding: `Golden subset red on iter ${iter}`,
      evidence: res.failures.map(f => `${f.task}:${f.summary}`).join('; '),
    });

    ctx = traceSpan(ctx, { workstreamId, step: `iter_${iter}:fix`, component: 'orchestrator' });
    await deps.applyTargetedFix(ctx, workstreamId, res.failures);
  }

  await appendTeamProgress(ctx, { workstreamId, state: 'blocked', note: 'max iterations exceeded' });
  return { status: 'needs_escalation', reason: 'max_iterations_exceeded' };
}

