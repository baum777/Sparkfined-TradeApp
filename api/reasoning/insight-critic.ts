/**
 * POST /api/reasoning/insight-critic
 */

import { z } from 'zod';
import { createHandler } from '../_lib/handler';
import { sendJson, setCacheHeaders } from '../_lib/response';
import { validateBody } from '../_lib/validation';
import { checkRateLimit } from '../_lib/rate-limit';
import { runInsightCritic } from '../_lib/reasoning/engine';
import { REASONING_CONTRACT_VERSION } from '../_lib/reasoning/types';
import { jsonObjectSchema } from '../_lib/reasoning/jsonSchema';

const insightCriticRequestSchema = z.object({
  referenceId: z.string().min(1),
  version: z.string().min(1).default(REASONING_CONTRACT_VERSION),
  context: jsonObjectSchema,
  insight: jsonObjectSchema,
});

export default createHandler({
  POST: async (ctx) => {
    await checkRateLimit('reasoning', ctx.userId);

    const body = validateBody(insightCriticRequestSchema, ctx.req.body);

    setCacheHeaders(ctx.res, { noStore: true });

    const result = await runInsightCritic(ctx, {
      ...body,
      version: body.version || REASONING_CONTRACT_VERSION
    });

    sendJson(ctx.res, result);
  },
});


