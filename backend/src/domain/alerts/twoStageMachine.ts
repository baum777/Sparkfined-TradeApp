import { randomUUID } from 'crypto';
import type {
  TwoStageAlert,
  AlertEmitted,
  IndicatorState,
} from './types.js';
import { alertUpdateInternal, alertGetById, type TwoStagePayload } from './repo.js';
import { alertEventCreate } from './eventsRepo.js';

/**
 * TWO_STAGE_CONFIRMED State Machine
 * 
 * States: INITIAL → WATCHING → CONFIRMED → EXPIRED/CANCELLED
 * 
 * Rules:
 * - 2-of-3 indicators must trigger within window
 * - One-shot: once CONFIRMED, no further confirmations
 * - Expiry: if window elapses before 2-of-3, transition to EXPIRED
 * - Cooldown: after CONFIRMED, cooldown period before re-arm
 */

export interface TwoStageEvaluationContext {
  now: Date;
  indicatorValues: Map<string, { triggered: boolean; value?: string }>;
}

export interface TwoStageEvaluationResult {
  alert: TwoStageAlert;
  event?: AlertEmitted;
  transitioned: boolean;
}

export async function evaluateTwoStageAlert(
  alert: TwoStageAlert,
  ctx: TwoStageEvaluationContext
): Promise<TwoStageEvaluationResult> {
  const now = ctx.now;
  const nowIso = now.toISOString();
  
  // Skip if not in active watching state
  if (!alert.enabled || alert.stage !== 'WATCHING') {
    return { alert, transitioned: false };
  }
  
  // Check expiry
  if (alert.expiresAt && new Date(alert.expiresAt) <= now) {
    return expireAlert(alert, nowIso);
  }
  
  // Update indicator states
  const updatedIndicators = alert.indicators.map(ind => {
    const evalResult = ctx.indicatorValues.get(ind.id);
    if (evalResult) {
      return {
        ...ind,
        triggered: evalResult.triggered,
        lastValue: evalResult.value,
      };
    }
    return ind;
  });
  
  const triggeredCount = updatedIndicators.filter(i => i.triggered).length;
  
  // Check for 2-of-3 confirmation
  if (triggeredCount >= 2) {
    return confirmAlert(alert, updatedIndicators, triggeredCount, nowIso);
  }
  
  // Update progress if indicators changed
  const previousCount = alert.triggeredCount;
  if (triggeredCount !== previousCount) {
    return updateProgress(alert, updatedIndicators, triggeredCount, nowIso);
  }
  
  return { alert, transitioned: false };
}

async function expireAlert(
  alert: TwoStageAlert,
  nowIso: string
): Promise<TwoStageEvaluationResult> {
  // Update in database
  await alertUpdateInternal(alert.id, {
    stage: 'EXPIRED',
    status: 'paused',
    enabled: 0,
  });
  
  const event: AlertEmitted = {
    eventId: randomUUID(),
    type: 'TWO_STAGE_EXPIRED',
    occurredAt: nowIso,
    alertId: alert.id,
    alertType: 'TWO_STAGE_CONFIRMED',
    symbolOrAddress: alert.symbolOrAddress,
    timeframe: alert.timeframe,
    stage: 'EXPIRED',
    status: 'paused',
    detail: {
      kind: 'twoStage',
      template: alert.template,
      triggeredCount: alert.triggeredCount,
      indicators: alert.indicators,
      expiresAt: alert.expiresAt,
    },
  };
  
  await alertEventCreate(event);

  const updatedAlert = (await alertGetById(alert.id)) as TwoStageAlert;
  
  return {
    alert: updatedAlert,
    event,
    transitioned: true,
  };
}

async function confirmAlert(
  alert: TwoStageAlert,
  indicators: IndicatorState[],
  triggeredCount: number,
  nowIso: string
): Promise<TwoStageEvaluationResult> {
  // Calculate cooldown end
  const cooldownEndsAt = new Date(
    Date.now() + alert.cooldownMinutes * 60 * 1000
  ).toISOString();
  
  // Update in database
  const payload: TwoStagePayload = {
    template: alert.template,
    windowCandles: alert.windowCandles,
    windowMinutes: alert.windowMinutes,
    expiryMinutes: alert.expiryMinutes,
    cooldownMinutes: alert.cooldownMinutes,
    indicators,
    triggeredCount,
    lastTriggeredAt: nowIso,
    expiresAt: alert.expiresAt,
  };
  
  await alertUpdateInternal(alert.id, {
    stage: 'CONFIRMED',
    status: 'triggered',
    cooldown_ends_at: cooldownEndsAt,
    payload,
  });
  
  const event: AlertEmitted = {
    eventId: randomUUID(),
    type: 'TWO_STAGE_CONFIRMED',
    occurredAt: nowIso,
    alertId: alert.id,
    alertType: 'TWO_STAGE_CONFIRMED',
    symbolOrAddress: alert.symbolOrAddress,
    timeframe: alert.timeframe,
    stage: 'CONFIRMED',
    status: 'triggered',
    detail: {
      kind: 'twoStage',
      template: alert.template,
      triggeredCount,
      indicators,
      expiresAt: alert.expiresAt,
    },
  };
  
  await alertEventCreate(event);

  const updatedAlert = (await alertGetById(alert.id)) as TwoStageAlert;
  
  return {
    alert: updatedAlert,
    event,
    transitioned: true,
  };
}

async function updateProgress(
  alert: TwoStageAlert,
  indicators: IndicatorState[],
  triggeredCount: number,
  nowIso: string
): Promise<TwoStageEvaluationResult> {
  // Update indicators in database
  const payload: TwoStagePayload = {
    template: alert.template,
    windowCandles: alert.windowCandles,
    windowMinutes: alert.windowMinutes,
    expiryMinutes: alert.expiryMinutes,
    cooldownMinutes: alert.cooldownMinutes,
    indicators,
    triggeredCount,
    lastTriggeredAt: triggeredCount > 0 ? nowIso : alert.lastTriggeredAt,
    expiresAt: alert.expiresAt,
  };
  
  await alertUpdateInternal(alert.id, { payload });
  
  // Emit progress event (optional, for UI updates)
  const event: AlertEmitted = {
    eventId: randomUUID(),
    type: 'TWO_STAGE_PROGRESS',
    occurredAt: nowIso,
    alertId: alert.id,
    alertType: 'TWO_STAGE_CONFIRMED',
    symbolOrAddress: alert.symbolOrAddress,
    timeframe: alert.timeframe,
    stage: 'WATCHING',
    status: 'active',
    detail: {
      kind: 'twoStage',
      template: alert.template,
      triggeredCount,
      indicators,
      windowEndsAt: alert.windowMinutes
        ? new Date(Date.now() + alert.windowMinutes * 60 * 1000).toISOString()
        : undefined,
      expiresAt: alert.expiresAt,
    },
  };
  
  await alertEventCreate(event);
  
  const updatedAlert = (await alertGetById(alert.id)) as TwoStageAlert;
  
  return {
    alert: updatedAlert,
    event,
    transitioned: false,
  };
}

/**
 * Check if alert is in cooldown
 */
export function isInCooldown(alert: TwoStageAlert, now: Date): boolean {
  if (!alert.expiresAt) return false;
  
  const expiresAt = new Date(alert.expiresAt);
  return expiresAt > now && alert.stage === 'CONFIRMED';
}
