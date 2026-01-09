/**
 * Backend-local mirror of `shared/contracts/sol-chart-ta-journal.ts`.
 *
 * IMPORTANT:
 * - Keep this in `/backend/src` to satisfy tsconfig rootDir constraints.
 * - Do NOT change the shape lightly: treated as a stable contract.
 */

import type { SolTimeframe } from '../solChart/types.js';

export type AnalysisTier = 'free' | 'standard' | 'pro' | 'high';

export type SolChartTaskKind =
  | 'chart_teaser_free'
  | 'chart_setups'
  | 'chart_patterns_validate'
  | 'chart_confluence_onchain'
  | 'chart_microstructure';

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
  taskKind: SolChartTaskKind;
  asset: { mint: string; symbol?: string };
  timeframesAnalyzed: SolTimeframe[];
  headline: string;
  summaryBullets: string[];
  plan: SetupCard[];
  risk: RiskBlock;
  details: DetailsBlock;
}

export interface AnalysisJsonTextResponse {
  json: AnalysisResult;
  text: string;
}

