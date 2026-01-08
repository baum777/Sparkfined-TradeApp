import type { ServerResponse } from 'http';
import type { ParsedRequest } from '../http/router.js';
import { handleOracleDaily } from './oracle.js';
 
/**
 * Market Endpoints (Aliases)
 * - GET /api/market/daily-bias
 *
 * Alias of /api/oracle/daily to avoid frontend rewiring.
 */
 
export function handleMarketDailyBias(req: ParsedRequest, res: ServerResponse): void {
  // Internal alias: reuse canonical oracle daily handler (same envelope).
  handleOracleDaily(req, res);
}

