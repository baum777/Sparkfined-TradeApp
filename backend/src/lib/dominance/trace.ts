import { randomUUID } from 'crypto';
import { logger } from '../../observability/logger.js';
import type { SparkfinedContext, SparkfinedTraceEvent, SparkfinedTraceIds, SparkfinedCostMetrics } from './contracts.js';
import { computeCostRegression, estimateCostUsd, getSparkfinedPricingTable } from './costModel.js';

function asTraceAttrs(
  attrs: Record<string, unknown> | undefined
): Record<string, string | number | boolean | null> | undefined {
  if (!attrs) return undefined;
  const out: Record<string, string | number | boolean | null> = {};
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null) out[k] = null;
    else if (typeof v === 'string') out[k] = v;
    else if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
    else if (typeof v === 'boolean') out[k] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

export function newTraceIds(input?: Partial<SparkfinedTraceIds>): SparkfinedTraceIds {
  return {
    runId: input?.runId ?? randomUUID(),
    workstreamId: input?.workstreamId,
    spanId: input?.spanId ?? randomUUID(),
    parentSpanId: input?.parentSpanId,
  };
}

export function emitSparkfinedTraceEvent(_ctx: SparkfinedContext, event: SparkfinedTraceEvent): void {
  // Passive logging only; no hidden reasoning, no prompts, no secrets.
  logger.debug('sparkfined.trace', event as unknown as Record<string, unknown>);
}

export function enrichCostMetrics(ctx: SparkfinedContext, cost: SparkfinedCostMetrics): SparkfinedCostMetrics {
  const pricing = getSparkfinedPricingTable(ctx.runtime.env);
  const costEstimateUsd =
    typeof cost.costEstimateUsd === 'number'
      ? cost.costEstimateUsd
      : estimateCostUsd({
          tokensIn: cost.tokensIn,
          tokensOut: cost.tokensOut,
          modelUsed: cost.modelUsed,
          pricing,
        });

  const costRegression = computeCostRegression({ costEstimateUsd, env: ctx.runtime.env });

  return {
    ...cost,
    costEstimateUsd,
    costRegression,
  };
}

export function traceSpan(
  ctx: SparkfinedContext,
  input: {
    step: string;
    workstreamId?: string;
    component?: SparkfinedContext['trace']['component'];
    tags?: Record<string, string>;
    cost?: Partial<SparkfinedCostMetrics>;
    attrs?: Record<string, unknown>;
  }
): SparkfinedContext {
  const prevIds = ctx.trace.ids;
  const ids: SparkfinedTraceIds = {
    runId: prevIds.runId,
    workstreamId: input.workstreamId ?? prevIds.workstreamId,
    spanId: randomUUID(),
    parentSpanId: prevIds.spanId,
  };

  const mergedCost: SparkfinedCostMetrics = enrichCostMetrics(ctx, {
    ...ctx.trace.cost,
    ...(input.cost ?? {}),
  });

  const next: SparkfinedContext = {
    ...ctx,
    trace: {
      ids,
      component: input.component ?? ctx.trace.component,
      tags: input.tags ?? ctx.trace.tags,
      cost: mergedCost,
    },
  };

  const event: SparkfinedTraceEvent = {
    atISO: new Date().toISOString(),
    ids: next.trace.ids,
    component: next.trace.component,
    step: input.step,
    riskLevel: next.risk.level,
    autonomyTier: next.autonomy.tier,
    metrics: next.trace.cost,
    attrs: asTraceAttrs(input.attrs),
  };
  emitSparkfinedTraceEvent(next, event);
  return next;
}

