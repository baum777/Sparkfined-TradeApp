import type { SolTimeframe } from '../solChart/types.js';
import type { SolanaOnchainProvider } from './provider.js';
import type {
  OnchainActivityFeatures,
  OnchainFeaturePack,
  OnchainFlowsFeatures,
  OnchainHoldersFeatures,
  OnchainLiquidityFeatures,
  OnchainRiskFlags,
  OnchainWindows,
} from './types.js';
import { emptyOnchainFeaturePack, getOnchainWindowsForTimeframe, nullMetric, nullMetricZ } from './types.js';
import { stableSha256Hex, stableStringify } from './hash.js';

export const ONCHAIN_FEATURE_PACK_SCHEMA_VERSION = 'v1';

export function getBucketMsForTimeframe(timeframe: SolTimeframe): number {
  switch (timeframe) {
    case '15s':
    case '30s':
    case '1m':
      return 30_000; // 30s bucket for micro
    case '5m':
    case '15m':
    case '30m':
      return 300_000; // 5m bucket for intraday
    case '1h':
    case '4h':
      return 3_600_000; // 1h bucket for swing
    default: {
      const _exhaustive: never = timeframe;
      return _exhaustive;
    }
  }
}

/** Deterministically buckets asOfTs to timeframe bucket boundaries. */
export function bucketAsOfTs(timeframe: SolTimeframe, asOfTs: number): number {
  const bucketMs = getBucketMsForTimeframe(timeframe);
  return Math.floor(asOfTs / bucketMs) * bucketMs;
}

function normalizeNotes(notes: Array<string | undefined> | undefined): string[] | undefined {
  const flat = (notes ?? []).flatMap(n => (n ? [n] : []));
  if (flat.length === 0) return undefined;
  // Stable: sort + dedupe
  const uniq = Array.from(new Set(flat));
  uniq.sort();
  return uniq;
}

function nullActivity(): OnchainActivityFeatures {
  return { txCount: nullMetricZ(), uniqueWallets: nullMetricZ() };
}

function nullHolders(windows: OnchainWindows): OnchainHoldersFeatures {
  // windows is unused today, but kept for symmetry / future sanity checks.
  void windows;
  return { holders: { current: null }, holdersDeltaPct: nullMetric() };
}

function nullFlows(): OnchainFlowsFeatures {
  return { netInflowProxy: nullMetricZ() };
}

function nullLiquidity(): OnchainLiquidityFeatures {
  return {};
}

function nullRiskFlags(): OnchainRiskFlags {
  return {};
}

export type BuildOnchainFeaturePackParams = {
  mint: string;
  timeframe: SolTimeframe;
  /** If omitted, uses current time (then bucketed). */
  asOfTs?: number;
  provider: SolanaOnchainProvider;
  /** Tier (controls cost + which blocks are allowed). */
  tier: 'free' | 'standard' | 'pro' | 'high';
  /** Whether downstream pipeline has chart setups (cost control). */
  hasSetups: boolean;
};

export type BuildOnchainFeaturePackMeta = {
  pack: OnchainFeaturePack;
  cacheKey: string;
  featurePackHash: string;
  asOfBucket: number;
};

export async function buildOnchainFeaturePack(params: BuildOnchainFeaturePackParams): Promise<OnchainFeaturePack> {
  const meta = await buildOnchainFeaturePackWithCacheMeta(params);
  return meta.pack;
}

