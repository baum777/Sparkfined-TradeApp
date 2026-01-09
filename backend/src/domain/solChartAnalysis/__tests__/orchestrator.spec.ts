import { describe, it, expect } from 'vitest';
import { analyzeChartWithOnchainGating, sortSetupsByGatedConfidence } from '../orchestrator.js';
import type { SolanaOnchainProvider } from '../../solOnchain/provider.js';
import { computeProviderFingerprint } from '../../solOnchain/provider.js';
import type { InputCandle } from '../../solChart/types.js';
import { buildChartFeaturePackWithCacheMeta } from '../../solChart/builder.js';
import { generateSetupCardsFromChart } from '../setupGenerator.js';

function mkTrendUpCandles(count = 80, startTs = 1_700_000_000_000, stepMs = 60_000): InputCandle[] {
  const out: InputCandle[] = [];
  for (let i = 0; i < count; i++) {
    const base = 1 + i * 0.01;
    out.push({
      ts: startTs + i * stepMs,
      open: base,
      high: base + 0.01,
      low: base - 0.01,
      close: base + 0.005,
      volume: 100 + (i % 7) * 10,
    });
  }
  return out;
}

function mkRangeCandles(count = 90, startTs = 1_700_000_000_000, stepMs = 60_000): InputCandle[] {
  const out: InputCandle[] = [];
  for (let i = 0; i < count; i++) {
    const base = 1 + 0.03 * Math.sin(i / 4);
    out.push({
      ts: startTs + i * stepMs,
      open: base,
      high: base + 0.01,
      low: base - 0.01,
      close: base + 0.002 * Math.cos(i / 3),
      volume: 120 + (i % 5) * 5,
    });
  }
  return out;
}

class MockProvider implements SolanaOnchainProvider {
  tag = 'mock';
  version = '1.0.0';

  calls = { activity: 0, holders: 0, flows: 0, liquidity: 0, riskFlags: 0 };

  constructor(
    private readonly cfg?: {
      riskFlags?: { mintAuthorityActive?: boolean; freezeAuthorityActive?: boolean };
      liquidityDeltaPct?: number | null;
    }
  ) {}

  capabilities() {
    return { activity: true, holders: true, flows: true, liquidity: true, riskFlags: true };
  }

  fingerprint(): string {
    return `${computeProviderFingerprint({ tag: this.tag, version: this.version, capabilities: this.capabilities() })}:test`;
  }

  async getActivity() {
    this.calls.activity++;
    return {
      available: true,
      data: {
        txCount: { short: 10, baseline: 100, zScore: null },
        uniqueWallets: { short: null, baseline: null, zScore: null },
      },
      notes: [],
    };
  }

  async getHolders() {
    this.calls.holders++;
    return {
      available: true,
      data: {
        holders: { current: null },
        holdersDeltaPct: { short: null, baseline: null },
        concentrationTop10Pct: null,
        concentrationTop1Pct: null,
      },
      notes: [],
    };
  }

  async getFlows() {
    this.calls.flows++;
    return {
      available: true,
      data: {
        netInflowProxy: { short: 2, baseline: 1, zScore: null },
      },
      notes: ['best-effort proxy from tokenTransfers; not exchange-identified flows'],
    };
  }

  async getLiquidity() {
    this.calls.liquidity++;
    return {
      available: typeof this.cfg?.liquidityDeltaPct === 'number',
      data: typeof this.cfg?.liquidityDeltaPct === 'number' ? { liquidityDeltaPct: { short: this.cfg!.liquidityDeltaPct!, baseline: 0 } } : {},
      notes: ['proxy based on transfer-rate, not pool liquidity'],
    };
  }

  async getRiskFlags() {
    this.calls.riskFlags++;
    return {
      available: true,
      data: {
        mintAuthorityActive: { value: this.cfg?.riskFlags?.mintAuthorityActive ?? null, why: 'test' },
        freezeAuthorityActive: { value: this.cfg?.riskFlags?.freezeAuthorityActive ?? null, why: 'test' },
      },
      notes: [],
    };
  }
}

