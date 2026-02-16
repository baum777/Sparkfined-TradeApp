import { describe, it, expect } from 'vitest';
import { applyPreset } from '@/features/discover/filter/presets';
import type { Token, Decision } from '@/features/discover/filter/types';

function createTestToken(overrides: Partial<Token> = {}): Token {
  return {
    mint: 'test-mint',
    symbol: 'TEST',
    name: 'Test Token',
    launchpad: 'pumpfun',
    market: {
      age_minutes: 30,
      is_bonded: false,
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

describe('Presets', () => {
  describe('strict_safety_gate', () => {
    it('ensures strict preset thresholds override looser fixed values', () => {
      const token = createTestToken({
        liquidity: {
          liq_usd: null,
          liq_sol: 25, // < 30 (preset requirement)
          lp_locked_pct: null,
          lp_lock_days: null,
          lp_burned: null,
        },
      });

      const decision: Decision = { action: 'allow', reasons: [] };
      const result = applyPreset(token, 'bonded', 'strict_safety_gate', decision);

      expect(result.action).toBe('reject');
      expect(result.reasons.some((r) => r.code === 'preset_liquidity_insufficient')).toBe(true);
    });

    it('applies LP policy requirements', () => {
      const token = createTestToken({
        market: {
          age_minutes: 30,
          is_bonded: true,
          bonding_progress_pct: null,
        },
        liquidity: {
          liq_usd: null,
          liq_sol: 35,
          lp_locked_pct: 70, // < 80
          lp_lock_days: 30,
          lp_burned: false,
        },
      });

      const decision: Decision = { action: 'allow', reasons: [] };
      const result = applyPreset(token, 'bonded', 'strict_safety_gate', decision);

      expect(result.action).toBe('reject');
      expect(result.reasons.some((r) => r.code === 'preset_lp_policy_not_met')).toBe(true);
    });
  });

  describe('bundler_exclusion_gate', () => {
    it('rejects high bundle scores', () => {
      const token = createTestToken({
        manipulation: {
          bundle_score: 40, // > 35
          identical_buy_cluster_score: 20,
          same_funder_cluster_score: 20,
          wash_trade_score: 20,
        },
      });

      const decision: Decision = { action: 'allow', reasons: [] };
      const result = applyPreset(token, 'not_bonded', 'bundler_exclusion_gate', decision);

      expect(result.action).toBe('reject');
      expect(result.reasons.some((r) => r.code === 'bundle_score_high')).toBe(true);
    });
  });

  describe('organic_momentum', () => {
    it('rejects when tx_per_min too low', () => {
      const token = createTestToken({
        trading: {
          tx_per_min_5m: 2, // < 3
          buys_5m: 10,
          sells_5m: 5,
          volume_usd_5m: 1000,
          volume_usd_15m: 3000,
          volume_usd_60m: 10000,
          price_change_5m: 5,
          price_change_60m: 10,
        },
      });

      const decision: Decision = { action: 'allow', reasons: [] };
      const result = applyPreset(token, 'bonded', 'organic_momentum', decision);

      expect(result.action).toBe('reject');
      expect(result.reasons.some((r) => r.code === 'preset_tx_per_min_low')).toBe(true);
    });

    it('downranks one-sided flow (only buys)', () => {
      const token = createTestToken({
        trading: {
          tx_per_min_5m: 5,
          buys_5m: 35, // > 30
          sells_5m: 0, // = 0
          volume_usd_5m: 1000,
          volume_usd_15m: 3000,
          volume_usd_60m: 10000,
          price_change_5m: 5,
          price_change_60m: 10,
        },
      });

      const decision: Decision = { action: 'allow', reasons: [] };
      const result = applyPreset(token, 'bonded', 'organic_momentum', decision);

      expect(result.action).toBe('downrank');
      expect(result.reasons.some((r) => r.code === 'one_sided_flow')).toBe(true);
    });
  });

  describe('preset does not apply to wrong tab', () => {
    it('ignores preset if not applicable to tab', () => {
      const token = createTestToken();

      const decision: Decision = { action: 'allow', reasons: [] };
      const result = applyPreset(token, 'not_bonded', 'strict_safety_gate', decision);

      // strict_safety_gate applies only to bonded/ranked
      expect(result.action).toBe('allow');
      expect(result.reasons).toHaveLength(0);
    });
  });
});

