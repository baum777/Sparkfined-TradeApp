/**
 * Solana onchain feature extraction types (backend-local).
 *
 * GOAL
 * - Provider-agnostic, deterministic, cacheable schema for SPL mints.
 * - Used as a gating/filter layer for TA setups and pattern validation.
 *
 * IMPORTANT
 * - This is backend-only to avoid importing files outside `/backend/src`
 *   (tsconfig rootDir constraint). If frontend/LLM needs the shape, mirror it
 *   in `shared/contracts`.
 * - No "predictions" here—only measured signals and explicit risk flags.
 */
import type { SolTimeframe } from '../solChart/types.js';

/** Time window strings used by the OnchainFeaturePack contract. */
export type OnchainWindowId = '5m' | '1h' | '24h' | '7d';

export interface OnchainWindows {
  /** Short window used for the selected chart timeframe bucket. */
  short: OnchainWindowId;
  /** Baseline window used for the selected chart timeframe bucket. */
  baseline: OnchainWindowId;
}

/**
 * A metric aligned to the (short, baseline) windows.
 * - Values are best-effort and MUST be nullable.
 * - zScore is optional in the sense of being nullable; do not omit the field.
 */
export interface WindowedMetricZ {
  short: number | null;
  baseline: number | null;
  zScore: number | null;
}

/** A metric that only needs short+baseline (no z-score requirement). */
export interface WindowedMetric {
  short: number | null;
  baseline: number | null;
}

export interface OnchainAvailability {
  activity: boolean;
  holders: boolean;
  flows: boolean;
  liquidity: boolean;
  riskFlags: boolean;
}

export interface OnchainActivityFeatures {
  txCount: WindowedMetricZ;
  uniqueWallets: WindowedMetricZ;
  /** Optional best-effort (may not be available from all providers). */
  transferCount?: WindowedMetricZ;
}

export interface OnchainHoldersFeatures {
  holders: { current: number | null };
  holdersDeltaPct: WindowedMetric;
  /** Optional concentration estimates; never assume exactness unless sourced. */
  concentrationTop10Pct?: number | null;
  concentrationTop1Pct?: number | null;
}

export interface OnchainFlowsFeatures {
  /**
   * Best-effort proxy. Must not be presented as "true exchange inflow/outflow"
   * unless the provider explicitly labels it as such.
   */
  netInflowProxy: WindowedMetricZ;
  /** Optional proxy for "large" transfers (provider-defined threshold). */
  largeTransfersProxy?: WindowedMetricZ;
  /** Optional proxy based on tagged/clustered entities. */
  exchangeTaggedFlowProxy?: WindowedMetricZ;
}

export interface OnchainLiquidityFeatures {
  /** Best-effort proxy for liquidity (e.g. DEX pool liquidity), if available. */
  liquidityUsd?: WindowedMetricZ;
  poolCount?: WindowedMetricZ;
  liquidityDeltaPct?: WindowedMetric;
}

export interface RiskFlag {
  value: boolean | null;
  why?: string;
}

export interface OnchainRiskFlags {
  mintAuthorityActive?: RiskFlag;
  freezeAuthorityActive?: RiskFlag;
  suddenSupplyChange?: RiskFlag;
  largeHolderDominance?: RiskFlag;
  washLikeActivitySpike?: RiskFlag;
}

/**
 * EXACT SCHEMA (provider-agnostic).
 *
 * Determinism requirement:
 * - For the same upstream inputs (mint, asOfTs, windows, provider data), the
 *   pack must be identical.
 * - Missing data must be expressed via nulls and availability flags, never by
 *   silently omitting required fields.
 */
export interface OnchainFeaturePack {
  mint: string;
  /** Unix epoch milliseconds. */
  asOfTs: number;
  windows: OnchainWindows;
  availability: OnchainAvailability;
  activity: OnchainActivityFeatures;
  holders: OnchainHoldersFeatures;
  flows: OnchainFlowsFeatures;
  liquidity: OnchainLiquidityFeatures;
  riskFlags: OnchainRiskFlags;
  /** Provider limitations / missing coverage notes. */
  notes?: string[];
}

/**
 * Frozen mapping from chart timeframe to onchain window selection.
 *
 * - micro TF (15s,30s,1m): short=5m baseline=1h
 * - intraday TF (5m,15m,30m): short=1h baseline=24h
 * - swing TF (1h,4h): short=24h baseline=7d
 */
export function getOnchainWindowsForTimeframe(timeframe: SolTimeframe): OnchainWindows {
  switch (timeframe) {
    case '15s':
    case '30s':
    case '1m':
      return { short: '5m', baseline: '1h' };
    case '5m':
    case '15m':
    case '30m':
      return { short: '1h', baseline: '24h' };
    case '1h':
    case '4h':
      return { short: '24h', baseline: '7d' };
    default: {
      // Exhaustive check (kept runtime-safe)
      const _exhaustive: never = timeframe;
      return _exhaustive;
    }
  }
}

/** Utility: construct a fully-null metric (required fields present). */
export function nullMetricZ(): WindowedMetricZ {
  return { short: null, baseline: null, zScore: null };
}

export function nullMetric(): WindowedMetric {
  return { short: null, baseline: null };
}

/**
 * Utility: returns a pack where all values are null and availability is false.
 * Useful as a deterministic fallback when a provider cannot serve the request.
 */
export function emptyOnchainFeaturePack(input: { mint: string; asOfTs: number; windows: OnchainWindows; notes?: string[] }): OnchainFeaturePack {
  return {
    mint: input.mint,
    asOfTs: input.asOfTs,
    windows: input.windows,
    availability: { activity: false, holders: false, flows: false, liquidity: false, riskFlags: false },
    activity: { txCount: nullMetricZ(), uniqueWallets: nullMetricZ() },
    holders: { holders: { current: null }, holdersDeltaPct: nullMetric() },
    flows: { netInflowProxy: nullMetricZ() },
    liquidity: {},
    riskFlags: {},
    notes: input.notes,
  };
}

