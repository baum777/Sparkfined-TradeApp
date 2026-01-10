import type { InputCandle, SolTimeframe } from '../solChart/types.js';
import { buildChartFeaturePackWithCacheMeta } from '../solChart/builder.js';
import { buildOnchainFeaturePackWithCacheMeta } from '../solOnchain/buildOnchainFeaturePack.js';
import { applyOnchainGates } from '../solOnchain/applyOnchainGates.js';
import type { SolanaOnchainProvider } from '../solOnchain/provider.js';
import { getOnchainProvider } from '../solOnchain/getOnchainProvider.js';
import { getEnv } from '../../config/env.js';
import type { AnalysisJsonTextResponse, AnalysisResult, AnalysisTier, SolChartTaskKind, SetupCard } from './contracts.js';
import { generateSetupCardsFromChart } from './setupGenerator.js';
import { renderAnalysisText } from './render.js';

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

export function sortSetupsByGatedConfidence(setups: SetupCard[]): SetupCard[] {
  return setups
    .map((x, idx) => ({ x, idx }))
    .sort((a, b) => (b.x.confidence - a.x.confidence) || (a.idx - b.idx))
    .map(r => r.x);
}

export function getNearResistanceThreshold(timeframe: SolTimeframe): number {
  // Defaults per spec:
  // - micro (15s/30s/1m): 0.3%
  // - intraday (5m/15m/30m): 0.6%
  // - swing (1h/4h): keep conservative fallback (0.75%)
  switch (timeframe) {
    case '15s':
    case '30s':
    case '1m':
      return 0.003;
    case '5m':
    case '15m':
    case '30m':
      return 0.006;
    case '1h':
    case '4h':
      return 0.0075;
    default: {
      const _exhaustive: never = timeframe;
      return _exhaustive;
    }
  }
}

export function computeNearResistance(input: {
  timeframe: SolTimeframe;
  lastPrice: number;
  resistances: Array<{ price: number }>;
}): boolean {
  const last = input.lastPrice;
  if (!Number.isFinite(last) || last <= 0) return false;
  const nearest = input.resistances.reduce<number | null>((best, r) => {
    const p = r.price;
    if (!Number.isFinite(p) || p <= 0) return best;
    const d = Math.abs(p - last) / last;
    return best == null ? d : Math.min(best, d);
  }, null);

  const threshold = getNearResistanceThreshold(input.timeframe);
  return nearest != null && nearest <= threshold;
}

function buildHeadline(input: { tier: AnalysisTier; timeframe: SolTimeframe; mint: string; symbol?: string; setups: SetupCard[] }): string {
  const asset = input.symbol ? `${input.symbol} (${input.mint.slice(0, 4)}…${input.mint.slice(-4)})` : `${input.mint.slice(0, 4)}…${input.mint.slice(-4)}`;
  const top = input.setups[0];
  const topStr = top ? `${top.name} (${Math.round(top.confidence * 100)}%)` : 'no setups';
  return `SOL Chart — ${asset} — tf=${input.timeframe} — ${topStr}`;
}

function buildRiskBlock(tier: AnalysisTier, setups: SetupCard[]): AnalysisResult['risk'] {
  const posture: AnalysisResult['risk']['posture'] =
    tier === 'free' ? 'medium' : setups.some(s => !s.onchainGate.pass) ? 'high' : 'medium';
  const keyRisks: string[] = [];
  const guardrails: string[] = [];

  if (setups.some(s => !s.onchainGate.pass)) keyRisks.push('Onchain gate failed for at least one setup (treat as higher risk).');
  guardrails.push('Use hard invalidation; do not widen stops after entry.');
  guardrails.push('Size down in high volatility / low liquidity regimes.');

  return { posture, keyRisks: keyRisks.slice(0, 5), guardrails: guardrails.slice(0, 5) };
}

export type ChartAnalysisInput = {
  requestId: string;
  mint: string;
  symbol?: string;
  timeframe: SolTimeframe;
  candles: InputCandle[];
  tier: AnalysisTier;
  taskKind: SolChartTaskKind;
  // DI seams (tests / future providers)
  onchainProvider?: SolanaOnchainProvider;
  chartContext?: { nearResistance?: boolean };
};

/**
 * Chart → Setups → Onchain → Gates → Render (JSON+Text).
 *
 * Non-negotiables:
 * - No prompt/template/schema changes required (pure wiring + deterministic gating).
 * - FREE tier is a no-op gate (builder disables enhanced blocks; applyOnchainGates returns setups unchanged).
 * - Deterministic asOfTs uses chart.window.endTs and onchain bucketing.
 */
