import { logger } from '../observability/logger.js';
import {
  evaluateAlerts,
  createDeterministicPriceFeed,
  createDeterministicTokenMetrics,
  createDeterministicIndicatorProvider,
} from '../domain/alerts/evaluator.js';

export interface AlertEvaluatorJobResult {
  evaluated: number;
  emitted: number;
}

export async function runAlertEvaluatorJob(): Promise<AlertEvaluatorJobResult> {
  const ctx = {
    now: new Date(),
    priceFeed: createDeterministicPriceFeed('alerts'),
    tokenMetrics: createDeterministicTokenMetrics('alerts'),
    indicators: createDeterministicIndicatorProvider('alerts'),
  };

  const result = await evaluateAlerts(ctx);
  logger.info('Alert evaluator tick', {
    evaluated: result.evaluated,
    emitted: result.events.length,
  });

  return { evaluated: result.evaluated, emitted: result.events.length };
}

