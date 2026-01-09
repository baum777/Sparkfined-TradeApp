import { describe, it, expect } from 'vitest';
import { applyOnchainGates } from '../applyOnchainGates.js';
import type { ChartFeaturePack } from '../../solChart/types.js';
import type { OnchainFeaturePack } from '../types.js';
import type { SetupCard } from '../../solChartAnalysis/contracts.js';

function baseChart(): ChartFeaturePack {
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

function baseOnchain(): OnchainFeaturePack {
  return {
    mint: 'So11111111111111111111111111111111111111112',
    asOfTs: 1000,
    windows: { short: '5m', baseline: '1h' },
    availability: { activity: false, holders: false, flows: true, liquidity: false, riskFlags: true },
    activity: { txCount: { short: null, baseline: null, zScore: null }, uniqueWallets: { short: null, baseline: null, zScore: null } },
    holders: { holders: { current: null }, holdersDeltaPct: { short: null, baseline: null } },
    flows: { netInflowProxy: { short: 2, baseline: 1, zScore: 0 } },
    liquidity: {},
    riskFlags: { mintAuthorityActive: { value: true, why: 'test' } },
    notes: [],
  };
}

function setup(conf = 0.6): SetupCard {
  return {
    name: 'Setup',
    bias: 'long',
    timeframe: '1m',
    entry: { type: 'limit', level: 1, rule: '' },
    stop: { level: 0.9, rule: '', invalidation: '' },
    targets: [],
    confidence: conf,
    evidence: [],
    onchainGate: { pass: true, notes: [] },
    notes: [],
  };
}

describe('applyOnchainGates HIGH scaling', () => {
  it('multiplies soft deltas by 1.25 for HIGH only', () => {
    const chart = baseChart();
    const onchain = baseOnchain();
    const setups = [setup(0.6)];

    const pro = applyOnchainGates({ timeframe: '1m', tier: 'pro', chart, onchain, setups });
    const high = applyOnchainGates({ timeframe: '1m', tier: 'high', chart, onchain, setups });

    const proDelta = pro[0]!.confidence - setups[0]!.confidence;
    const highDelta = high[0]!.confidence - setups[0]!.confidence;

    // Both should be negative overall due to mintAuthorityActive penalty.
    expect(highDelta).toBeLessThan(0);
    expect(proDelta).toBeLessThan(0);

    // HIGH magnitude should be ~1.25x (within rounding tolerance).
    expect(Math.abs(highDelta)).toBeGreaterThan(Math.abs(proDelta));
  });
});

