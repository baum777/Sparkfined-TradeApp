import { describe, it, expect } from 'vitest';
import { applyFallbacks } from '@/features/discover/filter/fallbacks';
import type { Token, Decision } from '@/features/discover/filter/types';

function createTestToken(overrides: Partial<Token> = {}): Token {
  return {
    mint: 'test-mint',
    symbol: 'TEST',
    name: 'Test Token',
    launchpad: 'pumpfun',
    market: {
      age_minutes: 30,
      is_bonded: true,
      bonding_progress_pct: null,
    },
    authorities: {
      mint_authority_revoked: true,
      freeze_authority_revoked: true,
    },
    liquidity: {
      liq_usd: null,
      liq_sol: 35,
      lp_locked_pct: null,
      lp_lock_days: null,
      lp_burned: null,
    },
    holders: {
      holder_count: 200,
      top1_pct: 8,
      top10_pct: 30,
      deployer_pct: 5,
    },
    trading: {
      tx_per_min_5m: 5,
      buys_5m: 10,
      sells_5m: 5,
      volume_usd_5m: 1000,
      volume_usd_15m: 3000,
      volume_usd_60m: 10000,
      price_change_5m: 5,
      price_change_60m: 10,
    },
    manipulation: {
      bundle_score: 20,
      identical_buy_cluster_score: 20,
      same_funder_cluster_score: 20,
      wash_trade_score: 20,
    },
    safety: {
      jupiter_shield_level: null,
    },
    social: {
      x_mentions_15m: null,
      x_velocity_15m: null,
      x_account_quality_score: null,
    },
    oracle: {
      sentiment: 0.5,
      confidence: 0.6,
      trend_score: 50,
    },
    ...overrides,
  };
}

describe('Fallbacks', () => {
  describe('Missing LP Data', () => {
    it('downranks bonded token when LP data missing', () => {
      const token = createTestToken({
        market: {
          age_minutes: 30,
          is_bonded: true,
          bonding_progress_pct: null,
        },
        liquidity: {
          liq_usd: null,
          liq_sol: 35,
          lp_locked_pct: null, // Missing
          lp_lock_days: null, // Missing
          lp_burned: null, // Missing
        },
      });

      const decision: Decision = { action: 'allow', reasons: [] };
      const result = applyFallbacks(token, 'bonded', decision);

      expect(result.action).toBe('downrank');
      expect(result.reasons.some((r) => r.code === 'missing_lp_data')).toBe(true);
    });

    it('downranks ranked token when LP data missing', () => {
      const token = createTestToken({
        market: {
          age_minutes: 30,
          is_bonded: true,
          bonding_progress_pct: null,
        },
        liquidity: {
          liq_usd: null,
          liq_sol: 35,
          lp_locked_pct: null,
          lp_lock_days: null,
          lp_burned: null,
        },
      });

      const decision: Decision = { action: 'allow', reasons: [] };
      const result = applyFallbacks(token, 'ranked', decision);

      expect(result.action).toBe('downrank');
      expect(result.reasons.some((r) => r.code === 'missing_lp_data')).toBe(true);
    });
  });

  describe('Missing Social Data', () => {
    it('does not penalize ranked token when social data missing', () => {
      const token = createTestToken({
        market: {
          age_minutes: 30,
          is_bonded: false, // Not bonded, so LP data check doesn't apply
          bonding_progress_pct: null,
        },
        liquidity: {
          liq_usd: null,
          liq_sol: 35, // >= 30 for ranked
          lp_locked_pct: 85, // LP data present (so fallback doesn't trigger)
          lp_lock_days: 30,
          lp_burned: false,
        },
        social: {
          x_mentions_15m: null,
          x_velocity_15m: null,
          x_account_quality_score: null,
        },
      });

      const decision: Decision = { action: 'allow', reasons: [], score: 50 };
      const result = applyFallbacks(token, 'ranked', decision);

      // Fallback sollte nicht penalisieren wenn social data missing
      expect(result.action).toBe('allow');
      expect(result.reasons.length).toBeLessThanOrEqual(0);
      expect(result.score).toBe(50);
    });
  });

  describe('Missing Bundle Scores', () => {
    it('downranks not_bonded token when bundle scores missing and concentration high', () => {
      const token = createTestToken({
        market: {
          age_minutes: 30,
          is_bonded: false,
          bonding_progress_pct: null,
        },
        holders: {
          holder_count: 100,
          top1_pct: 10, // > 8 (high concentration)
          top10_pct: 30,
          deployer_pct: 3,
        },
        manipulation: {
          bundle_score: null, // Missing
          identical_buy_cluster_score: null, // Missing
          same_funder_cluster_score: null, // Missing
          wash_trade_score: 20,
        },
      });

      const decision: Decision = { action: 'allow', reasons: [] };
      const result = applyFallbacks(token, 'not_bonded', decision);

      expect(result.action).toBe('downrank');
      expect(result.reasons.some((r) => r.code === 'missing_bundle_scores_high_concentration')).toBe(true);
    });

    it('does not downrank when bundle scores missing but concentration low', () => {
      const token = createTestToken({
        market: {
          age_minutes: 30,
          is_bonded: false,
          bonding_progress_pct: null,
        },
        holders: {
          holder_count: 100,
          top1_pct: 5, // < 8 (low concentration)
          top10_pct: 30,
          deployer_pct: 3,
        },
        manipulation: {
          bundle_score: null,
          identical_buy_cluster_score: null,
          same_funder_cluster_score: null,
          wash_trade_score: 20,
        },
      });

      const decision: Decision = { action: 'allow', reasons: [] };
      const result = applyFallbacks(token, 'not_bonded', decision);

      expect(result.action).toBe('allow');
      expect(result.reasons).toHaveLength(0);
    });
  });
});

