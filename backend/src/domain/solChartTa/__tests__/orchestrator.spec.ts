import { describe, it, expect } from 'vitest';
import type { SolanaOnchainProvider } from '../../solOnchain/provider.js';
import { computeProviderFingerprint } from '../../solOnchain/provider.js';
import type { AnalysisResult, SetupCard } from '../schema.js';
import { runChartAnalysisWithOnchainGating } from '../orchestrator.js';

function makeCandles(n = 120, startTs = 0, stepMs = 60_000, base = 100): Array<{ ts: number; open: number; high: number; low: number; close: number; volume: number }> {
  const out = [];
  for (let i = 0; i < n; i++) {
    const close = base + i * 0.01;
    out.push({
      ts: startTs + i * stepMs,
      open: close - 0.02,
      high: close + 0.03,
      low: close - 0.04,
      close,
      volume: 1000 + i,
    });
  }
  return out;
}

function baseAnalysis(input: { requestId: string; tier: AnalysisResult['tier']; taskKind: AnalysisResult['taskKind']; mint: string; timeframe: SetupCard['timeframe']; plan: SetupCard[] }): AnalysisResult {
  return {
    requestId: input.requestId,
    tier: input.tier,
    taskKind: input.taskKind,
    asset: { mint: input.mint },
    timeframesAnalyzed: [input.timeframe],
    headline: 'Test headline',
    summaryBullets: ['b1', 'b2'],
    plan: input.plan,
    risk: { posture: 'medium', keyRisks: ['r1'], guardrails: ['g1'] },
    details: {
      regimeExplain: 'range',
      srTable: { supports: [95], resistances: [101] },
      patternReview: [],
      onchainExplain: '',
      assumptions: ['a1'],
      invalidationRules: ['i1'],
    },
  };
}

function makeSetup(input: { name: string; confidence: number; bias?: 'long' | 'short' | 'neutral' }): SetupCard {
  return {
    name: input.name,
    bias: input.bias ?? 'long',
    timeframe: '1m',
    entry: { type: 'trigger', level: 101, rule: 'Breakout then retest' },
    stop: { level: 98, rule: 'Below swing', invalidation: 'Close below 98' },
    targets: [{ level: 110, rationale: 'SR' }],
    confidence: input.confidence,
    evidence: ['srLevels', 'regime'],
    onchainGate: { pass: true, notes: [] },
    notes: [],
  };
}

function makeCountingProvider(overrides?: Partial<SolanaOnchainProvider> & { flowsZ?: number; liqDelta?: number; largeZ?: number; largeHolder?: boolean }) {
  const calls = { activity: 0, holders: 0, flows: 0, liquidity: 0, riskFlags: 0 };
  const p: SolanaOnchainProvider = {
    tag: 'mock',
    version: '1.0.0',
    capabilities() {
      return { activity: true, holders: true, flows: true, liquidity: true, riskFlags: true };
    },
    fingerprint() {
      return computeProviderFingerprint({ tag: this.tag, version: this.version, capabilities: this.capabilities() });
    },
    async getActivity() {
      calls.activity++;
      return { available: true, data: { txCount: { short: 10, baseline: 100, zScore: null }, uniqueWallets: { short: null, baseline: null, zScore: null } } };
    },
    async getHolders() {
      calls.holders++;
      return { available: true, data: { holders: { current: null }, holdersDeltaPct: { short: null, baseline: null } } };
    },
    async getFlows() {
      calls.flows++;
      return {
        available: true,
        data: {
          netInflowProxy: { short: 1, baseline: 1, zScore: overrides?.flowsZ ?? -1.5 },
          largeTransfersProxy: { short: 1, baseline: 1, zScore: overrides?.largeZ ?? 1.3 },
        } as any,
      };
    },
    async getLiquidity() {
      calls.liquidity++;
      return {
        available: true,
        data: {
          liquidityDeltaPct: { short: overrides?.liqDelta ?? -0.31, baseline: null },
        } as any,
      };
    },
    async getRiskFlags() {
      calls.riskFlags++;
      return {
        available: true,
        data: {
          largeHolderDominance: { value: overrides?.largeHolder ?? true, why: 'test' },
        },
      };
    },
    ...(overrides ?? {}),
  };
  return { provider: p, calls };
}

