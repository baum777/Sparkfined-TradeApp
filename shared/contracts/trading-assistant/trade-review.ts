import { z } from 'zod';

export const TRADE_REVIEW_V1_SCHEMA_VERSION = 'trade_review_v1' as const;

export const tradeDirectionV1Schema = z.enum(['long', 'short', 'none']);
export const tradeReviewDecisionV1Schema = z.enum([
  'no_trade',
  'paper_trade_candidate',
  'blocked_by_risk',
]);

const confidenceSchema = z.number().min(0).max(1);
const nonEmptyStringArraySchema = z.array(z.string().min(1));

export const assistantDecisionV1Schema = z.discriminatedUnion('decision', [
  z.object({
    decision: z.literal('no_trade'),
    direction: z.literal('none'),
    confidence: confidenceSchema,
    rationale: nonEmptyStringArraySchema,
  }),
  z.object({
    decision: z.literal('paper_trade_candidate'),
    direction: z.enum(['long', 'short']),
    confidence: confidenceSchema,
    rationale: nonEmptyStringArraySchema,
  }),
  z.object({
    decision: z.literal('blocked_by_risk'),
    direction: tradeDirectionV1Schema,
    confidence: confidenceSchema,
    rationale: nonEmptyStringArraySchema,
  }),
]);

export const marketDataQualityV1Schema = z.object({
  dataFreshness: z.enum(['fresh', 'delayed', 'fallback', 'stale']),
  asOf: z.string().datetime(),
  sources: nonEmptyStringArraySchema,
  warnings: nonEmptyStringArraySchema,
});

export const riskDecisionV1Schema = z.object({
  maxRiskPct: z.number().min(0).max(100).optional(),
  stopLoss: z.number().positive().optional(),
  takeProfit: z.number().positive().optional(),
  positionSizing: z.enum(['none', 'paper_only', 'reduced', 'standard']).optional(),
  warnings: nonEmptyStringArraySchema,
});

export const tradeReviewV1Schema = z
  .object({
    schemaVersion: z.literal(TRADE_REVIEW_V1_SCHEMA_VERSION),
    referenceId: z.string().min(1),
    createdAt: z.string().datetime(),
    assistantDecision: assistantDecisionV1Schema,
    marketDataQuality: marketDataQualityV1Schema,
    riskDecision: riskDecisionV1Schema,
  })
  .superRefine((review, ctx) => {
    if (review.assistantDecision.decision === 'paper_trade_candidate') {
      if (['fallback', 'stale'].includes(review.marketDataQuality.dataFreshness)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['marketDataQuality', 'dataFreshness'],
          message: 'paper_trade_candidate requires non-fallback, non-stale market data',
        });
      }

      if (review.riskDecision.stopLoss === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['riskDecision', 'stopLoss'],
          message: 'paper_trade_candidate requires stopLoss',
        });
      }
    }

    if (
      review.assistantDecision.decision === 'blocked_by_risk' &&
      review.riskDecision.warnings.length === 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['riskDecision', 'warnings'],
        message: 'blocked_by_risk requires at least one warning',
      });
    }
  });

export type AssistantDecisionV1 = z.infer<typeof assistantDecisionV1Schema>;
export type MarketDataQualityV1 = z.infer<typeof marketDataQualityV1Schema>;
export type RiskDecisionV1 = z.infer<typeof riskDecisionV1Schema>;
export type TradeReviewV1 = z.infer<typeof tradeReviewV1Schema>;

export const tradeReviewV1OutputExample = {
  schemaVersion: TRADE_REVIEW_V1_SCHEMA_VERSION,
  referenceId: 'reference-id',
  createdAt: '2026-05-08T00:00:00.000Z',
  assistantDecision: {
    decision: 'no_trade',
    direction: 'none',
    confidence: 0.6,
    rationale: ['No paper trade candidate without fresh, sufficient market context.'],
  },
  marketDataQuality: {
    dataFreshness: 'fresh',
    asOf: '2026-05-08T00:00:00.000Z',
    sources: ['source-id'],
    warnings: [],
  },
  riskDecision: {
    maxRiskPct: 0,
    positionSizing: 'none',
    warnings: [],
  },
} satisfies TradeReviewV1;
