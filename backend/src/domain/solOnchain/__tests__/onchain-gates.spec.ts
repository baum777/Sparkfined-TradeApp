import { describe, it, expect } from 'vitest';
import { applyOnchainGates } from '../applyOnchainGates.js';
import type { ChartFeaturePack } from '../../solChart/types.js';
import type { OnchainFeaturePack } from '../types.js';
import type { SetupCard } from '../../solChartAnalysis/contracts.js';

function chart(): ChartFeaturePack {
  return {
    asset: { mint: 'So11111111111111111111111111111111111111112' },
    timeframe: '1m',
    window: { candles: 100, startTs: 0, endTs: 1000 },
    ohlcvSummary: {
      lastPrice: 1,
      volume: { mean: 1, stdev: 1, last: 1, zScore: 0 },
      volatility: { atr: 0.01, atrPct: 0.01, bbWidth: 0.02, bbWidthPct: 0.02 },
    },
    marketRegime: { regime: 'range', strength: 0.5, structure: { hhCount: 1, hlCount: 1, lhCount: 1, llCount: 1, lastSwing: 'HL' } },
    pivots: { method: 'zigzag', points: [] },
    srLevels: { supports: [], resistances: [] },
  };
}

function onchainWithLiquidityDrop(): OnchainFeaturePack {
  return {
    mint: 'So11111111111111111111111111111111111111112',
    asOfTs: 1000,
    windows: { short: '5m', baseline: '1h' },
    availability: { activity: false, holders: false, flows: false, liquidity: true, riskFlags: false },
    activity: { txCount: { short: null, baseline: null, zScore: null }, uniqueWallets: { short: null, baseline: null, zScore: null } },
    holders: { holders: { current: null }, holdersDeltaPct: { short: null, baseline: null } },
    flows: { netInflowProxy: { short: null, baseline: null, zScore: null } },
    liquidity: { liquidityDeltaPct: { short: -0.4, baseline: null } },
    riskFlags: {},
    notes: ['proxy based on transfer-rate, not pool liquidity'],
  };
}

function setup(name: string): SetupCard {
  return {
    name,
    bias: 'long',
    timeframe: '1m',
    entry: { type: 'limit', level: 1, rule: 'breakout candidate' },
    stop: { level: 0.9, rule: '', invalidation: 'below breakout level' },
    targets: [],
    confidence: 0.6,
    evidence: [],
    onchainGate: { pass: true, notes: [] },
    notes: [],
  };
}

describe('applyOnchainGates hard-gate guardrails', () => {
  it('does NOT hard-gate on standard tier even if liquidity proxy drop + triggers', () => {
    const out = applyOnchainGates({
      timeframe: '1m',
      tier: 'standard',
      chart: chart(),
      onchain: onchainWithLiquidityDrop(),
      setups: [setup('Breakout Setup')],
      chartContext: { nearResistance: true },
    });

    expect(out[0]!.onchainGate.pass).toBe(true);
  });

  it('hard-gates ONLY when tier>=pro AND (nearResistance OR breakout-related) AND delta<threshold', () => {
    const base = {
      timeframe: '1m' as const,
      chart: chart(),
      onchain: onchainWithLiquidityDrop(),
    };

    // Trigger false: no nearResistance and not breakout-related → must pass.
    const noTrigger = applyOnchainGates({
      ...base,
      tier: 'pro',
      setups: [
        {
          ...setup('Mean Reversion'),
          entry: { type: 'limit', level: 1, rule: 'fade into range' },
          stop: { level: 0.9, rule: '', invalidation: 'below range low' },
        },
      ],
      chartContext: { nearResistance: false },
    });
    expect(noTrigger[0]!.onchainGate.pass).toBe(true);

    // Trigger true via nearResistance → must fail.
    const nearRes = applyOnchainGates({
      ...base,
      tier: 'pro',
      setups: [setup('Mean Reversion')],
      chartContext: { nearResistance: true },
    });
    expect(nearRes[0]!.onchainGate.pass).toBe(false);

    // Trigger true via breakout-related → must fail (even if nearResistance is false).
    const breakout = applyOnchainGates({
      ...base,
      tier: 'pro',
      setups: [setup('Breakout Setup')],
      chartContext: { nearResistance: false },
    });
    expect(breakout[0]!.onchainGate.pass).toBe(false);
  });
});

