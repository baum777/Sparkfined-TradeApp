import type { InputCandle, SolTimeframe, ChartFeaturePack } from '../solChart/types.js';
import { buildChartFeaturePackWithCacheMeta } from '../solChart/builder.js';
import type { SolanaOnchainProvider } from '../solOnchain/provider.js';
import { buildOnchainFeaturePackWithCacheMeta } from '../solOnchain/buildOnchainFeaturePack.js';
import { getOnchainProvider } from '../solOnchain/getOnchainProvider.js';
import { applyOnchainGates } from '../solOnchain/gates/applyOnchainGates.js';
import { getOnchainTuningFromEnv } from './onchainTuning.js';
import { analysisResultSchema, type AnalysisResult, type AnalysisTier, type SolAnalysisTaskKind, type SetupCard } from './schema.js';
import { renderAnalysisText } from './renderText.js';
import { buildChartAnalysisPrompt, templateIdForTaskKind } from './prompt.js';
import { routeLLMRequest } from '../../clients/llmRouter.js';
import { getTemplateSystemPrompt } from '../../lib/llm/templates/solChartJournal.js';

export type ChartAnalysisInput = {
  requestId: string;
  tier: AnalysisTier;
  taskKind: SolAnalysisTaskKind;
  mint: string;
  symbol?: string;
  timeframe: SolTimeframe;
  candles: InputCandle[];
};

export type ChartAnalysisDeps = {
  /**
   * Injection seam (tests): LLM/heuristic setup generator.
   * Must return a FULL AnalysisResult object (plan can be empty).
   */
  generateBase?: (input: {
    requestId: string;
    tier: AnalysisTier;
    taskKind: SolAnalysisTaskKind;
    chart: ChartFeaturePack;
  }) => Promise<AnalysisResult>;
  onchainProvider?: SolanaOnchainProvider;
};

function stableSortByConfidenceDesc(setups: SetupCard[]): SetupCard[] {
  const indexed = setups.map((s, i) => ({ s, i }));
  indexed.sort((a, b) => {
    const dc = b.s.confidence - a.s.confidence;
    if (dc !== 0) return dc;
    return a.i - b.i;
  });
  return indexed.map(x => x.s);
}

function summarizeOnchainExplain(input: { tier: AnalysisTier; onchainNotes?: string[]; onchainRiskFlags: any }): string {
  const notes = (input.onchainNotes ?? []).filter(Boolean);
  const rf = input.onchainRiskFlags ?? {};

  const active: string[] = [];
  for (const key of ['mintAuthorityActive', 'freezeAuthorityActive', 'suddenSupplyChange', 'largeHolderDominance', 'washLikeActivitySpike', 'suddenLiquidityDrop']) {
    const v = rf?.[key]?.value;
    if (v === true) active.push(key);
  }

  if (input.tier === 'free') {
    return active.length ? `riskFlags=true: ${active.join(', ')}` : 'riskFlags: none flagged (best-effort)';
  }

  const parts: string[] = [];
  if (active.length) parts.push(`riskFlags=true: ${active.join(', ')}`);
  if (notes.length) parts.push(`notes: ${notes.join(' | ')}`);
  return parts.length ? parts.join(' — ') : 'onchain: limited/empty';
}

async function defaultGenerateBase(input: {
  requestId: string;
  tier: AnalysisTier;
  taskKind: SolAnalysisTaskKind;
  chart: ChartFeaturePack;
}): Promise<AnalysisResult> {
  // Free-tier downgrade (frozen policy).
  const taskKindApplied =
    input.tier === 'free' && input.taskKind.startsWith('chart_') && input.taskKind !== 'chart_teaser_free'
      ? 'chart_teaser_free'
      : input.taskKind;

  const prompt = buildChartAnalysisPrompt({
    requestId: input.requestId,
    tier: input.tier,
    taskKind: taskKindApplied,
    chart: input.chart,
  });

  const templateId = templateIdForTaskKind(taskKindApplied);
  const system = getTemplateSystemPrompt(templateId);

  const r = await routeLLMRequest(
    'charts',
    {
      prompt,
      system,
      timeoutMs: 25_000,
      jsonOnly: true,
    },
    { userId: 'anon' }
  );

  return analysisResultSchema.parse(r.parsed);
}

export async function runChartAnalysisWithOnchainGating(
  input: ChartAnalysisInput,
  deps?: ChartAnalysisDeps
): Promise<{ result: AnalysisResult; text: string }> {
  // 1) Chart pack
  const chartMeta = buildChartFeaturePackWithCacheMeta({
    mint: input.mint,
    symbol: input.symbol,
    timeframe: input.timeframe,
    candles: input.candles,
  });
  const chart = chartMeta.pack;

  // 2) Base analysis (existing generator; injected)
  const generateBase = deps?.generateBase ?? defaultGenerateBase;
  const baseRaw = await generateBase({
    requestId: input.requestId,
    tier: input.tier,
    taskKind: input.taskKind,
    chart,
  });
  const base = analysisResultSchema.parse(baseRaw);

  const setupsBase = base.plan ?? [];
  const hasSetups = setupsBase.length > 0;

  // 3) Onchain pack (tier-strict + hasSetups handled inside builder)
  const provider = deps?.onchainProvider ?? getOnchainProvider();
  const { pack: onchain } = await buildOnchainFeaturePackWithCacheMeta({
    mint: input.mint,
    timeframe: input.timeframe,
    tier: input.tier,
    hasSetups,
    provider,
    asOfTs: chart.window.endTs,
  });

  // 4) Apply gates (FREE is no-op by design)
  const tuning = getOnchainTuningFromEnv();
  const setupsGated = applyOnchainGates({
    tier: input.tier,
    chart,
    onchain,
    setups: setupsBase,
    tuning,
  });

  // 5) Sort (keep FREE as strict no-op: preserve original order)
  const planFinal = input.tier === 'free' ? setupsGated : stableSortByConfidenceDesc(setupsGated);

  const details = {
    ...base.details,
    onchainExplain: summarizeOnchainExplain({ tier: input.tier, onchainNotes: onchain.notes, onchainRiskFlags: onchain.riskFlags }),
  };

  const result: AnalysisResult = {
    ...base,
    requestId: input.requestId,
    tier: input.tier,
    taskKind: input.taskKind,
    asset: { mint: input.mint, ...(input.symbol ? { symbol: input.symbol } : {}) },
    timeframesAnalyzed: base.timeframesAnalyzed?.length ? base.timeframesAnalyzed : [input.timeframe],
    plan: planFinal,
    details,
  };

  const text = renderAnalysisText(result);
  return { result, text };
}

