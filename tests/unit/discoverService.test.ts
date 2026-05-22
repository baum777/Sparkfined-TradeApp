import { afterEach, describe, expect, it, vi } from 'vitest';
import { discoverService } from '@/lib/discover/discoverService';
import { apiClient, ApiHttpError } from '@/services/api/client';
import type { Token } from '@/features/discover/filter/types';

function createToken(overrides: Partial<Token> = {}): Token {
  return {
    mint: 'So11111111111111111111111111111111111111112',
    symbol: 'SOL',
    name: 'Wrapped SOL',
    launchpad: 'pumpfun',
    market: {
      age_minutes: 120,
      is_bonded: true,
      bonding_progress_pct: null,
    },
    authorities: {
      mint_authority_revoked: true,
      freeze_authority_revoked: true,
    },
    liquidity: {
      liq_usd: 50000,
      liq_sol: 220,
      lp_locked_pct: 90,
      lp_lock_days: 60,
      lp_burned: false,
    },
    holders: {
      holder_count: 900,
      top1_pct: 4,
      top10_pct: 18,
      deployer_pct: 2,
    },
    trading: {
      tx_per_min_5m: 12,
      buys_5m: 42,
      sells_5m: 27,
      volume_usd_5m: 8500,
      volume_usd_15m: 24000,
      volume_usd_60m: 92000,
      price_change_5m: 3.2,
      price_change_60m: 11.4,
    },
    manipulation: {
      bundle_score: 15,
      identical_buy_cluster_score: 12,
      same_funder_cluster_score: 18,
      wash_trade_score: 9,
    },
    safety: {
      jupiter_shield_level: 'low',
    },
    social: {
      x_mentions_15m: 140,
      x_velocity_15m: 35,
      x_account_quality_score: 65,
    },
    oracle: {
      sentiment: 0.42,
      confidence: 0.71,
      trend_score: 72,
    },
    ...overrides,
  };
}

const apiGetSpy = vi.spyOn(apiClient, 'get');

describe('discoverService.getTokens', () => {
  afterEach(() => {
    apiGetSpy.mockReset();
  });

  it('returns provider-backed tokens on successful response', async () => {
    const expected = [createToken()];
    apiGetSpy.mockResolvedValue(expected);

    const result = await discoverService.getTokens();
    expect(result).toEqual(expected);
  });

  it('returns empty list only for successful empty array response', async () => {
    apiGetSpy.mockResolvedValue([]);

    const result = await discoverService.getTokens();
    expect(result).toEqual([]);
  });

  it('does not synthesize tokens when API request fails', async () => {
    apiGetSpy.mockRejectedValue(new Error('Network error'));

    await expect(discoverService.getTokens()).rejects.toThrow('Network error');
  });

  it('propagates PROVIDER_UNAVAILABLE as error', async () => {
    apiGetSpy.mockRejectedValue(
      new ApiHttpError('Discover provider unavailable', 503, { code: 'PROVIDER_UNAVAILABLE' })
    );

    await expect(discoverService.getTokens()).rejects.toMatchObject({
      status: 503,
      code: 'PROVIDER_UNAVAILABLE',
    });
  });

  it('fails on non-array success payload', async () => {
    apiGetSpy.mockResolvedValue({ invalid: true });

    await expect(discoverService.getTokens()).rejects.toThrow('Invalid discover token payload');
  });
});
