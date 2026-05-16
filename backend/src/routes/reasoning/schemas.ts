import { z } from 'zod';
import { tradeReviewV1Schema } from './tradeReviewContract.js';

export const criticIssueSchema = z.object({
  kind: z.enum(['contradiction', 'missing_data', 'overreach']),
  message: z.string().min(1),
  fields: z.array(z.string().min(1)).optional(),
});

export const insightCriticReportSchema = z.object({
  issues: z.array(criticIssueSchema),
  adjustedConfidence: z.number().min(0).max(1),
  notes: z.array(z.string()),
});

export const tradeReviewInsightSchema = z.object({
  type: z.literal('trade-review'),
  referenceId: z.string().min(1),
  verdict: z.enum(['GOOD_PROCESS', 'MIXED', 'BAD_PROCESS']),
  decision: z.object({
    shouldRepeat: z.boolean(),
    reason: z.string().min(1),
  }),
  highlights: z.array(z.string()),
  risks: z.array(
    z.object({
      label: z.string().min(1),
      severity: z.enum(['low', 'medium', 'high']),
      evidence: z.array(z.string()),
    })
  ),
  fixes: z.array(
    z.object({
      action: z.string().min(1),
      why: z.string().min(1),
    })
  ),
  questions: z.array(z.string()),
  assistantReview: tradeReviewV1Schema.optional(),
  critic: insightCriticReportSchema,
});

export const sessionReviewInsightSchema = z.object({
  type: z.literal('session-review'),
  referenceId: z.string().min(1),
  summary: z.string().min(1),
  decisions: z.array(z.object({ decision: z.string().min(1), rationale: z.string().min(1) })),
  patterns: z.array(z.object({ pattern: z.string().min(1), evidence: z.array(z.string()) })),
  nextSessionPlan: z.array(z.object({ action: z.string().min(1), trigger: z.string().min(1) })),
  critic: insightCriticReportSchema,
});

export const boardScenarioSchema = z.object({
  name: z.string().min(1),
  probability: z.number().min(0).max(1),
  triggers: z.array(z.string()),
  plan: z.object({
    actions: z.array(z.string()),
    invalidation: z.string().min(1),
    riskRule: z.string().min(1),
  }),
});

export const boardScenariosInsightSchema = z.object({
  type: z.literal('board-scenarios'),
  referenceId: z.string().min(1),
  scenarios: z.array(boardScenarioSchema).min(1),
  critic: insightCriticReportSchema,
});

export const insightCriticOnlyResultSchema = z.object({
  type: z.literal('insight-critic'),
  referenceId: z.string().min(1),
  report: insightCriticReportSchema,
});

export const planningStepSchema = z.object({
  id: z.string().min(1),
  action: z.string().min(1),
  owner_tier: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  estimated_effort: z.enum(['xs', 's', 'm', 'l', 'xl']).optional(),
  validation_gate: z.string().min(1),
  canonical_check: z.boolean().optional(),
});

export const planningRiskSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  severity: z.enum(['p0_blocking', 'p1_review', 'p2_optional']),
  mitigation: z.string().min(1).optional(),
});

export const planningResultSchema = z.object({
  plan_steps: z.array(planningStepSchema),
  risks: z.array(planningRiskSchema).optional(),
  gates: z.array(z.string()).optional(),
  next_action: z.string().min(1),
  requires_human_review: z.boolean().optional(),
  confidence: z.number().min(0).max(1),
});
