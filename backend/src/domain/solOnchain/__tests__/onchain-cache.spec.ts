import { describe, it, expect } from 'vitest';
import type { SolanaOnchainProvider } from '../provider.js';
import { computeProviderFingerprint } from '../provider.js';
import { buildOnchainFeaturePackWithCacheMeta, bucketAsOfTs } from '../buildOnchainFeaturePack.js';
import type { OnchainWindows } from '../types.js';

function fixedWindows(): OnchainWindows {
  // Only used by mock provider; builder passes real mapping.
  return { short: '5m', baseline: '1h' };
}

function makeMockProvider(opts?: { flipNotesOrder?: boolean }): SolanaOnchainProvider {
  let flip = false;
  const provider: SolanaOnchainProvider = {
    tag: 'mock',
    version: '1.0.0',
    capabilities() {
      return { activity: true, holders: true, flows: true, liquidity: true, riskFlags: true };
    },
    fingerprint() {
      return computeProviderFingerprint({ tag: this.tag, version: this.version, capabilities: this.capabilities() });
    },
    async getActivity() {
      const notes = opts?.flipNotesOrder ? (flip ? ['b', 'a'] : ['a', 'b']) : ['a', 'b'];
      flip = !flip;
      return {
        available: true,
        data: {
          txCount: { short: 10, baseline: 100, zScore: null },
          uniqueWallets: { short: 5, baseline: 50, zScore: null },
          transferCount: { short: null, baseline: null, zScore: null },
        },
        notes,
      };
    },
    async getHolders() {
      return {
        available: true,
        data: {
          holders: { current: 123 },
          holdersDeltaPct: { short: 0.1, baseline: 0.2 },
          concentrationTop10Pct: null,
          concentrationTop1Pct: null,
        },
      };
    },
    async getFlows() {
      return {
        available: true,
        data: {
          netInflowProxy: { short: 1, baseline: 2, zScore: null },
          largeTransfersProxy: { short: null, baseline: null, zScore: null },
          exchangeTaggedFlowProxy: { short: null, baseline: null, zScore: null },
        },
      };
    },
    async getLiquidity() {
      return {
        available: true,
        data: {
          liquidityUsd: { short: 1000, baseline: 2000, zScore: null },
          poolCount: { short: 1, baseline: 2, zScore: null },
          liquidityDeltaPct: { short: null, baseline: null },
        },
      };
    },
    async getRiskFlags() {
      return {
        available: true,
        data: {
          mintAuthorityActive: { value: null, why: 'unknown' },
          freezeAuthorityActive: { value: null, why: 'unknown' },
          suddenSupplyChange: { value: null, why: 'unknown' },
          largeHolderDominance: { value: null, why: 'unknown' },
          washLikeActivitySpike: { value: null, why: 'unknown' },
        },
      };
    },
  };

  // Sanity: ensure signature matches.
  void fixedWindows;
  return provider;
}

describe('solOnchain cache bucketing + determinism', () => {
  it('buckets micro TF to 30s boundaries', () => {
    expect(bucketAsOfTs('15s', 61_234)).toBe(60_000);
    expect(bucketAsOfTs('30s', 60_000)).toBe(60_000);
    expect(bucketAsOfTs('1m', 89_999)).toBe(60_000);
  });

  it('buckets intraday TF to 5m boundaries', () => {
    expect(bucketAsOfTs('5m', 901_000)).toBe(900_000);
    expect(bucketAsOfTs('15m', 900_000)).toBe(900_000);
    expect(bucketAsOfTs('30m', 1_199_999)).toBe(900_000);
  });

  it('buckets swing TF to 1h boundaries', () => {
    expect(bucketAsOfTs('1h', 3_601_000)).toBe(3_600_000);
    expect(bucketAsOfTs('4h', 7_200_000)).toBe(7_200_000);
  });

  it('produces deterministic cacheKey + featurePackHash for same inputs', async () => {
    const provider = makeMockProvider({ flipNotesOrder: true });
    const base = {
      mint: 'So11111111111111111111111111111111111111112',
      timeframe: '15s' as const,
      asOfTs: 61_234,
      provider,
      tier: 'pro' as const,
      hasSetups: true,
    };

    const r1 = await buildOnchainFeaturePackWithCacheMeta(base);
    const r2 = await buildOnchainFeaturePackWithCacheMeta(base);

    expect(r1.asOfBucket).toBe(60_000);
    expect(r1.cacheKey).toBe(r2.cacheKey);
    expect(r1.featurePackHash).toBe(r2.featurePackHash);
    expect(r1.pack).toEqual(r2.pack);

    // Cache key must include provider fingerprint and bucket.
    expect(r1.cacheKey).toContain(provider.fingerprint());
    expect(r1.cacheKey).toContain(':60000:');
  });
});