export async function buildOnchainFeaturePackWithCacheMeta(params: BuildOnchainFeaturePackParams): Promise<BuildOnchainFeaturePackMeta> {
  const windows = getOnchainWindowsForTimeframe(params.timeframe);
  const asOfBucket = bucketAsOfTs(params.timeframe, params.asOfTs ?? Date.now());

  const baseCaps = params.provider.capabilities();

  // Tier/cost guardrails:
  // - FREE: no-op gating -> only allow riskFlags (info only).
  // - STANDARD: allow low-cost blocks; disallow enhanced flows/liquidity.
  // - PRO/HIGH: allow enhanced flows/liquidity ONLY when hasSetups=true.
  const allowEnhanced = (params.tier === 'pro' || params.tier === 'high') && params.hasSetups;

  const caps = {
    activity: params.tier === 'free' ? false : baseCaps.activity,
    holders: params.tier === 'free' ? false : baseCaps.holders,
    flows: allowEnhanced ? baseCaps.flows : false,
    liquidity: allowEnhanced ? baseCaps.liquidity : false,
    riskFlags: baseCaps.riskFlags,
  };

  // If provider is entirely non-functional, return a deterministic empty pack
  // (still includes provider fingerprint in cacheKey so caches don't collide).
  if (!caps.activity && !caps.holders && !caps.flows && !caps.liquidity && !caps.riskFlags) {
    const pack = emptyOnchainFeaturePack({
      mint: params.mint,
      asOfTs: asOfBucket,
      windows,
      notes: [`provider:${params.provider.tag}@${params.provider.version}:no_capabilities`],
    });
    const normalizedPackForHash = { ...pack, notes: normalizeNotes(pack.notes) } as any;
    const featurePackHash = stableSha256Hex(normalizedPackForHash);
    const cacheKey = buildCacheKey({
      mint: params.mint,
      timeframe: params.timeframe,
      windows,
      asOfBucket,
      providerFingerprint: params.provider.fingerprint(),
      tier: params.tier,
      hasSetups: params.hasSetups,
      schemaVersion: ONCHAIN_FEATURE_PACK_SCHEMA_VERSION,
    });
    return { pack: { ...pack, notes: normalizeNotes(pack.notes) }, cacheKey, featurePackHash, asOfBucket };
  }

  const providerInputWindowed = { mint: params.mint, windows, asOfTs: asOfBucket };
  const providerInputUnwindowed = { mint: params.mint, asOfTs: asOfBucket };

  // Call only supported capabilities. Keep ordering stable and notes deterministic.
  const [activityRes, holdersRes, flowsRes, liquidityRes, riskRes] = await Promise.all([
    caps.activity ? params.provider.getActivity(providerInputWindowed) : Promise.resolve(null),
    caps.holders ? params.provider.getHolders(providerInputWindowed) : Promise.resolve(null),
    caps.flows ? params.provider.getFlows(providerInputWindowed) : Promise.resolve(null),
    caps.liquidity ? params.provider.getLiquidity(providerInputWindowed) : Promise.resolve(null),
    caps.riskFlags ? params.provider.getRiskFlags(providerInputUnwindowed) : Promise.resolve(null),
  ]);

  const availability = {
    activity: Boolean(activityRes?.available),
    holders: Boolean(holdersRes?.available),
    flows: Boolean(flowsRes?.available),
    liquidity: Boolean(liquidityRes?.available),
    riskFlags: Boolean(riskRes?.available),
  };

  const activity: OnchainActivityFeatures = availability.activity ? ensureActivityShape(activityRes!.data) : nullActivity();
  const holders: OnchainHoldersFeatures = availability.holders ? ensureHoldersShape(holdersRes!.data, windows) : nullHolders(windows);
  const flows: OnchainFlowsFeatures = availability.flows ? ensureFlowsShape(flowsRes!.data) : nullFlows();
  const liquidity: OnchainLiquidityFeatures = availability.liquidity ? ensureLiquidityShape(liquidityRes!.data) : nullLiquidity();
  const riskFlags: OnchainRiskFlags = availability.riskFlags ? ensureRiskFlagsShape(riskRes!.data) : nullRiskFlags();

  const notes = normalizeNotes([
    ...(activityRes?.notes ?? []),
    ...(holdersRes?.notes ?? []),
    ...(flowsRes?.notes ?? []),
    ...(liquidityRes?.notes ?? []),
    ...(riskRes?.notes ?? []),
  ]);

  const pack: OnchainFeaturePack = {
    mint: params.mint,
    asOfTs: asOfBucket,
    windows,
    availability,
    activity,
    holders,
    flows,
    liquidity,
    riskFlags,
    notes,
  };

  // Hash must be deterministic; normalize notes ordering (already sorted/deduped above).
  const featurePackHash = stableSha256Hex(pack as any);

  const cacheKey = buildCacheKey({
    mint: params.mint,
    timeframe: params.timeframe,
    windows,
    asOfBucket,
    providerFingerprint: params.provider.fingerprint(),
    tier: params.tier,
    hasSetups: params.hasSetups,
    schemaVersion: ONCHAIN_FEATURE_PACK_SCHEMA_VERSION,
  });

  return { pack, cacheKey, featurePackHash, asOfBucket };
}

function buildCacheKey(input: {
  mint: string;
  timeframe: SolTimeframe;
  windows: OnchainWindows;
  asOfBucket: number;
  providerFingerprint: string;
  tier: BuildOnchainFeaturePackParams['tier'];
  hasSetups: boolean;
  schemaVersion: string;
}): string {
  // Include tier + hasSetups because they deterministically change which blocks are allowed.
  return `onchainfp:${input.mint}:${input.timeframe}:${input.windows.short}:${input.windows.baseline}:${input.asOfBucket}:tier=${input.tier}:hasSetups=${
    input.hasSetups ? 1 : 0
  }:${input.providerFingerprint}:${input.schemaVersion}`;
}

