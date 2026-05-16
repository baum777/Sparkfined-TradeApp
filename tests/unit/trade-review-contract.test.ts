import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  tradeReviewV1OutputExample,
  tradeReviewV1Schema,
} from '../../shared/contracts/trading-assistant/trade-review';

function readRepoFile(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8').replace(/\r\n/g, '\n');
}

const validTradeReview = {
  schemaVersion: 'trade_review_v1',
  referenceId: 'trade-123',
  createdAt: '2026-05-08T10:00:00.000Z',
  assistantDecision: {
    decision: 'paper_trade_candidate',
    direction: 'long',
    confidence: 0.72,
    rationale: ['Trend and risk-reward are acceptable for paper review.'],
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

describe('tradeReviewV1Schema', () => {
  it('accepts the canonical output example', () => {
    expect(tradeReviewV1Schema.safeParse(tradeReviewV1OutputExample).success).toBe(true);
  });

  it('requires no_trade decisions to use direction none', () => {
    const result = tradeReviewV1Schema.safeParse({
      ...validTradeReview,
      assistantDecision: {
        ...validTradeReview.assistantDecision,
        decision: 'no_trade',
        direction: 'long',
      },
    });

    expect(result.success).toBe(false);
  });

  it('rejects trade candidates using fallback market data', () => {
    const result = tradeReviewV1Schema.safeParse({
      ...validTradeReview,
      marketDataQuality: {
        ...validTradeReview.marketDataQuality,
        dataFreshness: 'fallback',
      },
    });

    expect(result.success).toBe(false);
  });

  it('rejects trade candidates using stale market data', () => {
    const result = tradeReviewV1Schema.safeParse({
      ...validTradeReview,
      marketDataQuality: {
        ...validTradeReview.marketDataQuality,
        dataFreshness: 'stale',
      },
    });

    expect(result.success).toBe(false);
  });

  it('requires stopLoss for paper_trade_candidate decisions', () => {
    const { stopLoss: _stopLoss, ...riskDecisionWithoutStop } = validTradeReview.riskDecision;

    const result = tradeReviewV1Schema.safeParse({
      ...validTradeReview,
      riskDecision: riskDecisionWithoutStop,
    });

    expect(result.success).toBe(false);
  });

  it('requires blocked_by_risk decisions to include at least one warning', () => {
    const result = tradeReviewV1Schema.safeParse({
      ...validTradeReview,
      assistantDecision: {
        ...validTradeReview.assistantDecision,
        decision: 'blocked_by_risk',
      },
      riskDecision: {
        ...validTradeReview.riskDecision,
        warnings: [],
      },
    });

    expect(result.success).toBe(false);
  });

  it('requires the fixed trade_review_v1 schemaVersion', () => {
    const result = tradeReviewV1Schema.safeParse({
      ...validTradeReview,
      schemaVersion: 'trade_review_v2',
    });

    expect(result.success).toBe(false);
  });

  it('keeps assistant decisions limited to the current stabilization slice', () => {
    for (const decision of ['watchlist', 'manual_review_required']) {
      const result = tradeReviewV1Schema.safeParse({
        ...validTradeReview,
        assistantDecision: {
          ...validTradeReview.assistantDecision,
          decision,
        },
      });

      expect(result.success).toBe(false);
    }
  });

  it('keeps market data freshness terms limited to the current stabilization slice', () => {
    for (const dataFreshness of ['live', 'cached']) {
      const result = tradeReviewV1Schema.safeParse({
        ...validTradeReview,
        marketDataQuality: {
          ...validTradeReview.marketDataQuality,
          dataFreshness,
        },
      });

      expect(result.success).toBe(false);
    }
  });

  it('keeps the backend contract mirror byte-for-byte aligned with the shared contract', () => {
    expect(readRepoFile('backend/src/routes/reasoning/tradeReviewContract.ts')).toBe(
      readRepoFile('shared/contracts/trading-assistant/trade-review.ts')
    );
  });
});
