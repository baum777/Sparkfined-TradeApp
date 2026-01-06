/**
 * POST /api/reasoning/trade-review
 */

import { z } from 'zod';
import { createHandler } from '../_lib/handler';
import { sendJson, setCacheHeaders } from '../_lib/response';
import { validateBody } from '../_lib/validation';
import { checkRateLimit } from '../_lib/rate-limit';
import { runReasoning } from '../_lib/reasoning/engine';
import { REASONING_CONTRACT_VERSION } from '../_lib/reasoning/types';
import { jsonObjectSchema } from '../_lib/reasoning/jsonSchema';

const tradeReviewRequestSchema = z.object({
  referenceId: z.string().min(1),
  version: z.string().min(1).default(REASONING_CONTRACT_VERSION),
  context: jsonObjectSchema,
});

export default createHandler({
  POST: async (ctx) => {
    await checkRateLimit('reasoning', ctx.userId);

    const body = validateBody(tradeReviewRequestSchema, ctx.req.body);

    // Reasoning responses are user/context specific; avoid CDN caching.
    setCacheHeaders(ctx.res, { noStore: true });

    const result = await runReasoning(ctx, 'trade-review', {
      ...body,
      version: body.version || REASONING_CONTRACT_VERSION
    });

    sendJson(ctx.res, result);
  },
});


