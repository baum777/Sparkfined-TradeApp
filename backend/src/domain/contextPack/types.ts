/**
 * ContextPack Types (FROZEN SPEC)
 * Sparkfined — Pulse & Oracle Context Extension
 * Date: 2026-01-11
 * Status: FROZEN (contract-first, backend-canonical)
 */

export type ResolvedTier = 'free' | 'standard' | 'pro' | 'high';

export type AnchorMode = 'trade_centered' | 'now_centered' | 'launch_centered' | 'latest_only';

export type EvidenceLevel = 'low' | 'medium' | 'high';
export type NoiseLevel = 'low' | 'medium' | 'high';
export type TrendState = 'overbought' | 'neutral' | 'oversold';
export type SentimentLabel = 'bullish' | 'bearish' | 'neutral' | 'mixed';
export type DeltaWindowLabel = '+15m' | '+1h' | '+4h';
export type NarrativeBucket = 'strictPre' | 'strictPost' | 'symbolPre' | 'symbolPost' | 'latest';

/**
 * MarketSnapshotAtTime
 * Objective market state at a specific time
 */
export interface MarketSnapshotAtTime {
  asOfISO: string;
  priceUsd?: number;
  marketCapUsd?: number;
  volume24hUsd?: number;
  holdersCount?: number;
  liquidityUsd?: number;
  
  indicators?: {
    rsi14?: number;
    trendState?: TrendState;
  };
  
  orderPressure?: {
    buySellImbalance?: number; // -1..+1
    largeTxCount?: number;
    avgTradeSizeDelta?: number;
  };
}

/**
 * DeltaSnapshots
 * After-trade changes in fixed windows
 */
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

/**
 * JournalNarrativeSnapshot
 * X/TL context (Pro/High opt-in), noise-resilient, evidence-labeled
 */
export interface JournalNarrativeSnapshot {
  cacheKey: string;
  mode: 'trade_centered' | 'launch_centered' | 'latest_only';
  windows: { preHours: number; postHours: number };
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
  flags: {
    lowEvidence: boolean;
    highNoise: boolean;
  };
  
  sources: {
    topAuthors: Array<{
      handle: string;
      usedCount: number;
      avgScore: number;
    }>;
    usedPresetQuants: string[];
    usedUserQuants: string[];
  };
  
  headline: string;
  summaryBullets: string[]; // 5–9
  sentiment: {
    label: SentimentLabel;
    confidence: number; // 0..1
  };
  themes: string[]; // top 2–4
  risks: string[]; // 0–5
  
  evidencePosts: Array<{
    postId: string;
    authorHandle: string;
    createdAtISO: string;
    score: number;
    bucket: NarrativeBucket;
    shortQuote: string; // paraphrase <= 20 words (preferred)
  }>;
}

/**
 * ContextPack (Canonical Schema)
 */
export interface ContextPack {
  id: string;
  userId: string;
  asset: {
    mint: string;
    symbol?: string;
    name?: string;
  };
  anchor: {
    mode: AnchorMode;
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

/**
 * Pulse Overlay Types
 */
export type PulseOverlayCode =
  | 'FOMO_RISK'
  | 'FALLING_KNIFE_RISK'
  | 'LOW_EVIDENCE_NARRATIVE'
  | 'HIGH_NOISE_NARRATIVE'
  | 'OVERBOUGHT'
  | 'OVERSOLD'
  | 'LOW_LIQUIDITY';

export type OverlaySeverity = 'low' | 'medium' | 'high';

export interface PulseOverlay {
  code: PulseOverlayCode;
  severity: OverlaySeverity;
  reason: string; // short explanation
  evidence: string[]; // references e.g. ["market.indicators.rsi14", "narrative.flags.highNoise"]
}

export interface PulseContextExtension {
  confidence: number; // 0..1
  overlays: PulseOverlay[];
  narrativeTag?: {
    label: string;
    reliability: 'low' | 'medium' | 'high';
  };
  asOfISO: string;
}

/**
 * Oracle Pattern Types
 */
export type OraclePatternCode =
  | 'FOMO_ENTRY'
  | 'FALLING_KNIFE'
  | 'STEADY_ACCUMULATION'
  | 'LATE_BREAKOUT'
  | 'LIQUIDITY_EXIT_RISK';

export interface OraclePattern {
  code: OraclePatternCode;
  confidence: number; // 0..1
  evidence: Array<{
    ref: string;
    detail: string;
  }>;
}

export interface OracleBiasFlag {
  code: string;
  severity: 'low' | 'medium' | 'high';
  evidence: string[];
}

export interface OracleContextExtension {
  contextEvidenceSummary?: {
    evidenceLevel: EvidenceLevel;
    noiseLevel: NoiseLevel;
    used: Array<'market' | 'deltas' | 'narrative'>;
    notes: string[]; // explicit caveats
  };
  patterns?: OraclePattern[];
  ruleDiff?: Array<{
    ruleId: string;
    change: string;
    rationale: string;
  }>;
  biasFlags?: OracleBiasFlag[];
}


