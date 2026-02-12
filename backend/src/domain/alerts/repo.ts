import { randomUUID } from 'crypto';
import { getDatabase } from '../../db/index.js';
import type {
  Alert,
  AlertRow,
  AlertStatus,
  AlertStage,
  SimpleAlert,
  TwoStageAlert,
  DeadTokenAlert,
  IndicatorState,
  DeadTokenParams,
} from './types.js';

/**
 * Alert Repository
 * Handles persistence for alerts
 */

// Template indicators for two-stage alerts
const templateIndicators: Record<string, Omit<IndicatorState, 'triggered' | 'lastValue'>[]> = {
  TREND_MOMENTUM_STRUCTURE: [
    { id: 'ema_cross', label: 'EMA 9/21 Cross', category: 'Trend', params: 'EMA(9) > EMA(21)' },
    { id: 'rsi_momentum', label: 'RSI Momentum', category: 'Momentum', params: 'RSI(14) > 50' },
    { id: 'structure_hh', label: 'Higher High', category: 'Structure', params: 'New swing high' },
  ],
  MACD_RSI_VOLUME: [
    { id: 'macd_signal', label: 'MACD Signal', category: 'Trend', params: 'MACD > Signal' },
    { id: 'rsi_threshold', label: 'RSI Above 55', category: 'Momentum', params: 'RSI(14) > 55' },
    { id: 'volume_spike', label: 'Volume Spike', category: 'Volume', params: 'Vol > 1.5x avg' },
  ],
  BREAKOUT_RETEST_VOLUME: [
    { id: 'breakout', label: 'Resistance Break', category: 'Structure', params: 'Close > R1' },
    { id: 'retest', label: 'Successful Retest', category: 'Structure', params: 'Retest support' },
    { id: 'breakout_vol', label: 'Breakout Volume', category: 'Volume', params: 'Vol > 2x avg' },
  ],
};

export interface SimplePayload {
  condition: string;
  targetPrice: number;
  triggeredAt?: string;
}

export interface TwoStagePayload {
  template: string;
  windowCandles?: number;
  windowMinutes?: number;
  expiryMinutes: number;
  cooldownMinutes: number;
  indicators: IndicatorState[];
  triggeredCount: number;
  lastTriggeredAt?: string;
  expiresAt?: string;
}

export interface DeadTokenPayload {
  params: DeadTokenParams;
  deadTokenStage: string;
  sessionStart?: string;
  sessionEndsAt?: string;
  windowEndsAt?: string;
  cooldownEndsAt?: string;
}

export type AlertPayload = SimplePayload | TwoStagePayload | DeadTokenPayload;

function rowToAlert(row: AlertRow): Alert {
  const payload = JSON.parse(row.payload_json) as AlertPayload;
  
  const base = {
    id: row.id,
    symbolOrAddress: row.symbol_or_address,
    timeframe: row.timeframe,
    enabled: row.enabled === 1,
    status: row.status as AlertStatus,
    stage: row.stage as AlertStage,
    createdAt: row.created_at,
    note: row.note || undefined,
  };
  
  switch (row.type) {
    case 'SIMPLE': {
      const p = payload as SimplePayload;
      return {
        ...base,
        type: 'SIMPLE',
        condition: p.condition,
        targetPrice: p.targetPrice,
        triggeredAt: p.triggeredAt,
      } as SimpleAlert;
    }
    case 'TWO_STAGE_CONFIRMED': {
      const p = payload as TwoStagePayload;
      return {
        ...base,
        type: 'TWO_STAGE_CONFIRMED',
        template: p.template,
        windowCandles: p.windowCandles,
        windowMinutes: p.windowMinutes,
        expiryMinutes: p.expiryMinutes,
        cooldownMinutes: p.cooldownMinutes,
        indicators: p.indicators,
        triggeredCount: p.triggeredCount,
        lastTriggeredAt: p.lastTriggeredAt,
        expiresAt: p.expiresAt || row.expires_at || undefined,
      } as TwoStageAlert;
    }
    case 'DEAD_TOKEN_AWAKENING_V2': {
      const p = payload as DeadTokenPayload;
      const result: DeadTokenAlert = {
        ...base,
        type: 'DEAD_TOKEN_AWAKENING_V2',
        params: p.params,
        deadTokenStage: p.deadTokenStage as DeadTokenAlert['deadTokenStage'],
        sessionStart: p.sessionStart,
        sessionEndsAt: p.sessionEndsAt,
        windowEndsAt: p.windowEndsAt,
        cooldownEndsAt: p.cooldownEndsAt || row.cooldown_ends_at || undefined,
      };
      return result;
    }
    default:
      throw new Error(`Unknown alert type: ${row.type}`);
  }
}

