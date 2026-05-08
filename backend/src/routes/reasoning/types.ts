/**
 * Reasoning Layer Contracts (v0.1.0)
 * ------------------------------------------------------------
 * IMPORTANT:
 * - This contract is used across Frontend, BFF (`api/`), and Backend (`backend/`).
 * - Keep this file's TYPE SHAPES identical across those layers.
 */

import type { TradeReviewV1 } from './tradeReviewContract.js';

export const REASONING_CONTRACT_VERSION = '0.1.0' as const;

// ─────────────────────────────────────────────────────────────
// JSON helpers (strictly serializable)
// ─────────────────────────────────────────────────────────────

export type JsonPrimitive = null | boolean | number | string;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export type JsonObject = { [key: string]: JsonValue };

// ─────────────────────────────────────────────────────────────
// Core envelope
// ─────────────────────────────────────────────────────────────

export type LLMUseCase =
  | 'journal'
  | 'insights'
  | 'charts'
  | 'reasoning'
  | 'reasoning_critic'
  | 'grok_pulse';

export interface LLMRequest {
  prompt: string;
  system?: string;
  model: string;
  timeoutMs: number;
  jsonOnly?: boolean;
}

export interface LLMResponse {
  model: string;
  rawText: string;
  parsed?: unknown;
}

export type ReasoningType =
  | 'trade-review'
  | 'session-review'
  | 'board-scenarios'
  | 'insight-critic';

export type ReasoningStatus = 'ok' | 'error';

export type ReasoningErrorCode =
  | 'VALIDATION_FAILED'
  | 'TIMEOUT'
  | 'UPSTREAM_ERROR'
  | 'RATE_LIMITED'
  | 'PARSING_FAILED'
  | 'INTERNAL_ERROR';

export interface ReasoningError {
  code: ReasoningErrorCode;
  message: string;
  retryable: boolean;
  details?: Record<string, string[]>;
}

export type ReasoningCacheSource = 'idb' | 'kv' | 'backend' | 'llm';

export interface ReasoningMeta {
  latency_ms: number;
  model: string;
  version: string;
  requestId?: string;
  cache?: {
    key: string;
    hit: boolean;
    isStale: boolean;
    source: ReasoningCacheSource;
  };
}

export interface ReasoningResponse<T> {
  status: ReasoningStatus;
  data: T | null;
  warnings: string[];
  confidence: number; // 0..1
  meta: ReasoningMeta;
  error?: ReasoningError;
}

// ─────────────────────────────────────────────────────────────
// Insight Critic (quality/safety layer)
// ─────────────────────────────────────────────────────────────

export type CriticIssueKind = 'contradiction' | 'missing_data' | 'overreach';

export interface CriticIssue {
  kind: CriticIssueKind;
  message: string;
  fields?: string[];
}

export interface InsightCriticReport {
  issues: CriticIssue[];
  adjustedConfidence: number; // 0..1
  notes: string[]; // short, user-safe
}

// ─────────────────────────────────────────────────────────────
// Feature payloads (machine-parsable)
// ─────────────────────────────────────────────────────────────

export type TradeReviewVerdict = 'GOOD_PROCESS' | 'MIXED' | 'BAD_PROCESS';
export type Severity = 'low' | 'medium' | 'high';

export interface TradeReviewInsight {
  type: 'trade-review';
  referenceId: string;
  verdict: TradeReviewVerdict;
  decision: {
    shouldRepeat: boolean;
    reason: string;
  };
  highlights: string[];
  risks: Array<{
    label: string;
    severity: Severity;
    evidence: string[];
  }>;
  fixes: Array<{
    action: string;
    why: string;
  }>;
  questions: string[];
  assistantReview?: TradeReviewV1;
  critic: InsightCriticReport;
}

export interface SessionReviewInsight {
  type: 'session-review';
  referenceId: string;
  summary: string;
  decisions: Array<{
    decision: string;
    rationale: string;
  }>;
  patterns: Array<{
    pattern: string;
    evidence: string[];
  }>;
  nextSessionPlan: Array<{
    action: string;
    trigger: string;
  }>;
  critic: InsightCriticReport;
}

export interface BoardScenario {
  name: string;
  probability: number; // 0..1
  triggers: string[];
  plan: {
    actions: string[];
    invalidation: string;
    riskRule: string;
  };
}

export interface BoardScenariosInsight {
  type: 'board-scenarios';
  referenceId: string;
  scenarios: BoardScenario[];
  critic: InsightCriticReport;
}

export interface InsightCriticOnlyResult {
  type: 'insight-critic';
  referenceId: string;
  report: InsightCriticReport;
}

// ─────────────────────────────────────────────────────────────
// Requests (POST bodies)
// ─────────────────────────────────────────────────────────────

export interface ReasoningBaseRequest {
  referenceId: string;
  version: string;
  context: JsonObject;
}

export interface InsightCriticRequest extends ReasoningBaseRequest {
  insight: JsonObject; // the insight to critique (strict JSON)
}
