import { describe, expect, it } from 'vitest';

import { tradeReviewInsightSchema } from '../../src/routes/reasoning/schemas';

const validAssistantReview = {
  schemaVersion: 'trade_review_v1',
  referenceId: 'trade-123',
  createdAt: '2026-05-08T10:00:00.000Z',
  assistantDecision: {
    decision: 'paper_trade_candidate',
    direction: 'long',
    confidence: 0.72,
    rationale: ['Setup is acceptable for paper review only.'],
  },
  marketDataQuality: {
    dataFreshness: 'fresh',
    asOf: '2026-05-08T09:59:45.000Z',
    sources: ['oracle.daily', 'chart.ta'],
    warnings: [],
  },
  riskDecision: {
    maxRiskPct: 1,
    stopLoss: 142.5,
    takeProfit: 154,
    positionSizing: 'paper_only',
    warnings: [],
  },
};

const validTradeReviewInsight = {
  type: 'trade-review',
  referenceId: 'trade-123',
  verdict: 'MIXED',
  decision: {
    shouldRepeat: false,
    reason: 'Paper review only until data quality and stop discipline are confirmed.',
  },
  highlights: ['Entry trigger is defined.'],
  risks: [
    {
      label: 'Execution risk',
      severity: 'medium',
      evidence: ['Trade remains paper only.'],
    },
  ],
  fixes: [
    {
      action: 'Confirm invalidation before any paper entry.',
      why: 'The assistant contract requires stop discipline.',
    },
  ],
  questions: ['What invalidates the setup?'],
  critic: {
    issues: [],
    adjustedConfidence: 0.72,
    notes: [],
  },
};

describe('backend tradeReviewInsightSchema assistant review contract', () => {
  it('preserves a valid TradeReviewV1 assistantReview payload', () => {
    const result = tradeReviewInsightSchema.safeParse({
      ...validTradeReviewInsight,
      assistantReview: validAssistantReview,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.assistantReview).toEqual(validAssistantReview);
  });

  it('rejects an invalid TradeReviewV1 assistantReview payload', () => {
    const result = tradeReviewInsightSchema.safeParse({
      ...validTradeReviewInsight,
      assistantReview: {
        ...validAssistantReview,
        schemaVersion: 'trade_review_v2',
      },
    });

    expect(result.success).toBe(false);
  });
});
