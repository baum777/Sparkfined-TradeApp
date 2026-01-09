/**
 * SOL Chart TA + Journal Prompt Logic (FROZEN)
 * -------------------------------------------
 * Stable, cacheable schema contract:
 * - Input: deterministic backend FeaturePacks
 * - Output: JSON + Text (text is rendered from JSON "details" keys)
 *
 * NOTE: This is a TypeScript contract. Validation (e.g. zod) should live in
 * backend-specific modules when needed.
 */

export type SolTimeframe = '15s' | '30s' | '1m' | '5m' | '15m' | '30m' | '1h' | '4h';

export type AnalysisTier = 'free' | 'standard' | 'pro' | 'high';

export type SolChartTaskKind =
  | 'chart_teaser_free'
  | 'chart_setups'
  | 'chart_patterns_validate'
  | 'chart_confluence_onchain'
  | 'chart_microstructure';

export type JournalTaskKind =
  | 'journal_teaser_free'
  | 'journal_review'
  | 'journal_playbook_update'
  | 'journal_risk';

export type SolAnalysisTaskKind = SolChartTaskKind | JournalTaskKind;

export interface ChartFeaturePack {
  asset: { mint: string; symbol?: string };
  timeframe: SolTimeframe;
  window: { candles: number; startTs: number; endTs: number };
  ohlcvSummary: {
    lastPrice: number;
    returns?: { r_15m?: number; r_1h?: number; r_4h?: number };
    volume: { mean: number; stdev: number; last: number; zScore: number };
    volatility: { atr: number; atrPct: number; bbWidth: number; bbWidthPct: number };
  };
  marketRegime: {
    regime: 'trend_up' | 'trend_down' | 'range' | 'transition';
    strength: number; // 0..1
    structure: {
      hhCount: number;
      hlCount: number;
      lhCount: number;
      llCount: number;
      lastSwing: 'HH' | 'HL' | 'LH' | 'LL';
    };
  };
  pivots: {
    method: 'zigzag' | 'fractals';
    points: Array<{ ts: number; price: number; type: 'H' | 'L'; strength: 1 | 2 | 3 | 4 | 5 }>;
  };
  srLevels: {
    supports: Array<{ price: number; touches: number; clusterScore: number }>;
    resistances: Array<{ price: number; touches: number; clusterScore: number }>;
  };
  liquidityEvents?: {
    sweeps: Array<{
      ts: number;
      level: number;
      side: 'above' | 'below';
      reclaimWithinBars: number;
      confidence: number; // 0..1
    }>;
    gapsOrImbalances?: Array<{
      ts: number;
      from: number;
      to: number;
      direction: string;
      confidence: number; // 0..1
    }>;
  };
  indicatorSnapshot?: {
    rsi?: { value: number; divergence?: 'bull' | 'bear' | 'none' };
    macd?: { state: 'bull' | 'bear' | 'flat' };
    vwap?: { distancePct: number };
  };
  patternCandidates?: Array<{
    type: 'HNS' | 'IHNS' | 'WOLFE' | 'TRIANGLE' | 'WEDGE' | 'DBL_TOP' | 'DBL_BOT';
    tf: SolTimeframe;
    points: Array<{ label: string; ts: number; price: number }>;
    checks: Array<{ name: string; pass: boolean; score: number }>;
    rawConfidence: number; // 0..1
  }>;
  constraintsHint?: {
    minRR?: number;
    maxRiskPct?: number;
  };
}

export interface OnchainFeaturePack {
  mint: string;
  window?: { w1m?: number; w5m?: number; w15m?: number; w1h?: number; w4h?: number };
  activity?: {
    txCountDelta: { short: number; baseline: number; zScore: number };
    uniqueWalletDelta: { short: number; baseline: number; zScore: number };
  };
  holders?: {
    holdersDeltaPct: { short: number; long: number };
    concentrationTop10Pct?: number;
  };
  flows?: {
    netInflowProxy?: number | null;
    exchangeRelatedFlowProxy?: number | null;
  };
  liquidity?: {
    liquidityDeltaPct?: number | null;
    poolCountDelta?: number | null;
  };
  riskFlags?: {
    mintAuthorityActive?: boolean | null;
    freezeAuthorityActive?: boolean | null;
    largeHolderDominance?: boolean | null;
    suddenSupplyChange?: boolean | null;
  };
}

export interface ResponseEnvelope<T> {
  status: 'ok';
  data: T;
}

export interface SetupCard {
  name: string;
  bias: 'long' | 'short' | 'neutral';
  timeframe: SolTimeframe;
  entry: { type: 'market' | 'limit' | 'trigger'; level: number | null; rule: string };
  stop: { level: number; rule: string; invalidation: string };
  targets: Array<{ level: number; rationale: string }>;
  confidence: number; // 0..1
  evidence: string[];
  onchainGate: { pass: boolean; notes: string[] };
  notes: string[];
}

export interface RiskBlock {
  posture: 'low' | 'medium' | 'high';
  keyRisks: string[];
  guardrails: string[];
}

export interface DetailsBlock {
  regimeExplain: string;
  srTable: { supports: number[]; resistances: number[] };
  patternReview: Array<{
    type: string;
    tf: SolTimeframe;
    verdict: 'valid' | 'weak' | 'reject';
    why: string;
    confidence: number;
  }>;
  onchainExplain: string;
  assumptions: string[];
  invalidationRules: string[];
}

export interface AnalysisResult {
  requestId: string;
  tier: AnalysisTier;
  taskKind: SolAnalysisTaskKind;
  asset: { mint: string; symbol?: string };
  timeframesAnalyzed: SolTimeframe[];
  headline: string;
  summaryBullets: string[];
  plan: SetupCard[];
  risk: RiskBlock;
  details: DetailsBlock;
}

