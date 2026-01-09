import { z } from 'zod';
import type { RouteHandler } from '../http/router.js';
import { sendJson } from '../http/response.js';
import { getRequestId } from '../http/requestId.js';
import { AppError, ErrorCodes } from '../http/error.js';
import { routeAndCompress } from '../lib/llm/router/router.js';

const routeRequestSchema = z.object({
  taskId: z.string().min(1).optional(),
  mode: z.enum(['route_compress', 'postprocess']),
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
      costBudget: z.enum(['low', 'medium', 'high']).optional(),
      safety: z.enum(['default', 'strict']).optional(),
    })
    .optional(),
});

export const handleReasoningRoute: RouteHandler = async (req, res) => {
  const parsed = routeRequestSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    throw new AppError('Validation failed', 400, ErrorCodes.VALIDATION_ERROR, {
      requestId: [getRequestId()],
    });
  }

  const out = await routeAndCompress(parsed.data, getRequestId());
  sendJson(res, out, 200);
};

