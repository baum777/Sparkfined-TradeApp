import type { InputCandle, SolTimeframe } from '../types.js';
import type { AnalysisJsonTextResponse, AnalysisTier, SolChartTaskKind } from '../../solChartAnalysis/contracts.js';
import type { SolanaOnchainProvider } from '../../solOnchain/provider.js';
import { analyzeChartWithOnchainGating } from '../../solChartAnalysis/orchestrator.js';

export type AnalyzeTAInput = {
  requestId: string;
  mint: string;
  symbol?: string;
  timeframe: SolTimeframe;
  candles: InputCandle[];
  tier: AnalysisTier;
  taskKind?: SolChartTaskKind;
  chartContext?: { nearResistance?: boolean };
  // DI seam (tests)
  onchainProvider?: SolanaOnchainProvider;
};

/**
 * Canonical TA analysis service for SOL charts.
 *
 * NOTE: This is intentionally a thin wrapper so handlers stay minimal,
 * while the orchestration logic remains centralized and testable.
 */
export async function analyzeTA(input: AnalyzeTAInput): Promise<AnalysisJsonTextResponse> {
  return await analyzeChartWithOnchainGating({
    requestId: input.requestId,
    mint: input.mint,
    symbol: input.symbol,
    timeframe: input.timeframe,
    candles: input.candles,
    tier: input.tier,
    taskKind: input.taskKind ?? 'chart_setups',
    chartContext: input.chartContext,
    onchainProvider: input.onchainProvider,
  });
}

