import { randomUUID } from 'crypto';
import type {
  DeadTokenAlert,
  AlertEmitted,
  DeadTokenParams,
} from './types.js';
import { alertUpdateInternal, alertGetById, type DeadTokenPayload } from './repo.js';
import { alertEventCreate } from './eventsRepo.js';

/**
 * DEAD_TOKEN_AWAKENING_V2 State Machine
 * 
 * Stages: INITIAL → AWAKENING → SUSTAINED → SECOND_SURGE → SESSION_ENDED
 * 
 * Rules:
 * - Precondition: Token must be "dead" (low volume, low trades, no holder growth)
 * - Session max: 12 hours from first awakening
 * - One-shot emits per stage
 * - Cooldown after SESSION_ENDED or SECOND_SURGE
 */

const SESSION_MAX_HOURS = 12;

export interface TokenMetrics {
  volume: number;
  trades: number;
  holderDelta6h: number;
  holderDelta30m: number;
}

export interface DeadTokenEvaluationContext {
  now: Date;
  metrics: TokenMetrics;
}

export interface DeadTokenEvaluationResult {
  alert: DeadTokenAlert;
  event?: AlertEmitted;
  transitioned: boolean;
}

/**
 * Check if token is "dead" according to params
 */
export function isTokenDead(metrics: TokenMetrics, params: DeadTokenParams): boolean {
  return (
    metrics.volume <= params.DEAD_VOL &&
    metrics.trades <= params.DEAD_TRADES &&
    metrics.holderDelta6h <= params.DEAD_HOLDER_DELTA_6H
  );
}

/**
 * Check awakening conditions (2-of-3)
 */
function checkAwakeningConditions(
  metrics: TokenMetrics,
  params: DeadTokenParams,
  baseVolume: number,
  baseTrades: number
): { met: boolean; count: number } {
  let count = 0;
  
  // Volume multiplier
  if (metrics.volume >= baseVolume * params.AWAKE_VOL_MULT) count++;
  
  // Trades multiplier  
  if (metrics.trades >= baseTrades * params.AWAKE_TRADES_MULT) count++;
  
  // Holder delta 30m
  if (metrics.holderDelta30m >= params.AWAKE_HOLDER_DELTA_30M) count++;
  
  return { met: count >= 2, count };
}

/**
 * Check sustained conditions (2-of-3 within window)
 */
function checkSustainedConditions(
  metrics: TokenMetrics,
  params: DeadTokenParams,
  baseVolume: number,
  baseTrades: number
): { met: boolean; count: number } {
  // Same as awakening for sustained phase
  return checkAwakeningConditions(metrics, params, baseVolume, baseTrades);
}

/**
 * Check second surge conditions (2-of-3)
 */
function checkSecondSurgeConditions(
  metrics: TokenMetrics,
  params: DeadTokenParams,
  baseVolume: number,
  baseTrades: number
): { met: boolean; count: number } {
  let count = 0;
  
  // Stage 3 volume multiplier
  if (metrics.volume >= baseVolume * params.STAGE3_VOL_MULT) count++;
  
  // Stage 3 trades multiplier
  if (metrics.trades >= baseTrades * params.STAGE3_TRADES_MULT) count++;
  
  // Stage 3 holder delta
  if (metrics.holderDelta30m >= params.STAGE3_HOLDER_DELTA) count++;
  
  return { met: count >= 2, count };
}

export async function evaluateDeadTokenAlert(
  alert: DeadTokenAlert,
  ctx: DeadTokenEvaluationContext
): Promise<DeadTokenEvaluationResult> {
  const now = ctx.now;
  const nowIso = now.toISOString();
  const { metrics } = ctx;
  const { params } = alert;
  
  // Skip if not enabled
  if (!alert.enabled) {
    return { alert, transitioned: false };
  }
  
  // Check cooldown
  if (alert.cooldownEndsAt && new Date(alert.cooldownEndsAt) > now) {
    return { alert, transitioned: false };
  }
  
  // Check session timeout (12h max)
  if (alert.sessionEndsAt && new Date(alert.sessionEndsAt) <= now) {
    return endSession(alert, nowIso, 'timeout');
  }
  
  // Base metrics for multipliers (use params as baseline)
  const baseVolume = params.DEAD_VOL;
  const baseTrades = params.DEAD_TRADES;
  
  switch (alert.deadTokenStage) {
    case 'INITIAL':
      return evaluateInitial(alert, metrics, nowIso);
      
    case 'AWAKENING':
      return evaluateAwakening(alert, metrics, baseVolume, baseTrades, nowIso);
      
    case 'SUSTAINED':
      return evaluateSustained(alert, metrics, baseVolume, baseTrades, nowIso);
      
    case 'SECOND_SURGE':
      return endSession(alert, nowIso, 'completed');
      
    case 'SESSION_ENDED':
      // Reset to INITIAL if cooldown passed
      return resetToInitial(alert);
      
    default:
      return { alert, transitioned: false };
  }
}

