/**
 * Deterministic SOL chart feature extraction types (backend-local).
 *
 * IMPORTANT:
 * This is a backend-only mirror of the shared contract shape in
 * `shared/contracts/sol-chart-ta-journal.ts`. We keep it local to avoid
 * importing files outside `/backend/src` (tsconfig rootDir constraint).
 */

export type SolTimeframe = '15s' | '30s' | '1m' | '5m' | '15m' | '30m' | '1h' | '4h';

export interface InputCandle {
  ts: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

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

export type PivotType = 'H' | 'L';
export interface PivotPoint {
  ts: number;
  price: number;
  type: PivotType;
  idx: number; // candle index for determinism / scoring
  strength?: 1 | 2 | 3 | 4 | 5;
}

export interface SRLevel {
  price: number;
  touches: number;
  clusterScore: number; // 0..1
}

export interface LiquiditySweep {
  ts: number;
  level: number;
  side: 'above' | 'below';
  reclaimWithinBars: number;
  confidence: number; // 0..1
}

export interface PatternCheck {
  name: string;
  pass: boolean;
  score: number; // 0..1
}

export interface PatternCandidate {
  type: 'HNS' | 'IHNS' | 'WOLFE' | 'TRIANGLE' | 'WEDGE' | 'DBL_TOP' | 'DBL_BOT';
  tf: SolTimeframe;
  points: Array<{ label: string; ts: number; price: number }>;
  checks: PatternCheck[];
  rawConfidence: number; // 0..1
}

