/**
 * Sparkfined — ContextPack (v1, FROZEN)
 * -----------------------------------
 * Contract-first shared types.
 *
 * Notes:
 * - Backend is canonical source of truth for tier gating & field visibility.
 * - Narrative is snapshot-only context; never treated as truth.
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

  market?: MarketSnapshotAtTime; // gated
  deltas?: DeltaSnapshots; // gated
  narrative?: JournalNarrativeSnapshot; // gated & opt-in

  reliability: {
    evidenceLevel: EvidenceLevel; // derived from narrative + market
    noiseLevel: NoiseLevel; // derived from narrative
    dataCompleteness: 0 | 1 | 2 | 3; // 0=none, 1=market, 2=market+deltas, 3=market+deltas+narrative
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
    buySellImbalance?: number; // -1..+1
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
  summaryBullets: string[]; // 5–9
  sentiment: { label: 'bullish' | 'bearish' | 'neutral' | 'mixed'; confidence: number }; // 0..1
  themes: string[]; // top 2–4
  risks: string[]; // 0–5

  evidencePosts: Array<{
    postId: string;
    authorHandle: string;
    createdAtISO: string;
    score: number;
    bucket: 'strictPre' | 'strictPost' | 'symbolPre' | 'symbolPost' | 'latest';
    shortQuote: string; // paraphrase <= 20 words (preferred)
  }>;
}

