import type {
  OnchainActivityFeatures,
  OnchainFlowsFeatures,
  OnchainHoldersFeatures,
  OnchainLiquidityFeatures,
  OnchainRiskFlags,
  OnchainWindows,
} from './types.js';

export type OnchainCapability = 'activity' | 'holders' | 'flows' | 'liquidity' | 'riskFlags';

export interface ProviderCapabilities {
  activity: boolean;
  holders: boolean;
  flows: boolean;
  liquidity: boolean;
  riskFlags: boolean;
}

export type BlockResult<TBlock> = {
  /** Whether the provider could populate this block for the request. */
  available: boolean;
  /** Block data with strict nullability. */
  data: TBlock;
  /** Optional provider notes/limitations (best-effort, deterministic). */
  notes?: string[];
};

export type ActivityBlockResult = BlockResult<OnchainActivityFeatures>;
export type HoldersBlockResult = BlockResult<OnchainHoldersFeatures>;
export type FlowsBlockResult = BlockResult<OnchainFlowsFeatures>;
export type LiquidityBlockResult = BlockResult<OnchainLiquidityFeatures>;
export type RiskFlagsBlockResult = BlockResult<OnchainRiskFlags>;

/**
 * Provider-agnostic interface for Solana SPL mint onchain metrics.
 *
 * Non-negotiables:
 * - Deterministic: same upstream data + same inputs => same outputs.
 * - Nullability: unknown => null (never invent numbers).
 * - Best-effort allowed but MUST be explicit via `available` and `notes`.
 */
export interface SolanaOnchainProvider {
  /** Provider tag, e.g. "helius", "mock". */
  tag: string;
  /** Semantic version for mapping/semantics changes. */
  version: string;

  /** Capability surface of this provider. */
  capabilities(): ProviderCapabilities;

  /**
   * Deterministic string used in cache keys.
   * MUST change if mapping/semantics/capabilities change.
   */
  fingerprint(): string;

  /** Windowed activity metrics aligned to `windows` and `asOfTs`. */
  getActivity(input: { mint: string; windows: OnchainWindows; asOfTs: number }): Promise<ActivityBlockResult>;

  /** Holder snapshot + deltas (provider-defined holder model). */
  getHolders(input: { mint: string; windows: OnchainWindows; asOfTs: number }): Promise<HoldersBlockResult>;

  /** Best-effort flow proxies; never claim exact exchange flows unless labeled. */
  getFlows(input: { mint: string; windows: OnchainWindows; asOfTs: number }): Promise<FlowsBlockResult>;

  /** Best-effort liquidity metrics (e.g. DEX liquidity). */
  getLiquidity(input: { mint: string; windows: OnchainWindows; asOfTs: number }): Promise<LiquidityBlockResult>;

  /** Risk flags derived from token metadata / supply changes / behavior heuristics. */
  getRiskFlags(input: { mint: string; asOfTs: number }): Promise<RiskFlagsBlockResult>;
}

/**
 * Helper: deterministic fingerprint builder for cache keys.
 *
 * Note: This returns a human-readable fingerprint; callers may hash it if needed.
 */
export function computeProviderFingerprint(input: { tag: string; version: string; capabilities: ProviderCapabilities }): string {
  const caps = input.capabilities;
  // Keep ordering frozen.
  const capsStr = `a=${caps.activity ? 1 : 0},h=${caps.holders ? 1 : 0},f=${caps.flows ? 1 : 0},l=${caps.liquidity ? 1 : 0},r=${
    caps.riskFlags ? 1 : 0
  }`;
  return `${input.tag}@${input.version}:${capsStr}`;
}

