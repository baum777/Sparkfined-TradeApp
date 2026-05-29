import type { RouteHandler } from '../http/router.js';
import { AppError, ErrorCodes } from '../http/error.js';
import { sendJson, setCacheHeaders } from '../http/response.js';
import { validateQuery } from '../validation/validate.js';
import { chartCandlesQuerySchema, type ChartCandlesQuery } from '../lib/chart/candleSchemas.js';
import {
  ChartCandleProviderUnavailableError,
  getChartCandles,
} from '../lib/chart/candleProvider.js';

export const handleChartCandles: RouteHandler = async (req, res) => {
  const rawQuery = validateQuery(chartCandlesQuerySchema, req.query);
  const query: ChartCandlesQuery = { ...rawQuery, limit: rawQuery.limit ?? 168 };

  try {
    const candles = await getChartCandles(query);
    setCacheHeaders(res, { public: false, maxAge: 15 });
    sendJson(res, { candles });
  } catch (error) {
    if (error instanceof ChartCandleProviderUnavailableError) {
      setCacheHeaders(res, { noStore: true });
      throw new AppError(
        error.message,
        503,
        ErrorCodes.PROVIDER_UNAVAILABLE,
        { provider: error.provider }
      );
    }
    throw error;
  }
};
