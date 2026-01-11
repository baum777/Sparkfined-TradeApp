/**
 * Sparkfined — ContextPack (v1, FROZEN)
 * Backend-local mirror of the shared contract types.
 *
 * Why duplicated?
 * - Backend `tsconfig.json` has `rootDir=./src` and does not allow importing TS files outside.
 * - The canonical contract still lives in `shared/contracts/contextPack.ts` for frontend usage.
 */

export type ResolvedTier = 'free' | 'standard' | 'pro' | 'high';

export type ContextAnchorMode = 'trade_centered' | 'now_centered' | 'launch_centered' | 'latest_only';

export type EvidenceLevel = 'low' | 'medium' | 'high';
export type NoiseLevel = 'low' | 'medium' | 'high';

export type DeltaWindowLabel = '+15m' | '+1h' | '+4h';

export interface ContextPack {
  id: string;
  userId: string;
  asset: { mint: string; symbol?: string; name?: string };
  anchor: {
    mode: ContextAnchorMode;
    anchorTimeISO: string;
  };

  tier: ResolvedTier;
  generatedAtISO: string;
  freshnessSec: number;

  market?: MarketSnapshotAtTime;
  deltas?: DeltaSnapshots;
  narrative?: JournalNarrativeSnapshot;

  reliability: {
    evidenceLevel: EvidenceLevel;
    noiseLevel: NoiseLevel;
    dataCompleteness: 0 | 1 | 2 | 3;
  };
}

export interface MarketSnapshotAtTime {
  asOfISO: string;
  priceUsd?: number;
  marketCapUsd?: number;
  volume24hUsd?: number;
  holdersCount?: number;
  liquidityUsd?: number;

  indicators?: {
    rsi14?: number;
    trendState?: 'overbought' | 'neutral' | 'oversold';
  };

  orderPressure?: {
    buySellImbalance?: number;
    largeTxCount?: number;
    avgTradeSizeDelta?: number;
  };
}

export interface DeltaSnapshots {
  windows: Array<{
    label: DeltaWindowLabel;
    asOfISO: string;
    priceUsd?: number;
    priceDeltaPct?: number;
    volume24hDeltaPct?: number;
    holdersDelta?: number;
    liquidityDeltaPct?: number;
    rsi14?: number;
    marketCapUsd?: number;
  }>;
  note: 'after-trade context only';
}

export interface JournalNarrativeSnapshot {
  cacheKey: string;
  mode: 'trade_centered' | 'launch_centered' | 'latest_only';
  windows: { preHours: 6; postHours: 6 };
  counts: {
    strictPre: number;
    strictPost: number;
    symbolPre: number;
    symbolPost: number;
    latest: number;
  };

  quality: {
    evidenceLevel: EvidenceLevel;
    passedThresholdCount: number;
  };
  flags: { lowEvidence: boolean; highNoise: boolean };

  sources: {
    topAuthors: Array<{ handle: string; usedCount: number; avgScore: number }>;
    usedPresetQuants: string[];
    usedUserQuants: string[];
  };

  headline: string;
  summaryBullets: string[];
  sentiment: { label: 'bullish' | 'bearish' | 'neutral' | 'mixed'; confidence: number };
  themes: string[];
  risks: string[];

  evidencePosts: Array<{
    postId: string;
    authorHandle: string;
    createdAtISO: string;
    score: number;
    bucket: 'strictPre' | 'strictPost' | 'symbolPre' | 'symbolPost' | 'latest';
    shortQuote: string;
  }>;
}