// ---- Minimal shape guards / normalizers (no invented numbers) ----

function ensureMetricZ(m: any) {
  return {
    short: typeof m?.short === 'number' ? m.short : m?.short === null ? null : null,
    baseline: typeof m?.baseline === 'number' ? m.baseline : m?.baseline === null ? null : null,
    zScore: typeof m?.zScore === 'number' ? m.zScore : m?.zScore === null ? null : null,
  };
}

function ensureMetric(m: any) {
  return {
    short: typeof m?.short === 'number' ? m.short : m?.short === null ? null : null,
    baseline: typeof m?.baseline === 'number' ? m.baseline : m?.baseline === null ? null : null,
  };
}

function ensureActivityShape(data: OnchainActivityFeatures): OnchainActivityFeatures {
  return {
    txCount: ensureMetricZ((data as any).txCount),
    uniqueWallets: ensureMetricZ((data as any).uniqueWallets),
    transferCount: (data as any).transferCount === undefined ? undefined : ensureMetricZ((data as any).transferCount),
  };
}

function ensureHoldersShape(data: OnchainHoldersFeatures, windows: OnchainWindows): OnchainHoldersFeatures {
  void windows;
  return {
    holders: { current: typeof (data as any).holders?.current === 'number' ? (data as any).holders.current : (data as any).holders?.current ?? null },
    holdersDeltaPct: ensureMetric((data as any).holdersDeltaPct),
    concentrationTop10Pct:
      (data as any).concentrationTop10Pct === undefined
        ? undefined
        : typeof (data as any).concentrationTop10Pct === 'number'
          ? (data as any).concentrationTop10Pct
          : (data as any).concentrationTop10Pct ?? null,
    concentrationTop1Pct:
      (data as any).concentrationTop1Pct === undefined
        ? undefined
        : typeof (data as any).concentrationTop1Pct === 'number'
          ? (data as any).concentrationTop1Pct
          : (data as any).concentrationTop1Pct ?? null,
  };
}

function ensureFlowsShape(data: OnchainFlowsFeatures): OnchainFlowsFeatures {
  return {
    netInflowProxy: ensureMetricZ((data as any).netInflowProxy),
    largeTransfersProxy: (data as any).largeTransfersProxy === undefined ? undefined : ensureMetricZ((data as any).largeTransfersProxy),
    exchangeTaggedFlowProxy: (data as any).exchangeTaggedFlowProxy === undefined ? undefined : ensureMetricZ((data as any).exchangeTaggedFlowProxy),
  };
}

function ensureLiquidityShape(data: OnchainLiquidityFeatures): OnchainLiquidityFeatures {
  const out: OnchainLiquidityFeatures = {};
  if ((data as any).liquidityUsd !== undefined) out.liquidityUsd = ensureMetricZ((data as any).liquidityUsd);
  if ((data as any).poolCount !== undefined) out.poolCount = ensureMetricZ((data as any).poolCount);
  if ((data as any).liquidityDeltaPct !== undefined) out.liquidityDeltaPct = ensureMetric((data as any).liquidityDeltaPct);
  return out;
}

function ensureRiskFlagsShape(data: OnchainRiskFlags): OnchainRiskFlags {
  // Risk flags are already nullable booleans + optional why; don't coerce beyond null/boolean.
  // Keep shape as-is but drop non-object values.
  return stableParseRiskFlags(data);
}

function stableParseRiskFlags(data: any): OnchainRiskFlags {
  const mk = (x: any) =>
    x === undefined
      ? undefined
      : {
          value: typeof x?.value === 'boolean' ? x.value : x?.value === null ? null : null,
          why: typeof x?.why === 'string' ? x.why : x?.why === undefined ? undefined : String(x.why),
        };

  return {
    mintAuthorityActive: mk(data?.mintAuthorityActive),
    freezeAuthorityActive: mk(data?.freezeAuthorityActive),
    suddenSupplyChange: mk(data?.suddenSupplyChange),
    largeHolderDominance: mk(data?.largeHolderDominance),
    washLikeActivitySpike: mk(data?.washLikeActivitySpike),
  };
}

// Exposed for debugging/repro: canonical JSON (keys sorted). Arrays preserved.
export function stableOnchainPackStringify(pack: OnchainFeaturePack): string {
  return stableStringify(pack as any);
}

