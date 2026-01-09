/**
 * Reasoning Router Contracts - Shared types between frontend and backend
 * --------------------------------------------------------------------
 * Goal:
 * - DeepSeek R1 (thinking) does routing + compression
 * - Expensive providers (OpenAI/Grok) are called only with compressed prompts
 *
 * IMPORTANT:
 * - Do NOT persist or log raw `reasoning_content` in production.
 * - Keep these shapes stable (contract-first).
 */

export type LlmProvider = 'deepseek' | 'openai' | 'grok';

// Provider selected for the "final" call after routing/compression.
export type RouterDecisionProvider = 'none' | 'openai' | 'grok';

export type RouterMode = 'route_compress' | 'postprocess';

export type RouterMessageRole = 'system' | 'user' | 'assistant';

export interface RouterContextMessage {
  role: RouterMessageRole;
  content: string;
}

export interface ReasoningRouteRequest {
  taskId?: string;
  mode: RouterMode;
  userMessage: string;
  context?: {
    conversationId?: string;
    messages?: RouterContextMessage[];
    metadata?: Record<string, unknown>;
  };
  constraints?: {
    maxFinalTokens?: number;
    latencyBudgetMs?: number;
    costBudget?: 'low' | 'medium' | 'high';
    safety?: 'default' | 'strict';
  };
}

export interface ReasoningRouteResponse {
  requestId: string;
  decision: {
    provider: RouterDecisionProvider;
    reason: string;
    maxTokens: number;
    temperature?: number;
  };
  compressedPrompt: string;
  mustInclude: string[];
  redactions: string[];
  debug?: {
    routerModel: string;
    routerLatencyMs: number;
  };
}

export interface LlmExecuteRequest {
  taskId?: string;
  userMessage: string;
  context?: ReasoningRouteRequest['context'];
  constraints?: ReasoningRouteRequest['constraints'];
}

export interface LlmExecuteResponse {
  requestId: string;
  provider: LlmProvider;
  text: string;
  debug?: {
    routerProviderDecision?: RouterDecisionProvider;
    routerLatencyMs?: number;
  };
}

// Canonical error shape used across APIs.
export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

