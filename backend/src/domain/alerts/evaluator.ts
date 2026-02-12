import { randomUUID } from 'crypto';
import type {
  Alert,
  SimpleAlert,
  TwoStageAlert,
  DeadTokenAlert,
  AlertEmitted,
} from './types.js';
import { alertList, alertUpdateInternal } from './repo.js';
import { alertEventCreate } from './eventsRepo.js';
import { evaluateTwoStageAlert, type TwoStageEvaluationContext } from './twoStageMachine.js';
import { evaluateDeadTokenAlert, type DeadTokenEvaluationContext, type TokenMetrics } from './deadTokenMachine.js';

/**
 * Alert Evaluator
 * Processes all active alerts against current market data
 */

export interface PriceFeedProvider {
  getLastPrice(symbolOrAddress: string, timeframe: string): number;
}

export interface TokenMetricsProvider {
  getMetrics(symbolOrAddress: string): TokenMetrics;
}

export interface IndicatorProvider {
  evaluateIndicators(
    symbolOrAddress: string,
    timeframe: string,
    indicatorIds: string[]
  ): Map<string, { triggered: boolean; value?: string }>;
}

export interface EvaluatorContext {
  now: Date;
  priceFeed: PriceFeedProvider;
  tokenMetrics: TokenMetricsProvider;
  indicators: IndicatorProvider;
}

export interface EvaluationResult {
  evaluated: number;
  events: AlertEmitted[];
}

/**
 * Evaluate all active alerts
 */
export async function evaluateAlerts(ctx: EvaluatorContext): Promise<EvaluationResult> {
  const alerts = await alertList('active');
  const events: AlertEmitted[] = [];

  for (const alert of alerts) {
    const result = await evaluateAlert(alert, ctx);
    if (result) {
      events.push(result);
    }
  }

  return {
    evaluated: alerts.length,
    events,
  };
}

async function evaluateAlert(
  alert: Alert,
  ctx: EvaluatorContext
): Promise<AlertEmitted | undefined> {
  switch (alert.type) {
    case 'SIMPLE':
      return evaluateSimpleAlert(alert, ctx);
    case 'TWO_STAGE_CONFIRMED':
      return evaluateTwoStage(alert, ctx);
    case 'DEAD_TOKEN_AWAKENING_V2':
      return evaluateDeadToken(alert, ctx);
    default:
      return undefined;
  }
}

async function evaluateSimpleAlert(
  alert: SimpleAlert,
  ctx: EvaluatorContext
): Promise<AlertEmitted | undefined> {
  if (!alert.enabled || alert.stage !== 'WATCHING') {
    return undefined;
  }
  
  const lastPrice = ctx.priceFeed.getLastPrice(alert.symbolOrAddress, alert.timeframe);
  const triggered = checkSimpleCondition(alert.condition, lastPrice, alert.targetPrice);
  
  if (!triggered) {
    return undefined;
  }
  
  const nowIso = ctx.now.toISOString();
  
  // Update alert
  await alertUpdateInternal(alert.id, {
    stage: 'CONFIRMED',
    status: 'triggered',
    payload: {
      condition: alert.condition,
      targetPrice: alert.targetPrice,
      triggeredAt: nowIso,
    },
  });
  
  const event: AlertEmitted = {
    eventId: randomUUID(),
    type: 'SIMPLE_TRIGGERED',
    occurredAt: nowIso,
    alertId: alert.id,
    alertType: 'SIMPLE',
    symbolOrAddress: alert.symbolOrAddress,
    timeframe: alert.timeframe,
    stage: 'CONFIRMED',
    status: 'triggered',
    detail: {
      kind: 'simple',
      condition: alert.condition,
      targetPrice: alert.targetPrice,
      lastPrice,
    },
  };
  
  await alertEventCreate(event);
  
  return event;
}

function checkSimpleCondition(
  condition: string,
  lastPrice: number,
  targetPrice: number
): boolean {
  switch (condition) {
    case 'ABOVE':
      return lastPrice >= targetPrice;
    case 'BELOW':
      return lastPrice <= targetPrice;
    case 'CROSS':
      // For CROSS, we'd need previous price to detect crossing
      // Simplified: just check if price is near target (within 0.1%)
      return Math.abs(lastPrice - targetPrice) / targetPrice < 0.001;
    default:
      return false;
  }
}

async function evaluateTwoStage(
  alert: TwoStageAlert,
  ctx: EvaluatorContext
): Promise<AlertEmitted | undefined> {
  const indicatorIds = alert.indicators.map(i => i.id);
  const indicatorValues = ctx.indicators.evaluateIndicators(
    alert.symbolOrAddress,
    alert.timeframe,
    indicatorIds
  );
  
  const evalCtx: TwoStageEvaluationContext = {
    now: ctx.now,
    indicatorValues,
  };
  
  const result = await evaluateTwoStageAlert(alert, evalCtx);
  return result.event;
}

async function evaluateDeadToken(
  alert: DeadTokenAlert,
  ctx: EvaluatorContext
): Promise<AlertEmitted | undefined> {
  const metrics = ctx.tokenMetrics.getMetrics(alert.symbolOrAddress);
  
  const evalCtx: DeadTokenEvaluationContext = {
    now: ctx.now,
    metrics,
  };
  
  const result = await evaluateDeadTokenAlert(alert, evalCtx);
  return result.event;
}

/**
 * Deterministic stub providers for testing
 */
export function createDeterministicPriceFeed(seed: string): PriceFeedProvider {
  return {
    getLastPrice(symbolOrAddress: string, timeframe: string): number {
      // Deterministic hash-based price
      const hash = simpleHash(`${seed}:${symbolOrAddress}:${timeframe}:${Math.floor(Date.now() / 60000)}`);
      // Generate price between 0.1 and 1000
      return 0.1 + (hash % 100000) / 100;
    },
  };
}

export function createDeterministicTokenMetrics(seed: string): TokenMetricsProvider {
  return {
    getMetrics(symbolOrAddress: string): TokenMetrics {
      const hash = simpleHash(`${seed}:${symbolOrAddress}:${Math.floor(Date.now() / 60000)}`);
      return {
        volume: hash % 1000,
        trades: hash % 100,
        holderDelta6h: (hash % 20) - 10,
        holderDelta30m: (hash % 10) - 5,
      };
    },
  };
}

export function createDeterministicIndicatorProvider(seed: string): IndicatorProvider {
  return {
    evaluateIndicators(
      symbolOrAddress: string,
      timeframe: string,
      indicatorIds: string[]
    ): Map<string, { triggered: boolean; value?: string }> {
      const results = new Map<string, { triggered: boolean; value?: string }>();
      
      for (const id of indicatorIds) {
        const hash = simpleHash(`${seed}:${symbolOrAddress}:${timeframe}:${id}:${Math.floor(Date.now() / 60000)}`);
        results.set(id, {
          triggered: hash % 2 === 0,
          value: (hash % 100).toString(),
        });
      }
      
      return results;
    },
  };
}

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}
