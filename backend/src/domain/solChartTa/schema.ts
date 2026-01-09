import { z } from 'zod';

export const solTimeframeSchema = z.enum(['15s', '30s', '1m', '5m', '15m', '30m', '1h', '4h']);
export const analysisTierSchema = z.enum(['free', 'standard', 'pro', 'high']);

export const solAnalysisTaskKindSchema = z.enum([
  // Chart
  'chart_teaser_free',
  'chart_setups',
  'chart_patterns_validate',
  'chart_confluence_onchain',
  'chart_microstructure',
  // Journal (kept for contract completeness)
  'journal_teaser_free',
  'journal_review',
  'journal_playbook_update',
  'journal_risk',
]);

export const setupCardSchema = z.object({
  name: z.string().min(1),
  bias: z.enum(['long', 'short', 'neutral']),
  timeframe: solTimeframeSchema,
  entry: z.object({
    type: z.enum(['market', 'limit', 'trigger']),
    level: z.number().nullable(),
    rule: z.string().min(1),
  }),
  stop: z.object({
    level: z.number(),
    rule: z.string().min(1),
    invalidation: z.string().min(1),
  }),
  targets: z.array(z.object({ level: z.number(), rationale: z.string().min(1) })),
  confidence: z.number().min(0).max(1),
  evidence: z.array(z.string()).default([]),
  onchainGate: z.object({
    pass: z.boolean(),
    notes: z.array(z.string()).default([]),
  }),
  notes: z.array(z.string()).default([]),
});

export const riskBlockSchema = z.object({
  posture: z.enum(['low', 'medium', 'high']),
  keyRisks: z.array(z.string()).default([]),
  guardrails: z.array(z.string()).default([]),
});

export const detailsBlockSchema = z.object({
  regimeExplain: z.string().default(''),
  srTable: z.object({
    supports: z.array(z.number()).default([]),
    resistances: z.array(z.number()).default([]),
  }),
  patternReview: z
    .array(
      z.object({
        type: z.string(),
        tf: solTimeframeSchema,
        verdict: z.enum(['valid', 'weak', 'reject']),
        why: z.string(),
        confidence: z.number().min(0).max(1),
      })
    )
    .default([]),
  onchainExplain: z.string().default(''),
  assumptions: z.array(z.string()).default([]),
  invalidationRules: z.array(z.string()).default([]),
});

export const analysisResultSchema = z.object({
  requestId: z.string().min(1),
  tier: analysisTierSchema,
  taskKind: solAnalysisTaskKindSchema,
  asset: z.object({ mint: z.string().min(1), symbol: z.string().optional() }),
  timeframesAnalyzed: z.array(solTimeframeSchema).default([]),
  headline: z.string().default(''),
  summaryBullets: z.array(z.string()).default([]),
  plan: z.array(setupCardSchema).default([]),
  risk: riskBlockSchema,
  details: detailsBlockSchema,
});

export type SolTimeframe = z.infer<typeof solTimeframeSchema>;
export type AnalysisTier = z.infer<typeof analysisTierSchema>;
export type SolAnalysisTaskKind = z.infer<typeof solAnalysisTaskKindSchema>;
export type SetupCard = z.infer<typeof setupCardSchema>;
export type AnalysisResult = z.infer<typeof analysisResultSchema>;

