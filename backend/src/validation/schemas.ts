import { z } from 'zod';

/**
 * Shared Validation Schemas
 * Matches CONTRACTS.md definitions
 */

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
// SETTINGS SCHEMAS
// ─────────────────────────────────────────────────────────────

export const settingsPatchSchema = z.object({
  ai: z
    .object({
      grokEnabled: z.boolean().optional(),
    })
    .optional(),
});

// ─────────────────────────────────────────────────────────────
// JOURNAL INSIGHTS SCHEMAS
// ─────────────────────────────────────────────────────────────

export const journalInsightsRequestSchema = z.object({
  kind: z.enum(['teaser', 'review', 'playbook', 'adaptiveCoach']).optional(),
  includeGrok: z.boolean().optional(),
  includeContextPack: z.boolean().optional(),
  contextPackAnchorMode: z.enum(['trade_centered', 'now_centered', 'launch_centered', 'latest_only']).optional(),
  includeDeltas: z.boolean().optional(),
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

// ─────────────────────────────────────────────────────────────
// ORACLE SCHEMAS
// ─────────────────────────────────────────────────────────────

export const oracleDailyQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD').optional(),
  asset: z.string().min(1, 'asset is required').optional(),
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
// FEEDS & SIGNALS SCHEMAS (Theme Group 5)
// ─────────────────────────────────────────────────────────────

export const feedOracleQuerySchema = z.object({
  asset: z.string().min(1, 'asset is required'),
});

export const feedPulseQuerySchema = z.object({
  asset: z.string().min(1, 'asset is required'),
});

export const signalsUnifiedQuerySchema = z.object({
  asset: z.string().min(1, 'asset is required'),
  filter: z.string().optional(),
  sort: z.string().optional(),
});

// ─────────────────────────────────────────────────────────────
// CHART TA SCHEMAS
// ─────────────────────────────────────────────────────────────

export const taRequestSchema = z.object({
  market: z.string().min(1, 'Market is required'),
  timeframe: z.string().min(1, 'Timeframe is required'),
  replay: z.boolean(),
});

// ─────────────────────────────────────────────────────────────
// SOL CHART ANALYSIS (JSON+Text) — Phase-2 onchain gating
// ─────────────────────────────────────────────────────────────

const solTimeframeSchema = z.enum(['15s', '30s', '1m', '5m', '15m', '30m', '1h', '4h']);
const analysisTierSchema = z.enum(['free', 'standard', 'pro', 'high']);
const chartTaskKindSchema = z.enum([
  'chart_teaser_free',
  'chart_setups',
  'chart_patterns_validate',
  'chart_confluence_onchain',
  'chart_microstructure',
]);

const inputCandleSchema = z.object({
  ts: z.number().int().nonnegative(),
  open: z.number(),
  high: z.number(),
  low: z.number(),
  close: z.number(),
  volume: z.number(),
});

export const chartAnalysisRequestSchema = z.object({
  mint: z.string().min(1),
  symbol: z.string().min(1).optional(),
  timeframe: solTimeframeSchema,
  candles: z.array(inputCandleSchema).min(20),
  tier: analysisTierSchema.optional(),
  taskKind: chartTaskKindSchema.optional(),
  chartContext: z
    .object({
      nearResistance: z.boolean().optional(),
    })
    .optional(),
});

// ─────────────────────────────────────────────────────────────
// TYPE EXPORTS
// ─────────────────────────────────────────────────────────────

export type JournalCreateRequest = z.infer<typeof journalCreateRequestSchema>;
export type JournalListQuery = z.infer<typeof journalListQuerySchema>;

export type CreateAlertRequest = z.infer<typeof createAlertRequestSchema>;
export type UpdateAlertRequest = z.infer<typeof updateAlertRequestSchema>;
export type AlertsListQuery = z.infer<typeof alertsListQuerySchema>;
export type AlertEventsQuery = z.infer<typeof alertEventsQuerySchema>;

export type OracleDailyQuery = z.infer<typeof oracleDailyQuerySchema>;
export type OracleReadStateRequest = z.infer<typeof oracleReadStateRequestSchema>;
export type OracleBulkReadStateRequest = z.infer<typeof oracleBulkReadStateRequestSchema>;

export type FeedOracleQuery = z.infer<typeof feedOracleQuerySchema>;
export type FeedPulseQuery = z.infer<typeof feedPulseQuerySchema>;
export type SignalsUnifiedQuery = z.infer<typeof signalsUnifiedQuerySchema>;

export type TARequest = z.infer<typeof taRequestSchema>;
export type ChartAnalysisRequest = z.infer<typeof chartAnalysisRequestSchema>;
