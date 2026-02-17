import type {
  SparkfinedAutonomyTier,
  SparkfinedContext,
  SparkfinedDiffStats,
  SparkfinedGoldenTasksPlan,
  SparkfinedPolicyDecision,
  SparkfinedRiskLevel,
} from './contracts.js';
import { appendTeamDecision } from './memoryArtifacts.js';

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

function isCrossModule(diff: SparkfinedDiffStats): boolean {
  const groups = new Set<string>();
  for (const p of diff.touchedPaths) {
    if (p.startsWith('backend/')) groups.add('backend');
    else if (p.startsWith('api/')) groups.add('api');
    else if (p.startsWith('apps/')) groups.add('apps');
    else if (p.startsWith('src/') || p.startsWith('public/')) groups.add('frontend');
    else if (p.startsWith('shared/')) groups.add('shared');
    else if (p.startsWith('tests/') || p.startsWith('playwright/')) groups.add('tests');
    else groups.add('root');
  }
  // Cross-module is conservatively: touches more than one functional area (excluding tests).
  const functional = new Set([...groups].filter(g => g !== 'tests'));
  return functional.size > 1;
}

function touchesAuthOrSecrets(diff: SparkfinedDiffStats): boolean {
  return diff.touchedPaths.some(p => /auth|jwt|secret|token|credential/i.test(p));
}

export function deriveRiskLevel(diff?: SparkfinedDiffStats): SparkfinedRiskLevel {
  if (!diff) return 'low';
  const { required, reasons } = requiresApproval(diff);
  const hasCore = reasons.includes('core_engine');
  const hasCi = reasons.includes('ci_deploy');
  const hasLarge = reasons.includes('large_diff');

  // Conservative critical triggers.
  if (hasCore && hasCi) return 'critical';
  if (touchesAuthOrSecrets(diff) && hasLarge) return 'critical';

  if (required) return 'high';
  if (isCrossModule(diff)) return 'medium';
  return 'low';
}

export function defaultGoldenGlobalSuite(): string[] {
  return [
    'npm run lint',
    'npx tsc --noEmit',
    'npm run build',
    'npm run test:backend',
    'npm run test:e2e',
  ];
}

export function planGoldenTasks(diff?: SparkfinedDiffStats): SparkfinedGoldenTasksPlan {
  const global = defaultGoldenGlobalSuite();
  if (!diff) return { global, workstreamSubsets: { default: global } };

  const touched = diff.touchedPaths;
  const touchesCiDeploy =
    touched.some(p => p.startsWith('.github/')) ||
    ['vercel.json', 'railway.toml', 'package.json', 'pnpm-lock.yaml', '.npmrc'].some(f => touched.includes(f));

  const touchesBackend = touched.some(p => p.startsWith('backend/'));
  const touchesFrontend = touched.some(p => p.startsWith('src/') || p.startsWith('public/') || p.startsWith('apps/web/'));
  const touchesLlmOrAdapters =
    touched.some(p => p.startsWith('backend/src/lib/llm/')) ||
    touched.includes('backend/src/routes/llm.ts') ||
    touched.some(p => p.startsWith('backend/src/clients/')) ||
    touched.some(p => /^api\/_lib\/reasoning\/.*Client\.ts$/.test(p));

  if (touchesCiDeploy) {
    return { global, workstreamSubsets: { ci_deploy: global } };
  }

  if (touchesLlmOrAdapters) {
    return {
      global,
      workstreamSubsets: {
        llm_router_or_adapters: ['npm run lint', 'npx tsc --noEmit', 'npm run build', 'npm run test:backend'],
      },
    };
  }

  if (touchesBackend && !touchesFrontend) {
    return { global, workstreamSubsets: { backend_only: ['npm run lint', 'npx tsc --noEmit', 'npm run test:backend'] } };
  }

  if (touchesFrontend && !touchesBackend) {
    return { global, workstreamSubsets: { frontend_only: ['npm run lint', 'npx tsc --noEmit', 'npm run build'] } };
  }

  // Mixed changes: run global suite.
  return { global, workstreamSubsets: { default: global } };
}

export function shouldEscalate(ctx: SparkfinedContext): { escalate: boolean; reason: string } {
  if (ctx.risk.policy.requiresApproval === true) return { escalate: true, reason: 'approval_required' };
  if (ctx.risk.level === 'critical') return { escalate: true, reason: 'risk_critical' };
  if (ctx.trace.cost.costRegression?.status === 'block') return { escalate: true, reason: 'cost_regression_block' };
  return { escalate: false, reason: '' };
}

export function decideSparkfinedPolicy(input: {
  enabled: boolean;
  diff?: SparkfinedDiffStats;
  ctx?: SparkfinedContext;
}): SparkfinedPolicyDecision {
  const risk = deriveRiskLevel(input.diff);
  const approval = input.diff
    ? requiresApproval(input.diff)
    : { required: false, reasons: [] as SparkfinedPolicyDecision['approvalReasons'] };

  const autonomyTier: SparkfinedAutonomyTier = !input.enabled ? 1 : approval.required ? 4 : 2;

  const guardrails: string[] = [
    'propagate_ctx_first_param',
    'no_hidden_state',
    'append_only_memory',
    'cost_aware',
    'scope_discipline_small_diffs',
  ];

  const maxAutoFixIterations = !input.enabled
    ? 0
    : risk === 'critical'
      ? 3
      : risk === 'high'
        ? 4
        : 5;

  const goldenTaskPlan = !input.enabled ? { global: [], workstreamSubsets: {} } : planGoldenTasks(input.diff);

  const basePolicy: SparkfinedPolicyDecision = {
    enabled: input.enabled,
    risk,
    autonomyTier,
    requiresApproval: input.enabled ? approval.required : false,
    approvalReasons: input.enabled ? approval.reasons : [],
    guardrails,
    maxAutoFixIterations,
    goldenTaskPlan,
  };

  if (!input.ctx) return basePolicy;

  const escalationCtx: SparkfinedContext = {
    ...input.ctx,
    risk: {
      ...input.ctx.risk,
      level: risk,
      policy: basePolicy,
    },
  };
  const escalation = shouldEscalate(escalationCtx);
  if (!escalation.escalate) return basePolicy;

  void appendTeamDecision(input.ctx, {
    kind: 'policy_decision',
    reason: escalation.reason,
    meta: {
      risk,
      requiresApproval: basePolicy.requiresApproval,
      autonomyTier: basePolicy.autonomyTier,
      costRegressionStatus: input.ctx.trace.cost.costRegression?.status,
    },
  });

  return {
    ...basePolicy,
    autonomyTier: 4,
    escalation: {
      required: true,
      reason: escalation.reason,
    },
  };
}