async function evaluateInitial(
  alert: DeadTokenAlert,
  metrics: TokenMetrics,
  nowIso: string
): Promise<DeadTokenEvaluationResult> {
  const { params } = alert;
  
  // Check deadness precondition
  if (!isTokenDead(metrics, params)) {
    return { alert, transitioned: false };
  }
  
  // Check awakening conditions (2-of-3)
  const baseVolume = params.DEAD_VOL;
  const baseTrades = params.DEAD_TRADES;
  const { met } = checkAwakeningConditions(metrics, params, baseVolume, baseTrades);
  
  if (!met) {
    return { alert, transitioned: false };
  }
  
  // Transition to AWAKENING
  const sessionStart = nowIso;
  const sessionEndsAt = new Date(
    Date.now() + SESSION_MAX_HOURS * 60 * 60 * 1000
  ).toISOString();
  const windowEndsAt = new Date(
    Date.now() + params.STAGE2_WINDOW_MIN * 60 * 1000
  ).toISOString();
  
  const payload: DeadTokenPayload = {
    params: alert.params,
    deadTokenStage: 'AWAKENING',
    sessionStart,
    sessionEndsAt,
    windowEndsAt,
  };
  
  await alertUpdateInternal(alert.id, {
    stage: 'WATCHING',
    payload,
  });
  
  const event: AlertEmitted = {
    eventId: randomUUID(),
    type: 'DEAD_TOKEN_STAGE',
    occurredAt: nowIso,
    alertId: alert.id,
    alertType: 'DEAD_TOKEN_AWAKENING_V2',
    symbolOrAddress: alert.symbolOrAddress,
    timeframe: alert.timeframe,
    stage: 'WATCHING',
    status: 'active',
    detail: {
      kind: 'deadToken',
      deadTokenStage: 'AWAKENING',
      sessionStart,
      sessionEndsAt,
      windowEndsAt,
    },
  };
  
  await alertEventCreate(event);
  
  return {
    alert: (await alertGetById(alert.id)) as DeadTokenAlert,
    event,
    transitioned: true,
  };
}

async function evaluateAwakening(
  alert: DeadTokenAlert,
  metrics: TokenMetrics,
  baseVolume: number,
  baseTrades: number,
  nowIso: string
): Promise<DeadTokenEvaluationResult> {
  const { params } = alert;
  
  // Check if window expired
  if (alert.windowEndsAt && new Date(alert.windowEndsAt) <= new Date(nowIso)) {
    return endSession(alert, nowIso, 'window_expired');
  }
  
  // Check sustained conditions
  const { met } = checkSustainedConditions(metrics, params, baseVolume, baseTrades);
  
  if (!met) {
    return { alert, transitioned: false };
  }
  
  // Transition to SUSTAINED
  const windowEndsAt = new Date(
    Date.now() + params.STAGE3_WINDOW_H * 60 * 60 * 1000
  ).toISOString();
  
  const payload: DeadTokenPayload = {
    params: alert.params,
    deadTokenStage: 'SUSTAINED',
    sessionStart: alert.sessionStart,
    sessionEndsAt: alert.sessionEndsAt,
    windowEndsAt,
  };
  
  await alertUpdateInternal(alert.id, { payload });
  
  const event: AlertEmitted = {
    eventId: randomUUID(),
    type: 'DEAD_TOKEN_STAGE',
    occurredAt: nowIso,
    alertId: alert.id,
    alertType: 'DEAD_TOKEN_AWAKENING_V2',
    symbolOrAddress: alert.symbolOrAddress,
    timeframe: alert.timeframe,
    stage: 'WATCHING',
    status: 'active',
    detail: {
      kind: 'deadToken',
      deadTokenStage: 'SUSTAINED',
      sessionStart: alert.sessionStart,
      sessionEndsAt: alert.sessionEndsAt,
      windowEndsAt,
    },
  };
  
  await alertEventCreate(event);
  
  return {
    alert: (await alertGetById(alert.id)) as DeadTokenAlert,
    event,
    transitioned: true,
  };
}

