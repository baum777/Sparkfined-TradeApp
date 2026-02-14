import type { SparkfinedContext } from './contracts.js';
import { traceSpan } from './trace.js';

export type SparkfinedToolProvider = 'local' | 'deepseek' | 'openai' | 'grok';

export interface SparkfinedToolRouteDecision {
  provider: SparkfinedToolProvider;
  modelUsed?: string;
  reason: string;
}

/**
 * Cost-aware, cheap-first routing heuristic.
 *
 * NOTE: This module does not execute provider calls; it only decides routes.
 * Execution is expected to be implemented via existing provider clients.
 */
export function routeToolCall(
  ctx: SparkfinedContext,
  input: {
    task: string;
    budget: 'low' | 'medium' | 'high';
    candidates?: SparkfinedToolProvider[];
  }
): { ctx: SparkfinedContext; decision: SparkfinedToolRouteDecision } {
  const candidates = input.candidates ?? ['local', 'deepseek', 'openai', 'grok'];

  // Default ordering (cheap-first) — actual cost model is provider-defined.
  const order: SparkfinedToolProvider[] =
    input.budget === 'high'
      ? ['local', 'openai', 'deepseek', 'grok']
      : input.budget === 'medium'
        ? ['local', 'deepseek', 'openai', 'grok']
        : ['local', 'deepseek', 'openai', 'grok'];

  const pick = order.find(p => candidates.includes(p)) ?? candidates[0] ?? 'local';

  const reason =
    pick === 'local'
      ? 'local_first'
      : input.budget === 'low'
        ? 'cheap_first_low_budget'
        : input.budget === 'medium'
          ? 'balanced_medium_budget'
          : 'quality_high_budget';

  const nextCtx = traceSpan(ctx, {
    step: `tool_router:route:${sanitizeTask(input.task)}`,
    component: 'tool_router',
    attrs: { budget: input.budget, provider: pick },
  });

  return { ctx: nextCtx, decision: { provider: pick, reason } };
}

function sanitizeTask(s: string): string {
  return s.replace(/\s+/g, ' ').trim().slice(0, 120);
}

