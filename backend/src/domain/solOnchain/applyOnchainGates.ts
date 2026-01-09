import type { ChartFeaturePack, SolTimeframe } from '../solChart/types.js';
import type { OnchainFeaturePack } from './types.js';
import type { AnalysisTier, SetupCard } from '../solChartAnalysis/contracts.js';

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

function roundToStep(x: number, step = 0.0001): number {
  if (!Number.isFinite(x)) return 0;
  return Math.round(x / step) * step;
}

function uniqKeepOrder(xs: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of xs) {
    const s = String(x);
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

function isBreakoutRelated(setup: SetupCard): boolean {
  const hay = `${setup.name} ${setup.entry.rule} ${setup.stop.invalidation}`.toLowerCase();
  return hay.includes('breakout') || hay.includes('breakdown');
}

export type ApplyOnchainGatesInput = {
  timeframe: SolTimeframe;
  tier: AnalysisTier;
  chart: ChartFeaturePack;
  onchain: OnchainFeaturePack;
  setups: SetupCard[];
  tuning?: {
    riskFlagPenalty?: number; // default 0.15
    liquidityDropHardGatePct?: number; // default -0.30
  };
  chartContext?: {
    nearResistance?: boolean;
  };
};

/**
 * Applies onchain gates to existing SetupCard[].
 *
 * Non-negotiables:
 * - FREE tier is a NO-OP (confidence unchanged; no gate changes required).
 * - Notes are deterministic and stable.
 */
export function applyOnchainGates(input: ApplyOnchainGatesInput): SetupCard[] {
  // FREE: no-op gating (do not alter setups/confidence).
  if (input.tier === 'free') return input.setups;

  const riskFlagPenalty = typeof input.tuning?.riskFlagPenalty === 'number' ? input.tuning.riskFlagPenalty : 0.15;
  const liquidityDropHardGatePct =
    typeof input.tuning?.liquidityDropHardGatePct === 'number' ? input.tuning.liquidityDropHardGatePct : -0.30;

  const liquidityProxyDelta = input.onchain.liquidity?.liquidityDeltaPct?.short ?? null;
  const flowsAvailable = Boolean(input.onchain.availability?.flows);
  const liquidityAvailable = Boolean(input.onchain.availability?.liquidity);

  const baseDisclaimers: string[] = [];
  if (flowsAvailable) baseDisclaimers.push('best-effort proxy from tokenTransfers; not exchange-identified flows');
  if (liquidityAvailable) baseDisclaimers.push('proxy based on transfer-rate, not pool liquidity');

  return input.setups.map((s) => {
    let softDelta = 0;
    let hardDelta = 0;
    const notes: string[] = [...(s.onchainGate?.notes ?? []), ...baseDisclaimers];
    let pass = s.onchainGate?.pass ?? true;

    const rf = input.onchain.riskFlags ?? {};

    if (rf.mintAuthorityActive?.value === true) {
      softDelta -= riskFlagPenalty;
      notes.push('risk: mint authority active');
    }
    if (rf.freezeAuthorityActive?.value === true) {
      softDelta -= riskFlagPenalty;
      notes.push('risk: freeze authority active');
    }
    if (rf.suddenSupplyChange?.value === true) {
      softDelta -= riskFlagPenalty;
      notes.push('risk: sudden supply change');
    }
    if (rf.largeHolderDominance?.value === true) {
      softDelta -= Math.min(0.1, riskFlagPenalty);
      notes.push('risk: large holder dominance');
    }

    // Flows proxy: compare short vs baseline transfer-rate (proxy).
    if (flowsAvailable) {
      const f = input.onchain.flows?.netInflowProxy;
      const short = f?.short ?? null;
      const baseline = f?.baseline ?? null;
      if (typeof short === 'number' && typeof baseline === 'number' && Number.isFinite(short) && Number.isFinite(baseline)) {
        if (short > baseline * 1.2) {
          softDelta += 0.05;
          notes.push('flows: transfer-rate up vs baseline (proxy)');
        } else if (short < baseline * 0.8) {
          softDelta -= 0.05;
          notes.push('flows: transfer-rate down vs baseline (proxy)');
        }
      }
    }

    // Liquidity proxy: sudden drop hard gate (PRO/HIGH only) with chart-context trigger.
    if (liquidityAvailable && typeof liquidityProxyDelta === 'number' && Number.isFinite(liquidityProxyDelta)) {
      if (liquidityProxyDelta < -0.2) {
        softDelta -= 0.1;
        notes.push(`liquidity: proxy delta ${(liquidityProxyDelta * 100).toFixed(1)}% (down)`);
      } else if (liquidityProxyDelta > 0.2) {
        softDelta += 0.05;
        notes.push(`liquidity: proxy delta ${(liquidityProxyDelta * 100).toFixed(1)}% (up)`);
      }

      const allowHardGate = input.tier === 'pro' || input.tier === 'high';
      const trigger = Boolean(input.chartContext?.nearResistance) || isBreakoutRelated(s);
      if (allowHardGate && trigger && liquidityProxyDelta < liquidityDropHardGatePct) {
        pass = false;
        hardDelta -= 0.25;
        notes.push('hard gate: suddenLiquidityDrop (proxy + chart-context)');
      }
    }

    // HIGH tier: scale only soft deltas (not hard gates).
    const softMultiplier = input.tier === 'high' ? 1.25 : 1;
    const delta = softDelta * softMultiplier + hardDelta;

    const nextConfidence = clamp01(roundToStep(s.confidence + delta, 0.0001));
    const nextNotes = uniqKeepOrder(notes);

    return {
      ...s,
      confidence: nextConfidence,
      onchainGate: { pass, notes: nextNotes },
    };
  });
}

