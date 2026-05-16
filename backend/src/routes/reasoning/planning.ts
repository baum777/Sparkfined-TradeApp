import type { ServerResponse } from 'http';
import { z } from 'zod';
import type { ParsedRequest } from '../../http/router.js';
import { sendJson, setCacheHeaders } from '../../http/response.js';
import { rateLimiters } from '../../http/rateLimit.js';
import { validateBody } from '../../validation/validate.js';
import { REASONING_CONTRACT_VERSION } from './types.js';
import { runPlanningReasoning } from './engine.js';

const planningRequestSchema = z.object({
  type: z.enum(['feature-planning', 'refactor-planning', 'risk-assessment', 'dependency-mapping']),
  scope: z.string().min(1),
  referenceId: z.string().min(1),
  version: z.string().min(1).default(REASONING_CONTRACT_VERSION),
  context: z.object({
    current_state: z.string().min(1),
    constraints: z.array(z.string().min(1)),
    success_criteria: z.array(z.string().min(1)),
    risk_gates: z.array(z.string().min(1)),
  }),
  outputSchemaJson: z.string().min(1).refine((value) => {
    try {
      JSON.parse(value);
      return true;
    } catch {
      return false;
    }
  }, 'Must be valid JSON'),
});

export async function handleReasoningPlanning(req: ParsedRequest, res: ServerResponse): Promise<void> {
  rateLimiters.reasoning(req.path, req.userId);

  const body = validateBody(planningRequestSchema, req.body);
  const normalized = { ...body, version: body.version ?? REASONING_CONTRACT_VERSION };

  setCacheHeaders(res, { noStore: true });

  const result = await runPlanningReasoning(req, normalized);

  sendJson(res, result);
}