async function evaluateSustained(
  alert: DeadTokenAlert,
  metrics: TokenMetrics,
  baseVolume: number,
  baseTrades: number,
  nowIso: string
): Promise<DeadTokenEvaluationResult> {
  const { params } = alert;
  
  // Check if window expired
  if (alert.windowEndsAt && new Date(alert.windowEndsAt) <= new Date(nowIso)) {
    return endSession(alert, nowIso, 'window_expired');
  }
  
  // Check second surge conditions
  const { met } = checkSecondSurgeConditions(metrics, params, baseVolume, baseTrades);
  
  if (!met) {
    return { alert, transitioned: false };
  }
  
  // Transition to SECOND_SURGE
  const payload: DeadTokenPayload = {
    params: alert.params,
    deadTokenStage: 'SECOND_SURGE',
    sessionStart: alert.sessionStart,
    sessionEndsAt: alert.sessionEndsAt,
  };
  
  await alertUpdateInternal(alert.id, {
    stage: 'CONFIRMED',
    status: 'triggered',
    payload,
  });
  
  const event: AlertEmitted = {
    eventId: randomUUID(),
    type: 'DEAD_TOKEN_STAGE',
    occurredAt: nowIso,
    alertId: alert.id,
    alertType: 'DEAD_TOKEN_AWAKENING_V2',
    symbolOrAddress: alert.symbolOrAddress,
    timeframe: alert.timeframe,
    stage: 'CONFIRMED',
    status: 'triggered',
    detail: {
      kind: 'deadToken',
      deadTokenStage: 'SECOND_SURGE',
      sessionStart: alert.sessionStart,
      sessionEndsAt: alert.sessionEndsAt,
    },
  };
  
  await alertEventCreate(event);
  
  return {
    alert: (await alertGetById(alert.id)) as DeadTokenAlert,
    event,
    transitioned: true,
  };
}

async function endSession(
  alert: DeadTokenAlert,
  nowIso: string,
  reason: 'timeout' | 'window_expired' | 'completed'
): Promise<DeadTokenEvaluationResult> {
  const cooldownEndsAt = new Date(
    Date.now() + alert.params.COOLDOWN_MIN * 60 * 1000
  ).toISOString();
  
  const payload: DeadTokenPayload = {
    params: alert.params,
    deadTokenStage: 'SESSION_ENDED',
    sessionStart: alert.sessionStart,
    sessionEndsAt: alert.sessionEndsAt,
    cooldownEndsAt,
  };
  
  await alertUpdateInternal(alert.id, {
    stage: reason === 'completed' ? 'CONFIRMED' : 'EXPIRED',
    status: reason === 'completed' ? 'triggered' : 'paused',
    enabled: reason === 'completed' ? 1 : 0,
    cooldown_ends_at: cooldownEndsAt,
    payload,
  });
  
  const event: AlertEmitted = {
    eventId: randomUUID(),
    type: 'DEAD_TOKEN_SESSION_ENDED',
    occurredAt: nowIso,
    alertId: alert.id,
    alertType: 'DEAD_TOKEN_AWAKENING_V2',
    symbolOrAddress: alert.symbolOrAddress,
    timeframe: alert.timeframe,
    stage: reason === 'completed' ? 'CONFIRMED' : 'EXPIRED',
    status: reason === 'completed' ? 'triggered' : 'paused',
    detail: {
      kind: 'deadToken',
      deadTokenStage: 'SESSION_ENDED',
      sessionStart: alert.sessionStart,
      sessionEndsAt: alert.sessionEndsAt,
    },
  };
  
  await alertEventCreate(event);
  
  return {
    alert: (await alertGetById(alert.id)) as DeadTokenAlert,
    event,
    transitioned: true,
  };
}

async function resetToInitial(alert: DeadTokenAlert): Promise<DeadTokenEvaluationResult> {
  const payload: DeadTokenPayload = {
    params: alert.params,
    deadTokenStage: 'INITIAL',
  };
  
  await alertUpdateInternal(alert.id, {
    stage: 'WATCHING',
    status: 'active',
    enabled: 1,
    cooldown_ends_at: null,
    payload,
  });
  
  return {
    alert: (await alertGetById(alert.id)) as DeadTokenAlert,
    transitioned: true,
  };
}
