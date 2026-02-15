import { execFileSync } from 'child_process';
import { randomUUID } from 'crypto';
import type { SparkfinedComponent, SparkfinedContext, SparkfinedDiffStats, SparkfinedRequest } from './contracts.js';
import { decideSparkfinedPolicy } from './policyEngine.js';

export const SPARKFINED_CONTEXT_VERSION = 'dominance_v1' as const;

export function parseSparkfinedDominanceFlag(env: Record<string, string | undefined>): boolean {
  return env.ENABLE_SPARKFINED_DOMINANCE === 'true';
}

function safeGit(args: string[], cwd: string): string | undefined {
  try {
    const out = execFileSync('git', args, { cwd, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString('utf8')
      .trim();
    return out.length ? out : undefined;
  } catch {
    return undefined;
  }
}

export function getRepoRootPath(env: Record<string, string | undefined>): string {
  const explicit = env.SPARKFINED_REPO_ROOT;
  if (explicit) return explicit;
  const fromGit = safeGit(['rev-parse', '--show-toplevel'], process.cwd());
  return fromGit ?? process.cwd();
}

export function getRepoBranch(rootPath: string): string {
  return safeGit(['rev-parse', '--abbrev-ref', 'HEAD'], rootPath) ?? 'unknown';
}

export function getRepoCommitSha(rootPath: string): string | undefined {
  return safeGit(['rev-parse', 'HEAD'], rootPath);
}

function pickEnvForContext(env: Record<string, string | undefined>): Record<string, string | undefined> {
  // Avoid capturing secrets; keep dominance/config keys only.
  const allow = new Set([
    'NODE_ENV',
    'LOG_LEVEL',
    'ENABLE_SPARKFINED_DOMINANCE',
    'SPARKFINED_REPO_ROOT',
    'SPARKFINED_PRICING_TABLE_JSON',
    'SPARKFINED_COST_BASELINE_USD',
    'SPARKFINED_COST_WARN_PCT',
    'SPARKFINED_COST_BLOCK_PCT',
  ]);
  const out: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(env)) {
    if (allow.has(k) || k.startsWith('SPARKFINED_')) out[k] = v;
  }
  return out;
}

export function buildSparkfinedContext(input: {
  request: SparkfinedRequest;
  component?: SparkfinedComponent;
  env?: Record<string, string | undefined>;
  enabled?: boolean;
  diff?: SparkfinedDiffStats;
}): SparkfinedContext {
  const env = input.env ?? process.env;
  const repoRootPath = getRepoRootPath(env);
  const enabled = typeof input.enabled === 'boolean' ? input.enabled : parseSparkfinedDominanceFlag(env);

  const policy = decideSparkfinedPolicy({ enabled, diff: input.diff });

  const nowISO = new Date().toISOString();
  const runId = randomUUID();
  const spanId = randomUUID();

  const ctx: SparkfinedContext = {
    version: SPARKFINED_CONTEXT_VERSION,
    enabled,
    request: input.request,
    repo: {
      rootPath: repoRootPath,
      branch: getRepoBranch(repoRootPath),
      commitSha: getRepoCommitSha(repoRootPath),
    },
    runtime: {
      nowISO,
      env: pickEnvForContext(env),
    },
    risk: {
      level: policy.risk,
      diff: input.diff,
      policy,
    },
    autonomy: {
      tier: policy.autonomyTier,
    },
    trace: {
      ids: { runId, spanId },
      component: input.component ?? 'orchestrator',
      cost: {},
    },
    memory: {
      team_plan_md_path: 'team_plan.md',
      team_progress_md_path: 'team_progress.md',
      team_findings_md_path: 'team_findings.md',
      team_decisions_md_path: 'team_decisions.md',
    },
    propagation: {
      mustPropagate: ['enabled', 'request', 'repo', 'risk', 'autonomy', 'trace', 'memory'],
    },
  };

  return ctx;
}

export function assertValidSparkfinedContext(ctx: SparkfinedContext): void {
  if (ctx.version !== 'dominance_v1') throw new Error('SparkfinedContext.version invalid');
  if (!ctx.request || typeof ctx.request.objective !== 'string' || !ctx.request.objective.length) {
    throw new Error('SparkfinedContext.request.objective missing');
  }
  if (!ctx.repo?.rootPath) throw new Error('SparkfinedContext.repo.rootPath missing');
  if (!ctx.trace?.ids?.runId || !ctx.trace.ids.spanId) throw new Error('SparkfinedContext.trace.ids missing');
  if (!ctx.memory?.team_plan_md_path) throw new Error('SparkfinedContext.memory missing');
}

