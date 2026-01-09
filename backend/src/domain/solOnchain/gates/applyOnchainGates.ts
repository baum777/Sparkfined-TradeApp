import type { ChartFeaturePack } from '../../solChart/types.js';
import type { OnchainFeaturePack } from '../types.js';

export type AnalysisTier = 'free' | 'standard' | 'pro' | 'high';

export type SetupCard = {
  name: string;
  bias: 'long' | 'short' | 'neutral';
  timeframe: ChartFeaturePack['timeframe'];
  entry: { type: 'market' | 'limit' | 'trigger'; level: number | null; rule: string };
  stop: { level: number; rule: string; invalidation: string };
  targets: Array<{ level: number; rationale: string }>;
  confidence: number; // 0..1
  evidence: string[];
  onchainGate: { pass: boolean; notes: string[] };
  notes: string[];
};

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function nearResistance(chart: ChartFeaturePack): boolean {
  const last = chart.ohlcvSummary.lastPrice;
  if (!Number.isFinite(last) || last <= 0) return false;

  const rs = chart.srLevels.resistances
    .map(r => r.price)
    .filter(p => Number.isFinite(p) && p > 0)
    .sort((a, b) => a - b);

  const nearest = rs.find(r => r >= last);
  if (nearest == null) return false;

  const distPct = (nearest - last) / last;
  const atrPct = chart.ohlcvSummary.volatility.atrPct;
  const thresh = Math.max(0.01, Number.isFinite(atrPct) ? atrPct : 0);
  return distPct <= thresh;
}

function isBreakoutOrRetest(setup: SetupCard): boolean {
  const hay = `${setup.name} ${setup.entry.rule}`.toLowerCase();
  return hay.includes('breakout') || hay.includes('retest');
}

function getBoolFlag(pack: OnchainFeaturePack, key: keyof OnchainFeaturePack['riskFlags']): boolean | null {
  const rf: any = pack.riskFlags as any;
  const v = rf?.[key]?.value;
  return typeof v === 'boolean' ? v : v === null ? null : null;
}

function getNum(pack: any, path: string[]): number | null {
  let cur = pack;
  for (const p of path) cur = cur?.[p];
  return typeof cur === 'number' && Number.isFinite(cur) ? cur : cur === null ? null : null;
}

export function applyOnchainGates(input: {
  tier: AnalysisTier;
  chart: ChartFeaturePack;
  onchain: OnchainFeaturePack;
  setups: SetupCard[];
}): SetupCard[] {
  // Frozen policy: FREE gets no flows/liquidity gates.
  if (input.tier === 'free') return input.setups;

  const scale = input.tier === 'high' ? 1.25 : 1.0;

  const netZ = getNum(input.onchain, ['flows', 'netInflowProxy', 'zScore']);
  const largeZ = getNum(input.onchain, ['flows', 'largeTransfersProxy', 'zScore']);
  const nearRes = nearResistance(input.chart);

  const largeHolderDominance = getBoolFlag(input.onchain, 'largeHolderDominance');
  const suddenLiquidityDrop = getBoolFlag(input.onchain, 'suddenLiquidityDrop');

  return input.setups.map(s0 => {
    const notes: string[] = [];
    let pass = s0.onchainGate?.pass ?? true;
    let confidence = s0.confidence;

    // (1) Distribution Warning
    if (netZ != null && netZ < -1.0 && s0.bias === 'long' && nearRes) {
      confidence -= 0.15 * scale;
      notes.push('Onchain distribution detected near resistance');
    }

    // (2) Accumulation Confirmation
    if (netZ != null && netZ > 1.0 && isBreakoutOrRetest(s0)) {
      confidence += 0.15 * scale;
      notes.push('Onchain inflow supports breakout follow-through');
    }

    // (3) Whale Risk
    if (largeZ != null && largeZ > 1.2 && largeHolderDominance === true) {
      confidence -= 0.1 * scale;
      notes.push('Whale transfer activity elevated vs baseline (risk)');
      // Tighten stop recommendation: do not change numeric stop; add explicit rule note.
      notes.push('Tighten stop: elevated whale activity + concentrated holders');
    }

    // (4) Liquidity Risk
    if (suddenLiquidityDrop === true) {
      confidence -= 0.2 * scale;
      pass = false;
      notes.push('Liquidity risk: sudden liquidity drop detected');
    }

    // Missing-data notes (best-effort, deterministic)
    if (netZ == null) notes.push('Onchain flows zScore unavailable');
    if (largeZ == null) notes.push('Onchain largeTransfers zScore unavailable');
    if (suddenLiquidityDrop == null) notes.push('Onchain liquidity risk flag unavailable');

    confidence = clamp01(confidence);

    return {
      ...s0,
      confidence,
      onchainGate: {
        pass,
        notes: [...(s0.onchainGate?.notes ?? []), ...notes],
      },
    };
  });
}