describe('chart orchestrator wiring: chart → setups → onchain → gates → sort', () => {
  it('FREE: no-op gating, no enhanced calls, setups unchanged', async () => {
    const { provider, calls } = makeCountingProvider();
    const setups = [makeSetup({ name: 'S1', confidence: 0.4 }), makeSetup({ name: 'S2', confidence: 0.9 })];

    const out = await runChartAnalysisWithOnchainGating(
      {
        requestId: 'r1',
        tier: 'free',
        taskKind: 'chart_setups',
        mint: 'So11111111111111111111111111111111111111112',
        timeframe: '1m',
        candles: makeCandles(),
      },
      {
        onchainProvider: provider,
        generateBase: async ({ requestId, tier, taskKind, chart }) =>
          baseAnalysis({ requestId, tier, taskKind, mint: chart.asset.mint, timeframe: chart.timeframe, plan: setups }),
      }
    );

    // No-op gating: confidence and order unchanged.
    expect(out.result.plan.map(s => s.confidence)).toEqual([0.4, 0.9]);
    expect(out.result.plan.map(s => s.name)).toEqual(['S1', 'S2']);

    // No enhanced calls in free (flows/liquidity must not be called).
    expect(calls.flows).toBe(0);
    expect(calls.liquidity).toBe(0);
    // Risk flags may be fetched.
    expect(calls.riskFlags).toBe(1);
  });

  it('PRO + hasSetups=true: builds onchain pack and applies confidence deltas + gate notes', async () => {
    const { provider, calls } = makeCountingProvider();
    const setup = makeSetup({ name: 'Breakout retest long', confidence: 0.8 });

    const out = await runChartAnalysisWithOnchainGating(
      {
        requestId: 'r2',
        tier: 'pro',
        taskKind: 'chart_setups',
        mint: 'So11111111111111111111111111111111111111112',
        timeframe: '1m',
        candles: makeCandles(),
      },
      {
        onchainProvider: provider,
        generateBase: async ({ requestId, tier, taskKind, chart }) =>
          baseAnalysis({ requestId, tier, taskKind, mint: chart.asset.mint, timeframe: chart.timeframe, plan: [setup] }),
      }
    );

    expect(calls.flows).toBe(1);
    expect(calls.liquidity).toBe(1);

    expect(out.result.plan).toHaveLength(1);
    expect(out.result.plan[0]!.confidence).toBeCloseTo(0.35, 6);
    expect(out.result.plan[0]!.onchainGate.pass).toBe(false);
    expect(out.result.plan[0]!.onchainGate.notes.join(' ')).toContain('Liquidity risk');
  });

  it('hasSetups=false: must not call flows/liquidity provider methods', async () => {
    const { provider, calls } = makeCountingProvider();

    const out = await runChartAnalysisWithOnchainGating(
      {
        requestId: 'r3',
        tier: 'pro',
        taskKind: 'chart_setups',
        mint: 'So11111111111111111111111111111111111111112',
        timeframe: '1m',
        candles: makeCandles(),
      },
      {
        onchainProvider: provider,
        generateBase: async ({ requestId, tier, taskKind, chart }) =>
          baseAnalysis({ requestId, tier, taskKind, mint: chart.asset.mint, timeframe: chart.timeframe, plan: [] }),
      }
    );

    expect(out.result.plan).toEqual([]);
    expect(calls.flows).toBe(0);
    expect(calls.liquidity).toBe(0);
  });

  it('sorting: gated setups sorted by confidence desc (stable for ties)', async () => {
    const { provider } = makeCountingProvider();
    const setups = [makeSetup({ name: 'A', confidence: 0.6 }), makeSetup({ name: 'B', confidence: 0.6 }), makeSetup({ name: 'C', confidence: 0.2 })];

    const out = await runChartAnalysisWithOnchainGating(
      {
        requestId: 'r4',
        tier: 'pro',
        taskKind: 'chart_setups',
        mint: 'So11111111111111111111111111111111111111112',
        timeframe: '1m',
        candles: makeCandles(),
      },
      {
        onchainProvider: provider,
        generateBase: async ({ requestId, tier, taskKind, chart }) =>
          baseAnalysis({ requestId, tier, taskKind, mint: chart.asset.mint, timeframe: chart.timeframe, plan: setups }),
      }
    );

    // With our onchain config, A and B are both long + nearRes => reduced equally; preserve relative order for ties.
    const names = out.result.plan.map(s => s.name);
    expect(names[0]).toBe('A');
    expect(names[1]).toBe('B');
  });
});

