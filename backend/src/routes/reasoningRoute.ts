import { z } from 'zod';
import type { RouteHandler } from '../http/router.js';
import { sendJson } from '../http/response.js';
import { getRequestId } from '../http/requestId.js';
import { AppError, ErrorCodes } from '../http/error.js';
import { routeAndCompress } from '../lib/llm/router/router.js';

const routeRequestSchema = z.object({
  mode: z.literal('route_compress'),
  tier: z.enum(['free', 'standard', 'pro', 'high']).optional(),
  taskKind: z
    .enum([
      'general',
      // Chart
      'chart_teaser_free',
      'chart_setups',
      'chart_patterns_validate',
      'chart_confluence_onchain',
      'chart_microstructure',
      // Journal
      'journal_teaser_free',
      'journal_review',
      'journal_playbook_update',
      'journal_risk',
      // Back-compat aliases
      'journal_teaser',
      'chart_teaser',
      'chart_analysis',
      // Other
      'sentiment_alpha',
    ])
    .optional(),
  userMessage: z.string().min(1).max(20000),
  context: z
    .object({
      conversationId: z.string().min(1).optional(),
      messages: z
        .array(
          z.object({
            role: z.enum(['system', 'user', 'assistant']),
            content: z.string().min(1).max(20000),
          })
        )
        .optional(),
      metadata: z.record(z.unknown()).optional(),
    })
    .optional(),
  constraints: z
    .object({
      maxFinalTokens: z.number().int().min(16).max(4096).optional(),
      latencyBudgetMs: z.number().int().min(250).max(120000).optional(),
      safety: z.enum(['default', 'strict']).optional(),
    })
    .optional(),
});

export const handleReasoningRoute: RouteHandler = async (req, res) => {
  const parsed = routeRequestSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    throw new AppError('Validation failed', 400, ErrorCodes.VALIDATION_ERROR, {
      requestId: getRequestId(),
    });
  }

  const requestId = getRequestId();
  const out = await routeAndCompress(parsed.data, requestId);
  sendJson(res, out, 200);
};

