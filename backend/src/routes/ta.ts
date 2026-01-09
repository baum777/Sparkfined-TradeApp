import type { ServerResponse } from 'http';
import type { ParsedRequest } from '../http/router.js';
import { sendJson, setCacheHeaders } from '../http/response.js';
import { validateBody } from '../validation/validate.js';
import { chartAnalysisRequestSchema } from '../validation/schemas.js';
import type { AnalysisTier } from '../domain/solChartAnalysis/contracts.js';
import { getRequestId } from '../http/requestId.js';
import { getEnv } from '../config/env.js';
import { analyzeTA } from '../domain/solChart/ta/analyzeTA.js';
import { rateLimiters } from '../http/rateLimit.js';

/**
 * Chart TA Routes
 * Per API_SPEC.md section 4
 * 
 * // BACKEND_TODO: wire GPT vision for real TA analysis
 */

export async function handleTAAnalysis(req: ParsedRequest, res: ServerResponse): Promise<void> {
  const env = getEnv();
  const body = validateBody(chartAnalysisRequestSchema, req.body);
  
  // Rate limit check
  rateLimiters.ta(req.path, req.userId);

  // Keep handler thin: validate → call service → sendJson
  const tier = (body.tier ?? env.LLM_TIER_DEFAULT) as AnalysisTier;
  const out = await analyzeTA({
    requestId: getRequestId(),
    mint: body.mint,
    symbol: body.symbol,
    timeframe: body.timeframe,
    candles: body.candles,
    tier,
    taskKind: body.taskKind,
    chartContext: body.chartContext,
  });

  setCacheHeaders(res, { public: false, maxAge: 60 });
  sendJson(res, out, 200);
}