export async function analyzeChartWithOnchainGating(input: ChartAnalysisInput): Promise<AnalysisJsonTextResponse> {
  const env = getEnv();

  // 1) Chart pack
  const chartMeta = buildChartFeaturePackWithCacheMeta({
    mint: input.mint,
    timeframe: input.timeframe,
    candles: input.candles,
    symbol: input.symbol,
  });
  const chart = chartMeta.pack;

  // 2) Base setups
  const setupsBase = generateSetupCardsFromChart(chart, { tier: input.tier, taskKind: input.taskKind });

  // 3) Conditional onchain build (tier-strict + hasSetups)
  const hasSetups = setupsBase.length > 0;
  const provider = input.onchainProvider ?? getOnchainProvider();
  const { pack: onchain } = await buildOnchainFeaturePackWithCacheMeta({
    mint: input.mint,
    timeframe: input.timeframe,
    tier: input.tier,
    hasSetups,
    provider,
    asOfTs: chart.window.endTs,
  });

  // 4) Apply gates
  const nearResistance =
    typeof input.chartContext?.nearResistance === 'boolean'
      ? input.chartContext.nearResistance
      : computeNearResistance({
          timeframe: input.timeframe,
          lastPrice: chart.ohlcvSummary.lastPrice,
          resistances: chart.srLevels.resistances ?? [],
        });

  const tuningProfile = env.ONCHAIN_TUNING_PROFILE;
  const tuning =
    tuningProfile === 'conservative'
      ? { riskFlagPenalty: 0.2, liquidityDropHardGatePct: -0.25 }
      : tuningProfile === 'aggressive'
        ? { riskFlagPenalty: 0.1, liquidityDropHardGatePct: -0.35 }
        : undefined;

  const setupsGated = applyOnchainGates({
    timeframe: input.timeframe,
    tier: input.tier,
    chart,
    onchain,
    setups: setupsBase,
    tuning,
    chartContext: { nearResistance },
  });

  // 5) Sort by gated confidence (stable tie-breaker)
  const plan = sortSetupsByGatedConfidence(setupsGated);

  const supports = (chart.srLevels.supports ?? []).slice(0, 3).map(s => s.price);
  const resistances = (chart.srLevels.resistances ?? []).slice(0, 3).map(r => r.price);

  const summaryBullets: string[] = [
    `Regime: ${chart.marketRegime.regime} (strength ${Math.round(clamp01(chart.marketRegime.strength) * 100)}%).`,
    `Last: ${chart.ohlcvSummary.lastPrice}. ATR%: ${chart.ohlcvSummary.volatility.atrPct}.`,
    supports.length ? `Supports: ${supports.join(', ')}` : 'Supports: n/a',
    resistances.length ? `Resistances: ${resistances.join(', ')}` : 'Resistances: n/a',
  ];

  const json: AnalysisResult = {
    requestId: input.requestId,
    tier: input.tier,
    taskKind: input.taskKind,
    asset: { mint: input.mint, symbol: input.symbol },
    timeframesAnalyzed: [input.timeframe],
    headline: buildHeadline({ tier: input.tier, timeframe: input.timeframe, mint: input.mint, symbol: input.symbol, setups: plan }),
    summaryBullets: summaryBullets.slice(0, 6),
    plan,
    risk: buildRiskBlock(input.tier, plan),
    details: {
      regimeExplain: `Regime=${chart.marketRegime.regime}; lastSwing=${chart.marketRegime.structure.lastSwing}.`,
      srTable: { supports, resistances },
      patternReview: (chart.patternCandidates ?? []).slice(0, 5).map(p => ({
        type: p.type,
        tf: p.tf,
        verdict: 'weak' as const,
        why: 'Deterministic backend candidate (validation not executed here).',
        confidence: clamp01(p.rawConfidence),
      })),
      onchainExplain: [
        input.tier === 'free' ? 'FREE tier: onchain gating is a no-op (info-only).' : 'Onchain signals applied as a filter (confidence deltas + gate notes).',
        ...(onchain.notes ?? []).slice(0, 6),
      ].join(' '),
      assumptions: ['Prices/levels are approximations; use your own execution rules.'],
      invalidationRules: ['If invalidation triggers, exit—do not average down.'],
    },
  };

  return { json, text: renderAnalysisText(json) };
}

