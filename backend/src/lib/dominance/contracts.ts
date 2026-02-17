/**
 * Sparkfined AI-Dominance Layer Contracts (dominance_v1) — backend-local mirror.
 *
 * IMPORTANT:
 * - Keep this file in `/backend/src` to satisfy `tsconfig.rootDir` constraints.
 * - Treat as a stable contract: additive-only changes unless version-bumped.
 *
 * Source-of-truth mirror (non-backend packages):
 * - `/shared/contracts/sparkfined-dominance.ts`
 */
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
  escalation?: {
    required: boolean;
    reason: string;
  };

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
    mustPropagate: Array<'enabled' | 'request' | 'repo' | 'risk' | 'autonomy' | 'trace' | 'memory'>;
  };
}

export interface AgentProfile {
  id: string;
  component: SparkfinedComponent;
  role: string;
  objectives: string[];
  permissions: {
    read: string[];
    write: string[];
    execute: string[];
  };
  escalationRules: Array<{
    condition: string;
    action: 'escalate' | 'block' | 'warn';
    target?: string;
    reason?: string;
  }>;
  memoryScopes: Array<keyof SparkfinedContext['memory']>;
  reviewPolicy: {
    required: boolean;
    triggers: string[];
    reviewers?: string[];
  };
}

export const AGENT_PROFILES: Record<SparkfinedComponent, AgentProfile> = {
  orchestrator: {
    id: 'agent_orchestrator',
    component: 'orchestrator',
    role: 'Workflow orchestrator for bounded auto-correct execution',
    objectives: [
      'Plan and execute workstream loops deterministically',
      'Record workstream progress states',
      'Coordinate implement/test/validate/fix transitions',
    ],
    permissions: {
      read: ['request', 'risk', 'autonomy', 'trace', 'memory'],
      write: ['team_plan.md', 'team_progress.md', 'team_findings.md'],
      execute: ['implementScoped', 'runGoldenSubset', 'validateBackcompat', 'applyTargetedFix'],
    },
    escalationRules: [
      { condition: 'max_iterations_exceeded', action: 'escalate', target: 'human_review', reason: 'bounded_loop_guard' },
      { condition: 'golden_flaky', action: 'escalate', target: 'human_review', reason: 'non_deterministic_gates' },
    ],
    memoryScopes: ['team_plan_md_path', 'team_progress_md_path', 'team_findings_md_path'],
    reviewPolicy: { required: false, triggers: ['needs_escalation'] },
  },
  policy_engine: {
    id: 'agent_policy_engine',
    component: 'policy_engine',
    role: 'Risk and approval policy evaluator',
    objectives: [
      'Derive risk level from diff stats',
      'Compute approval and autonomy decisions',
      'Emit escalation reasons for governance handling',
    ],
    permissions: {
      read: ['risk', 'trace', 'autonomy'],
      write: ['team_decisions.md'],
      execute: ['requiresApproval', 'deriveRiskLevel', 'decideSparkfinedPolicy'],
    },
    escalationRules: [
      { condition: 'approval_required', action: 'escalate', reason: 'policy_gate' },
      { condition: 'risk_critical', action: 'escalate', reason: 'risk_gate' },
      { condition: 'cost_regression_block', action: 'block', reason: 'cost_guardrail' },
    ],
    memoryScopes: ['team_decisions_md_path'],
    reviewPolicy: { required: true, triggers: ['approval_required', 'risk_critical', 'cost_regression_block'] },
  },
  quality_gates: {
    id: 'agent_quality_gates',
    component: 'quality_gates',
    role: 'Golden task execution and validation',
    objectives: [
      'Run deterministic quality gates',
      'Bound retries for flaky signatures',
      'Return gate failures with concise evidence',
    ],
    permissions: {
      read: ['repo', 'risk', 'trace'],
      write: ['team_findings.md'],
      execute: ['runGoldenTasks'],
    },
    escalationRules: [
      { condition: 'golden_red_after_retries', action: 'escalate', reason: 'quality_gate_failure' },
      { condition: 'flaky_signatures_detected', action: 'warn', reason: 'flaky_suspicion' },
    ],
    memoryScopes: ['team_findings_md_path'],
    reviewPolicy: { required: false, triggers: ['golden_red_after_retries'] },
  },
  tool_router: {
    id: 'agent_tool_router',
    component: 'tool_router',
    role: 'Cost-aware provider routing',
    objectives: [
      'Choose provider by cheap-first routing policy',
      'Emit trace metadata for selected routes',
      'Keep routing deterministic for same input class',
    ],
    permissions: {
      read: ['trace', 'risk', 'runtime'],
      write: [],
      execute: ['routeToolCall'],
    },
    escalationRules: [
      { condition: 'no_candidate_provider', action: 'escalate', reason: 'routing_unavailable' },
    ],
    memoryScopes: [],
    reviewPolicy: { required: false, triggers: ['routing_unavailable'] },
  },
  trace_cost_layer: {
    id: 'agent_trace_cost_layer',
    component: 'trace_cost_layer',
    role: 'Trace emission and cost regression tracking',
    objectives: [
      'Enrich and persist trace metrics',
      'Compute cost regressions against baseline',
      'Surface block-level cost status for escalation',
    ],
    permissions: {
      read: ['trace', 'runtime', 'risk'],
      write: ['team_decisions.md'],
      execute: ['traceSpan', 'enrichCostMetrics'],
    },
    escalationRules: [
      { condition: 'cost_regression_block', action: 'block', target: 'human_review', reason: 'cost_threshold_exceeded' },
    ],
    memoryScopes: ['team_decisions_md_path'],
    reviewPolicy: { required: true, triggers: ['cost_regression_block'] },
  },
};

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