export interface CreateSimpleAlertRequest {
  type: 'SIMPLE';
  symbolOrAddress: string;
  timeframe: string;
  condition: string;
  targetPrice: number;
  note?: string;
}

export interface CreateTwoStageAlertRequest {
  type: 'TWO_STAGE_CONFIRMED';
  symbolOrAddress: string;
  timeframe: string;
  template: string;
  windowCandles?: number;
  windowMinutes?: number;
  expiryMinutes: number;
  cooldownMinutes: number;
  note?: string;
}

export interface CreateDeadTokenAlertRequest {
  type: 'DEAD_TOKEN_AWAKENING_V2';
  symbolOrAddress: string;
  timeframe: string;
  params: DeadTokenParams;
  note?: string;
}

export type CreateAlertRequest =
  | CreateSimpleAlertRequest
  | CreateTwoStageAlertRequest
  | CreateDeadTokenAlertRequest;

export async function alertCreate(request: CreateAlertRequest): Promise<Alert> {
  const db = getDatabase();
  const now = new Date().toISOString();
  const id = `alert-${Date.now()}-${randomUUID().slice(0, 8)}`;
  
  let payload: AlertPayload;
  let expiresAt: string | null = null;
  
  switch (request.type) {
    case 'SIMPLE':
      payload = {
        condition: request.condition,
        targetPrice: request.targetPrice,
      };
      break;
    case 'TWO_STAGE_CONFIRMED': {
      const templateConfig = templateIndicators[request.template];
      if (!templateConfig) {
        throw new Error(`Unknown template: ${request.template}`);
      }
      
      const indicators: IndicatorState[] = templateConfig.map(i => ({
        ...i,
        triggered: false,
      }));
      
      expiresAt = new Date(Date.now() + request.expiryMinutes * 60 * 1000).toISOString();
      
      payload = {
        template: request.template,
        windowCandles: request.windowCandles,
        windowMinutes: request.windowMinutes,
        expiryMinutes: request.expiryMinutes,
        cooldownMinutes: request.cooldownMinutes,
        indicators,
        triggeredCount: 0,
        expiresAt,
      };
      break;
    }
    case 'DEAD_TOKEN_AWAKENING_V2':
      payload = {
        params: request.params,
        deadTokenStage: 'INITIAL',
      };
      break;
  }
  
  await db.prepare(`
    INSERT INTO alerts_v1 (
      id, type, symbol_or_address, timeframe, enabled, status, stage,
      created_at, note, payload_json, expires_at, cooldown_ends_at, updated_at
    ) VALUES (?, ?, ?, ?, 1, 'active', 'WATCHING', ?, ?, ?, ?, NULL, ?)
  `).run(
    id,
    request.type,
    request.symbolOrAddress,
    request.timeframe,
    now,
    request.note || null,
    JSON.stringify(payload),
    expiresAt,
    now
  );
  
  const created = await alertGetById(id);
  if (!created) {
    throw new Error('Failed to create alert');
  }
  
  return created;
}

export async function alertGetById(id: string): Promise<Alert | null> {
  const db = getDatabase();

  const row = await db
    .prepare(`
    SELECT * FROM alerts_v1 WHERE id = ?
  `)
    .get<AlertRow>(id);

  if (!row) {
    return null;
  }
  
  return rowToAlert(row);
}

export async function alertList(
  filter: 'all' | 'active' | 'paused' | 'triggered' = 'all',
  symbolOrAddress?: string
): Promise<Alert[]> {
  const db = getDatabase();
  
  let query = 'SELECT * FROM alerts_v1';
  const conditions: string[] = [];
  const params: string[] = [];
  
  if (filter !== 'all') {
    conditions.push('status = ?');
    params.push(filter);
  }
  
  if (symbolOrAddress) {
    conditions.push('symbol_or_address = ?');
    params.push(symbolOrAddress);
  }
  
  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }
  
  query += ' ORDER BY created_at DESC';
  
  const rows = await db.prepare(query).all<AlertRow>(...params);

  return rows.map(rowToAlert);
}

