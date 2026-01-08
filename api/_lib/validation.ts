/**
 * Request Validation Helpers
 * Using zod for schema validation
 */

import { z, ZodError, ZodSchema } from 'zod';
import { badRequest, invalidQuery } from './errors';

export function validateBody<T>(schema: ZodSchema<T>, body: unknown): T {
  try {
    return schema.parse(body);
  } catch (error) {
    if (error instanceof ZodError) {
      const details: Record<string, string[]> = {};
      for (const issue of error.issues) {
        const path = issue.path.join('.') || '_root';
        if (!details[path]) {
          details[path] = [];
        }
        details[path].push(issue.message);
      }
      throw badRequest('Validation failed', details);
    }
    throw badRequest('Invalid request body');
  }
}

export function validateQuery<T>(
  schema: ZodSchema<T>,
  query: Record<string, string | string[] | undefined>
): T {
  try {
    // Flatten query params (take first value if array)
    const flattened: Record<string, string | undefined> = {};
    for (const [key, value] of Object.entries(query)) {
      flattened[key] = Array.isArray(value) ? value[0] : value;
    }
    return schema.parse(flattened);
  } catch (error) {
    if (error instanceof ZodError) {
      const messages = error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
      throw invalidQuery(messages);
    }
    throw invalidQuery('Invalid query parameters');
  }
}

// ─────────────────────────────────────────────────────────────
// COMMON SCHEMAS
// ─────────────────────────────────────────────────────────────

// Search input validation per APPENDIX
export const tickerRegex = /^[A-Z0-9._-]{1,15}$/;
export const solanaAddressRegex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function isValidTicker(value: string): boolean {
  return tickerRegex.test(value);
}

export function isValidSolanaAddress(value: string): boolean {
  return solanaAddressRegex.test(value);
}

export function normalizeSymbolOrAddress(value: string): string {
  // If it matches ticker format, return uppercased
  if (isValidTicker(value.toUpperCase())) {
    return value.toUpperCase();
  }
  // Otherwise return as-is (potential address)
  return value;
}

// ─────────────────────────────────────────────────────────────
// JOURNAL SCHEMAS
// ─────────────────────────────────────────────────────────────

export const journalEntryStatusSchema = z.enum(['pending', 'confirmed', 'archived']);

export const journalCreateRequestSchema = z.object({
  summary: z.string().min(1, 'Summary is required').max(1000),
  timestamp: z.string().datetime().optional(),
});

export const journalListQuerySchema = z.object({
  view: journalEntryStatusSchema.optional(),
  status: journalEntryStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  cursor: z.string().optional(),
});

// ─────────────────────────────────────────────────────────────
// ALERTS SCHEMAS
// ─────────────────────────────────────────────────────────────

export const alertTypeSchema = z.enum(['SIMPLE', 'TWO_STAGE_CONFIRMED', 'DEAD_TOKEN_AWAKENING_V2']);
export const alertStageSchema = z.enum(['INITIAL', 'WATCHING', 'CONFIRMED', 'EXPIRED', 'CANCELLED']);
export const alertStatusSchema = z.enum(['active', 'paused', 'triggered']);
export const alertStatusFilterSchema = z.enum(['all', 'active', 'paused', 'triggered']);

export const simpleConditionSchema = z.enum(['ABOVE', 'BELOW', 'CROSS']);
export const twoStageTemplateSchema = z.enum([
  'TREND_MOMENTUM_STRUCTURE',
  'MACD_RSI_VOLUME',
  'BREAKOUT_RETEST_VOLUME',
]);
export const deadTokenStageSchema = z.enum([
  'INITIAL',
  'AWAKENING',
  'SUSTAINED',
  'SECOND_SURGE',
  'SESSION_ENDED',
]);

export const deadTokenParamsSchema = z.object({
  DEAD_VOL: z.number().nonnegative(),
  DEAD_TRADES: z.number().nonnegative(),
  DEAD_HOLDER_DELTA_6H: z.number(),
  AWAKE_VOL_MULT: z.number().positive(),
  AWAKE_TRADES_MULT: z.number().positive(),
  AWAKE_HOLDER_DELTA_30M: z.number(),
  STAGE2_WINDOW_MIN: z.number().positive(),
  COOLDOWN_MIN: z.number().positive(),
  STAGE3_WINDOW_H: z.number().positive(),
  STAGE3_VOL_MULT: z.number().positive(),
  STAGE3_TRADES_MULT: z.number().positive(),
  STAGE3_HOLDER_DELTA: z.number(),
});

