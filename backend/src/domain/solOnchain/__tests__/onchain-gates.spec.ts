import { describe, it, expect } from 'vitest';
import type { ChartFeaturePack } from '../../solChart/types.js';
import type { OnchainFeaturePack } from '../types.js';
import { applyOnchainGates } from '../gates/applyOnchainGates.js';

function baseChart(): ChartFeaturePack {
  return {
    asset: { mint: 'So11111111111111111111111111111111111111112' },
    timeframe: '1m',
    window: { candles: 100, startTs: 0, endTs: 0 },
    ohlcvSummary: {
      lastPrice: 100,
      volume: { mean: 0, stdev: 0, last: 0, zScore: 0 },
      volatility: { atr: 1, atrPct: 0.02, bbWidth: 0, bbWidthPct: 0 },
    },
    marketRegime: { regime: 'range', strength: 0.5, structure: { hhCount: 0, hlCount: 0, lhCount: 0, llCount: 0, lastSwing: 'HL' } },
    pivots: { method: 'zigzag', points: [] },
    srLevels: {
      supports: [{ price: 95, touches: 3, clusterScore: 0.8 }],
      resistances: [{ price: 101, touches: 3, clusterScore: 0.8 }],
    },
    patternCandidates: [],
  };
}

function baseOnchain(): OnchainFeaturePack {
  return {
    mint: 'So11111111111111111111111111111111111111112',
    asOfTs: 0,
    windows: { short: '5m', baseline: '1h' },
    availability: { activity: true, holders: true, flows: true, liquidity: true, riskFlags: true },
    activity: { txCount: { short: 10, baseline: 100, zScore: 2.5 }, uniqueWallets: { short: null, baseline: null, zScore: null } },
    holders: { holders: { current: null }, holdersDeltaPct: { short: null, baseline: null } },
    flows: {
      netInflowProxy: { short: 1, baseline: 1, zScore: -1.5 },
      largeTransfersProxy: { short: 1, baseline: 1, zScore: 1.3 },
    },
    liquidity: { liquidityDeltaPct: { short: -0.31, baseline: null } },
    riskFlags: {
      largeHolderDominance: { value: true, why: 'test' },
      suddenLiquidityDrop: { value: true, why: 'test' },
    },
  };
}

function baseSetup() {
  return {
    name: 'Breakout retest long',
    bias: 'long' as const,
    timeframe: '1m' as const,
    entry: { type: 'trigger' as const, level: 101, rule: 'Breakout then retest' },
    stop: { level: 98, rule: 'Below last swing low', invalidation: 'Close below 98' },
    targets: [{ level: 110, rationale: 'SR' }],
    confidence: 0.8,
    evidence: ['srLevels', 'regime'],
    onchainGate: { pass: true, notes: [] as string[] },
    notes: [] as string[],
  };
}

describe('applyOnchainGates (decision-grade gating) - unit', () => {
  it('does not apply gates in free tier', () => {
    const chart = baseChart();
    const onchain = baseOnchain();
    const setup = baseSetup();
    const out = applyOnchainGates({ tier: 'free', chart, onchain, setups: [setup] });
    expect(out[0]).toEqual(setup);
  });

  it('applies frozen gating rules and clamps confidence', () => {
    const chart = baseChart();
    const onchain = baseOnchain();
    const setup = baseSetup();

    const out = applyOnchainGates({ tier: 'pro', chart, onchain, setups: [setup] })[0]!;

    // Starting 0.8:
    // (1) netZ=-1.5 & near resistance & long => -0.15
    // (3) largeZ=1.3 & largeHolderDominance=true => -0.10
    // (4) liquidityDeltaPct.short=-0.31 & (nearRes || breakout) => -0.20 and pass=false
    // (2) netZ>1.0 does NOT apply (netZ is negative)
    expect(out.confidence).toBeCloseTo(0.35, 6);
    expect(out.onchainGate.pass).toBe(false);
    expect(out.onchainGate.notes.join(' ')).toContain('distribution');
    expect(out.onchainGate.notes.join(' ')).toContain('Whale');
    expect(out.onchainGate.notes.join(' ')).toContain('Liquidity risk');
  });

  it('scales confidence deltas in high tier (×1.25)', () => {
    const chart = baseChart();
    const onchain = baseOnchain();
    const setup = baseSetup();

    const out = applyOnchainGates({ tier: 'high', chart, onchain, setups: [setup] })[0]!;

    // Deltas: -0.15,-0.10,-0.20 => total -0.45; scaled => -0.5625 => 0.2375
    expect(out.confidence).toBeCloseTo(0.2375, 6);
    expect(out.onchainGate.pass).toBe(false);
  });
});

