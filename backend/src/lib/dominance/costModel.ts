import type { SparkfinedCostMetrics } from './contracts.js';

export interface SparkfinedModelPricing {
  inputPer1kUsd: number;
  outputPer1kUsd: number;
}

/**
 * Deterministic pricing table (dominance_v1).
 *
 * By default this table is intentionally empty to avoid hard-coding provider prices
 * that may drift. Provide overrides via `SPARKFINED_PRICING_TABLE_JSON`.
 *
 * Format example:
 * {
 *   "gpt-4o-mini": { "inputPer1kUsd": 0.00015, "outputPer1kUsd": 0.00060 }
 * }
 */
export type SparkfinedPricingTable = Record<string, SparkfinedModelPricing>;

function isFiniteNumber(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}

function safeParsePricingTable(json: string): SparkfinedPricingTable | null {
  try {
    const raw = JSON.parse(json) as unknown;
    if (!raw || typeof raw !== 'object') return null;
    const out: SparkfinedPricingTable = {};
    for (const [model, v] of Object.entries(raw as Record<string, unknown>)) {
      if (!v || typeof v !== 'object') continue;
      const inp = (v as any).inputPer1kUsd;
      const outp = (v as any).outputPer1kUsd;
      if (!isFiniteNumber(inp) || !isFiniteNumber(outp)) continue;
      out[model] = { inputPer1kUsd: inp, outputPer1kUsd: outp };
    }
    return out;
  } catch {
    return null;
  }
}

export function getSparkfinedPricingTable(env: Record<string, string | undefined>): SparkfinedPricingTable {
  const base: SparkfinedPricingTable = {};
  const overrideJson = env.SPARKFINED_PRICING_TABLE_JSON;
  if (!overrideJson) return base;
  const parsed = safeParsePricingTable(overrideJson);
  return parsed ?? base;
}

export function estimateCostUsd(input: {
  tokensIn?: number;
  tokensOut?: number;
  modelUsed?: string;
  pricing: SparkfinedPricingTable;
}): number | undefined {
  const model = input.modelUsed;
  if (!model) return undefined;
  const price = input.pricing[model];
  if (!price) return undefined;

  const tin = typeof input.tokensIn === 'number' && Number.isFinite(input.tokensIn) ? input.tokensIn : undefined;
  const tout = typeof input.tokensOut === 'number' && Number.isFinite(input.tokensOut) ? input.tokensOut : undefined;
  if (typeof tin !== 'number' && typeof tout !== 'number') return undefined;

  const inUsd = typeof tin === 'number' ? (tin / 1000) * price.inputPer1kUsd : 0;
  const outUsd = typeof tout === 'number' ? (tout / 1000) * price.outputPer1kUsd : 0;
  const total = inUsd + outUsd;
  if (!Number.isFinite(total)) return undefined;
  return total;
}

function safeParseUsd(v: string | undefined): number | undefined {
  if (!v) return undefined;
  const n = Number(v);
  if (!Number.isFinite(n)) return undefined;
  return n;
}

/**
 * Best-effort, deterministic cost regression calculation.
 *
 * - Baseline provided via `SPARKFINED_COST_BASELINE_USD`.
 * - Warn threshold via `SPARKFINED_COST_WARN_PCT` (default: 0.2)
 * - Block threshold via `SPARKFINED_COST_BLOCK_PCT` (default: 0.5)
 */
export function computeCostRegression(input: {
  costEstimateUsd?: number;
  env: Record<string, string | undefined>;
}): SparkfinedCostMetrics['costRegression'] | undefined {
  const est = input.costEstimateUsd;
  if (typeof est !== 'number' || !Number.isFinite(est)) return undefined;

  const baseline = safeParseUsd(input.env.SPARKFINED_COST_BASELINE_USD);
  if (typeof baseline !== 'number' || !Number.isFinite(baseline) || baseline <= 0) {
    return { baselineUsd: baseline, deltaUsd: undefined, deltaPct: undefined, status: 'ok' };
  }

  const deltaUsd = est - baseline;
  const deltaPct = deltaUsd / baseline;

  const warnPct = safeParseUsd(input.env.SPARKFINED_COST_WARN_PCT) ?? 0.2;
  const blockPct = safeParseUsd(input.env.SPARKFINED_COST_BLOCK_PCT) ?? 0.5;

  const status: 'ok' | 'warn' | 'block' =
    deltaPct >= blockPct ? 'block' : deltaPct >= warnPct ? 'warn' : 'ok';

  return { baselineUsd: baseline, deltaUsd, deltaPct, status };
}

