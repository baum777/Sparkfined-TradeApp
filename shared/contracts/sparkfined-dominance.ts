/**
 * Sparkfined AI-Dominance Layer Contracts (dominance_v1)
 *
 * NOTE:
 * - This file is intended for cross-package sharing (frontend/tools/docs).
 * - The backend package cannot import from `/shared` due to `tsconfig.rootDir` constraints;
 *   it maintains a byte-for-byte type mirror in `backend/src/lib/dominance/contracts.ts`.
 *
 * Contract rules:
 * - Additive-only changes (new optional fields) unless version-bumped.
 * - Backwards compatible by default.
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