export const createSimpleAlertSchema = z.object({
  type: z.literal('SIMPLE'),
  symbolOrAddress: z.string().min(1),
  timeframe: z.string().min(1),
  condition: simpleConditionSchema,
  targetPrice: z.number().positive(),
  note: z.string().optional(),
});

export const createTwoStageAlertSchema = z.object({
  type: z.literal('TWO_STAGE_CONFIRMED'),
  symbolOrAddress: z.string().min(1),
  timeframe: z.string().min(1),
  template: twoStageTemplateSchema,
  windowCandles: z.number().int().positive().optional(),
  windowMinutes: z.number().int().positive().optional(),
  expiryMinutes: z.number().int().positive(),
  cooldownMinutes: z.number().int().positive(),
  note: z.string().optional(),
});

export const createDeadTokenAlertSchema = z.object({
  type: z.literal('DEAD_TOKEN_AWAKENING_V2'),
  symbolOrAddress: z.string().min(1),
  timeframe: z.string().min(1),
  params: deadTokenParamsSchema,
  note: z.string().optional(),
});

export const createAlertRequestSchema = z.discriminatedUnion('type', [
  createSimpleAlertSchema,
  createTwoStageAlertSchema,
  createDeadTokenAlertSchema,
]);

export const updateAlertRequestSchema = z.object({
  enabled: z.boolean().optional(),
  note: z.string().optional(),
  condition: simpleConditionSchema.optional(),
  targetPrice: z.number().positive().optional(),
});

export const alertsListQuerySchema = z.object({
  filter: alertStatusFilterSchema.optional().default('all'),
  symbolOrAddress: z.string().optional(),
});

export const alertEventsQuerySchema = z.object({
  since: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(500).optional().default(100),
});

// Evaluate endpoint schema
export const alertEvaluateRequestSchema = z.object({
  symbolOrAddress: z.string().min(1).optional(),
  timeframe: z.string().min(1).optional(),
  alertIds: z.array(z.string()).optional(),
  lastSeenTs: z.string().datetime().optional(),
});

// ─────────────────────────────────────────────────────────────
// ORACLE SCHEMAS
// ─────────────────────────────────────────────────────────────

export const oracleDailyQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD').optional(),
});

export const oracleReadStateRequestSchema = z.object({
  id: z.string().min(1, 'ID is required'),
  isRead: z.boolean(),
});

export const oracleBulkReadStateRequestSchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
  isRead: z.boolean(),
});

// ─────────────────────────────────────────────────────────────
// CHART TA SCHEMAS
// ─────────────────────────────────────────────────────────────

export const taRequestSchema = z.object({
  market: z.string().min(1, 'Market is required'),
  timeframe: z.string().min(1, 'Timeframe is required'),
  replay: z.boolean().optional().default(false),
  asOfTs: z.string().datetime().optional(),
  // BACKEND_TODO: chartImageBase64?: string
});

// ─────────────────────────────────────────────────────────────
// TYPE EXPORTS
// ─────────────────────────────────────────────────────────────

export type JournalEntryStatus = z.infer<typeof journalEntryStatusSchema>;
export type JournalCreateRequest = z.infer<typeof journalCreateRequestSchema>;
export type JournalListQuery = z.infer<typeof journalListQuerySchema>;

export type AlertType = z.infer<typeof alertTypeSchema>;
export type AlertStage = z.infer<typeof alertStageSchema>;
export type AlertStatus = z.infer<typeof alertStatusSchema>;
export type SimpleCondition = z.infer<typeof simpleConditionSchema>;
export type TwoStageTemplate = z.infer<typeof twoStageTemplateSchema>;
export type DeadTokenStage = z.infer<typeof deadTokenStageSchema>;
export type DeadTokenParams = z.infer<typeof deadTokenParamsSchema>;
export type CreateAlertRequest = z.infer<typeof createAlertRequestSchema>;
export type UpdateAlertRequest = z.infer<typeof updateAlertRequestSchema>;
export type AlertsListQuery = z.infer<typeof alertsListQuerySchema>;
export type AlertEventsQuery = z.infer<typeof alertEventsQuerySchema>;
export type AlertEvaluateRequest = z.infer<typeof alertEvaluateRequestSchema>;

export type OracleDailyQuery = z.infer<typeof oracleDailyQuerySchema>;
export type OracleReadStateRequest = z.infer<typeof oracleReadStateRequestSchema>;
export type OracleBulkReadStateRequest = z.infer<typeof oracleBulkReadStateRequestSchema>;

export type TARequest = z.infer<typeof taRequestSchema>;
