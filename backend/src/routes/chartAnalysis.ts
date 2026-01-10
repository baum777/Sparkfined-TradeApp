import type { RouteHandler } from '../http/router.js';
import { sendJson, setCacheHeaders } from '../http/response.js';
import { getRequestId } from '../http/requestId.js';
import { validateBody } from '../validation/validate.js';
import { chartAnalysisRequestSchema } from '../validation/schemas.js';
import { analyzeChartWithOnchainGating } from '../domain/solChartAnalysis/orchestrator.js';
import type { AnalysisTier, SolChartTaskKind } from '../domain/solChartAnalysis/contracts.js';
import { getEnv } from '../config/env.js';

/**
 * POST /api/chart/analyze
 * Deterministic chart analysis (JSON + rendered text) with optional onchain gating.
 */
export const handleChartAnalyze: RouteHandler = async (req, res) => {
  const env = getEnv();
  const body = validateBody(chartAnalysisRequestSchema, req.body);

  const tier = (body.tier ?? env.LLM_TIER_DEFAULT) as AnalysisTier;
  const taskKind = (body.taskKind ?? 'chart_setups') as SolChartTaskKind;

  const out = await analyzeChartWithOnchainGating({
    requestId: getRequestId(),
    mint: body.mint,
    symbol: body.symbol,
    timeframe: body.timeframe,
    candles: body.candles,
    tier,
    taskKind,
    chartContext: body.chartContext,
  });

  setCacheHeaders(res, { public: false, maxAge: 60 });
  sendJson(res, out, 200);
};