export interface UpdateAlertRequest {
  enabled?: boolean;
  note?: string;
  condition?: string;
  targetPrice?: number;
}

export async function alertUpdate(id: string, updates: UpdateAlertRequest): Promise<Alert | null> {
  const db = getDatabase();
  const now = new Date().toISOString();

  const alert = await alertGetById(id);
  if (!alert) {
    return null;
  }
  
  const setClauses: string[] = ['updated_at = ?'];
  const params: (string | number)[] = [now];
  
  if (updates.enabled !== undefined) {
    setClauses.push('enabled = ?');
    params.push(updates.enabled ? 1 : 0);
    
    // Update status based on enabled
    if (!updates.enabled) {
      setClauses.push("status = 'paused'");
    } else if (alert.stage !== 'CONFIRMED' && alert.stage !== 'EXPIRED' && alert.stage !== 'CANCELLED') {
      setClauses.push("status = 'active'");
    }
  }
  
  if (updates.note !== undefined) {
    setClauses.push('note = ?');
    params.push(updates.note);
  }
  
  // Handle SIMPLE-specific updates
  if (alert.type === 'SIMPLE' && (updates.condition !== undefined || updates.targetPrice !== undefined)) {
    const payload = JSON.parse(
      (
        await db
          .prepare('SELECT payload_json FROM alerts_v1 WHERE id = ?')
          .get<{ payload_json: string }>(id)
      )?.payload_json ?? '{}'
    ) as SimplePayload;
    
    if (updates.condition !== undefined) {
      payload.condition = updates.condition;
    }
    if (updates.targetPrice !== undefined) {
      payload.targetPrice = updates.targetPrice;
    }
    
    setClauses.push('payload_json = ?');
    params.push(JSON.stringify(payload));
  }
  
  params.push(id);
  
  await db.prepare(`UPDATE alerts_v1 SET ${setClauses.join(', ')} WHERE id = ?`).run(...params);

  return alertGetById(id);
}

export async function alertCancelWatch(id: string): Promise<Alert | null> {
  const db = getDatabase();
  const now = new Date().toISOString();

  const alert = await alertGetById(id);
  if (!alert) {
    return null;
  }

  await db.prepare(`
    UPDATE alerts_v1
    SET stage = 'CANCELLED', enabled = 0, status = 'paused', updated_at = ?
    WHERE id = ?
  `).run(now, id);

  return alertGetById(id);
}

export async function alertDelete(id: string): Promise<boolean> {
  const db = getDatabase();

  const result = await db.prepare('DELETE FROM alerts_v1 WHERE id = ?').run(id);

  return result.changes > 0;
}

export async function alertUpdateInternal(
  id: string,
  updates: Partial<AlertRow> & { payload?: AlertPayload }
): Promise<void> {
  const db = getDatabase();
  const now = new Date().toISOString();
  
  const setClauses: string[] = ['updated_at = ?'];
  const params: (string | number | null)[] = [now];
  
  if (updates.status !== undefined) {
    setClauses.push('status = ?');
    params.push(updates.status);
  }
  
  if (updates.stage !== undefined) {
    setClauses.push('stage = ?');
    params.push(updates.stage);
  }
  
  if (updates.enabled !== undefined) {
    setClauses.push('enabled = ?');
    params.push(updates.enabled);
  }
  
  if (updates.expires_at !== undefined) {
    setClauses.push('expires_at = ?');
    params.push(updates.expires_at);
  }
  
  if (updates.cooldown_ends_at !== undefined) {
    setClauses.push('cooldown_ends_at = ?');
    params.push(updates.cooldown_ends_at);
  }
  
  if (updates.payload !== undefined) {
    setClauses.push('payload_json = ?');
    params.push(JSON.stringify(updates.payload));
  }
  
  params.push(id);
  
  await db.prepare(`UPDATE alerts_v1 SET ${setClauses.join(', ')} WHERE id = ?`).run(...params);
}