describe('chart orchestrator wiring (Chart → Setups → Onchain → Gates → Render)', () => {
  it('tier=free: no-op gating (confidence unchanged; no flows/liquidity calls)', async () => {
    const candles = mkTrendUpCandles();
    const provider = new MockProvider({ riskFlags: { mintAuthorityActive: true } });

    const chart = buildChartFeaturePackWithCacheMeta({ mint: 'So11111111111111111111111111111111111111112', timeframe: '1m', candles }).pack;
    const setupsBase = generateSetupCardsFromChart(chart, { tier: 'free', taskKind: 'chart_setups' });
    expect(setupsBase.length).toBeGreaterThan(0);

    const out = await analyzeChartWithOnchainGating({
      requestId: 'req-test',
      mint: 'So11111111111111111111111111111111111111112',
      timeframe: '1m',
      candles,
      tier: 'free',
      taskKind: 'chart_setups',
      onchainProvider: provider,
    });

    expect(provider.calls.flows).toBe(0);
    expect(provider.calls.liquidity).toBe(0);

    expect(out.json.plan.map(s => s.confidence)).toEqual(setupsBase.map(s => s.confidence));
  });

  it('tier=pro and hasSetups=true: gating modifies confidence + can hard-fail liquidity drop with chart-context trigger', async () => {
    const candles = mkTrendUpCandles();
    const provider = new MockProvider({
      riskFlags: { mintAuthorityActive: true },
      liquidityDeltaPct: -0.4,
    });

    const chart = buildChartFeaturePackWithCacheMeta({ mint: 'So11111111111111111111111111111111111111112', timeframe: '1m', candles }).pack;
    const setupsBase = generateSetupCardsFromChart(chart, { tier: 'pro', taskKind: 'chart_setups' });
    expect(setupsBase.length).toBeGreaterThan(0);

    const out = await analyzeChartWithOnchainGating({
      requestId: 'req-test',
      mint: 'So11111111111111111111111111111111111111112',
      timeframe: '1m',
      candles,
      tier: 'pro',
      taskKind: 'chart_setups',
      onchainProvider: provider,
      chartContext: { nearResistance: true },
    });

    expect(provider.calls.flows).toBe(1);
    expect(provider.calls.liquidity).toBe(1);
    expect(out.json.plan[0]!.confidence).toBeLessThan(setupsBase[0]!.confidence);
    expect(out.json.plan[0]!.onchainGate.pass).toBe(false);
    expect(out.json.plan[0]!.onchainGate.notes.join(' ')).toContain('proxy based on transfer-rate, not pool liquidity');
  });

  it('hasSetups=false: builder must not call enhanced blocks (flows/liquidity) even on pro tier', async () => {
    const candles = mkRangeCandles();
    const provider = new MockProvider({ liquidityDeltaPct: -0.4 });

    const out = await analyzeChartWithOnchainGating({
      requestId: 'req-test',
      mint: 'So11111111111111111111111111111111111111112',
      timeframe: '1m',
      candles,
      tier: 'pro',
      taskKind: 'chart_teaser_free', // generator returns []
      onchainProvider: provider,
    });

    expect(out.json.plan.length).toBe(0);
    expect(provider.calls.flows).toBe(0);
    expect(provider.calls.liquidity).toBe(0);
  });

  it('sorts gated setups by confidence desc (stable)', async () => {
    const a = { name: 'a', bias: 'long' as const, timeframe: '1m' as const, entry: { type: 'limit' as const, level: 1, rule: '' }, stop: { level: 0.9, rule: '', invalidation: '' }, targets: [], confidence: 0.5, evidence: [], onchainGate: { pass: true, notes: [] }, notes: [] };
    const b = { ...a, name: 'b', confidence: 0.8 };
    const c = { ...a, name: 'c', confidence: 0.8 }; // tie: should keep original order (b before c)

    const sorted = sortSetupsByGatedConfidence([a, b, c]);
    expect(sorted.map(s => s.name)).toEqual(['b', 'c', 'a']);
  });
});

