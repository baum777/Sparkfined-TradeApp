/**
 * Reasoning Router Contracts - Shared types between frontend and backend
 * --------------------------------------------------------------------
 * FROZEN CONTRACT (Spec-driven).
 *
 * - DeepSeek R1 routes + compresses before expensive providers are called.
 * - OpenAI / Grok must only receive `compressedPrompt + mustInclude` (+ minimal constraints),
 *   never the full raw context.
 * - Never persist or log DeepSeek `reasoning_content` by default.
 */

export type Tier = 'free' | 'standard' | 'pro' | 'high';

export type RouterDecisionProvider = 'deepseek' | 'openai' | 'grok';

export type RouterMode = 'route_compress' | 'postprocess';

export type LlmTaskKind =
  | 'general'
  // Chart (Solana)
  | 'chart_teaser_free'
  | 'chart_setups'
  | 'chart_patterns_validate'
  | 'chart_confluence_onchain'
  | 'chart_microstructure'
  // Journal
  | 'journal_teaser_free'
  | 'journal_review'
  | 'journal_playbook_update'
  | 'journal_risk'
  // Back-compat aliases
  | 'journal_teaser'
  | 'chart_teaser'
  | 'chart_analysis'
  | 'sentiment_alpha';

export type RouterMessageRole = 'system' | 'user' | 'assistant';

export interface RouterContextMessage {
  role: RouterMessageRole;
  content: string;
}

export interface ReasoningRouteRequest {
  mode: 'route_compress';
  tier?: Tier;
  taskKind?: LlmTaskKind;
  userMessage: string;
  context?: {
    conversationId?: string;
    messages?: RouterContextMessage[];
    metadata?: Record<string, any>;
  };
  constraints?: {
    maxFinalTokens?: number;
    latencyBudgetMs?: number;
    safety?: 'default' | 'strict';
  };
}

export interface ReasoningRouteResponse {
  requestId: string;
  provider: RouterDecisionProvider;
  templateId: string;
  maxTokens: number;
  compressedPrompt: string;
  mustInclude: string[];
  redactions: string[];
  tierApplied: Tier;
  taskKindApplied: LlmTaskKind;
}

export interface LlmExecuteRequest {
  tier?: Tier;
  taskKind?: LlmTaskKind;
  userMessage: string;
  context?: ReasoningRouteRequest['context'];
  constraints?: ReasoningRouteRequest['constraints'];
}

export interface LlmExecuteResponse {
  requestId: string;
  providerUsed: 'deepseek' | 'openai' | 'grok';
  text: string;
  meta?: { latencyMs: number; tokensIn?: number; tokensOut?: number };
}

export type ApiOk<T> = { status: 'ok'; data: T };

export type ApiError = {
  status: 'error';
  error: { code: string; message: string; details?: any };
};

