import { describe, it, expect } from 'vitest';
import { evaluateToken } from '@/features/discover/filter/engine';
import type { Token } from '@/features/discover/filter/types';

/**
 * Helper: Erstelle minimalen Token für Tests
 */
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
      liq_sol: 25,
      lp_locked_pct: null,
      lp_lock_days: null,
      lp_burned: null,
    },
    holders: {
      holder_count: 100,
      top1_pct: 5,
      top10_pct: 30,
      deployer_pct: 3,
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

describe('Filter Engine', () => {
  describe('Hard Reject Rules', () => {
    it('rejects when mint authority present', () => {
      const token = createTestToken({
        authorities: {
          mint_authority_revoked: false,
          freeze_authority_revoked: true,
        },
      });

      const decision = evaluateToken({ token, tab: 'not_bonded' });

      expect(decision.action).toBe('reject');
      expect(decision.reasons).toHaveLength(1);
      expect(decision.reasons[0].code).toBe('mint_authority_present');
    });

    it('rejects when freeze authority present', () => {
      const token = createTestToken({
        authorities: {
          mint_authority_revoked: true,
          freeze_authority_revoked: false,
        },
      });

      const decision = evaluateToken({ token, tab: 'not_bonded' });

      expect(decision.action).toBe('reject');
      expect(decision.reasons).toHaveLength(1);
      expect(decision.reasons[0].code).toBe('freeze_authority_present');
    });

    it('rejects when jupiter shield critical', () => {
      const token = createTestToken({
        safety: {
          jupiter_shield_level: 'critical',
        },
      });

      const decision = evaluateToken({ token, tab: 'not_bonded' });

      expect(decision.action).toBe('reject');
      expect(decision.reasons).toHaveLength(1);
      expect(decision.reasons[0].code).toBe('jupiter_shield_critical');
    });
  });

  describe('Not Bonded Tab', () => {
    it('rejects when liquidity too low', () => {
      const token = createTestToken({
        liquidity: {
          liq_usd: null,
          liq_sol: 15, // < 20
          lp_locked_pct: null,
          lp_lock_days: null,
          lp_burned: null,
        },
      });

      const decision = evaluateToken({ token, tab: 'not_bonded' });

      expect(decision.action).toBe('reject');
      expect(decision.reasons.some((r) => r.code === 'liquidity_insufficient')).toBe(true);
    });

    it('rejects when top1 concentration too high', () => {
      const token = createTestToken({
        holders: {
          holder_count: 100,
          top1_pct: 10, // > 8
          top10_pct: 30,
          deployer_pct: 3,
        },
      });

      const decision = evaluateToken({ token, tab: 'not_bonded' });

      expect(decision.action).toBe('reject');
      expect(decision.reasons.some((r) => r.code === 'top1_concentration_high')).toBe(true);
    });

    it('rejects when bundle score too high', () => {
      const token = createTestToken({
        manipulation: {
          bundle_score: 40, // > 35
          identical_buy_cluster_score: 20,
          same_funder_cluster_score: 20,
          wash_trade_score: 20,
        },
      });

      const decision = evaluateToken({ token, tab: 'not_bonded' });

      expect(decision.action).toBe('reject');
      expect(decision.reasons.some((r) => r.code === 'bundle_score_high')).toBe(true);
    });

    it('allows valid token', () => {
      const token = createTestToken();

      const decision = evaluateToken({ token, tab: 'not_bonded' });

      expect(decision.action).toBe('allow');
    });
  });

  describe('Bonded Tab', () => {
    it('rejects when liquidity too low', () => {
      const token = createTestToken({
        market: {
          age_minutes: 30,
          is_bonded: true,
          bonding_progress_pct: null,
        },
        liquidity: {
          liq_usd: null,
          liq_sol: 25, // < 30
          lp_locked_pct: null,
          lp_lock_days: null,
          lp_burned: null,
        },
      });

      const decision = evaluateToken({ token, tab: 'bonded' });

      expect(decision.action).toBe('reject');
      expect(decision.reasons.some((r) => r.code === 'liquidity_insufficient')).toBe(true);
    });

    it('downranks when LP data missing (reject_if_missing_data = false)', () => {
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
          lp_burned: null, // Missing
        },
      });

      const decision = evaluateToken({ token, tab: 'bonded' });

      // Sollte durch fallback downranked werden
      expect(decision.action).toBe('downrank');
    });

    it('allows when LP burned', () => {
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
          lp_burned: true,
        },
      });

      const decision = evaluateToken({ token, tab: 'bonded' });

      expect(decision.action).toBe('allow');
    });
  });

  describe('Ranked Tab', () => {
    it('enforces safety floors before scoring', () => {
      const token = createTestToken({
        authorities: {
          mint_authority_revoked: false, // Should reject
          freeze_authority_revoked: true,
        },
        oracle: {
          sentiment: 0.8,
          confidence: 0.7,
          trend_score: 80,
        },
      });

      const decision = evaluateToken({ token, tab: 'ranked' });

      expect(decision.action).toBe('reject');
      expect(decision.reasons.some((r) => r.code === 'mint_authority_present')).toBe(true);
      expect(decision.score).toBeUndefined();
    });

    it('calculates score for valid ranked token', () => {
      const token = createTestToken({
        liquidity: {
          liq_usd: null,
          liq_sol: 35, // >= 30 for ranked
          lp_locked_pct: null,
          lp_lock_days: null,
          lp_burned: null,
        },
        oracle: {
          sentiment: 0.8,
          confidence: 0.7,
          trend_score: 80,
        },
        social: {
          x_mentions_15m: 10,
          x_velocity_15m: 50,
          x_account_quality_score: 60,
        },
      });

      const decision = evaluateToken({ token, tab: 'ranked' });

      // Token sollte allow sein, aber kann durch Preset downranked werden
      // wenn Preset-Regeln greifen (z.B. wenn x_account_quality_score < 40)
      // Da Token x_account_quality_score: 60 hat, sollte es allow sein
      expect(['allow', 'downrank']).toContain(decision.action);
      if (decision.action === 'allow' || decision.action === 'downrank') {
        expect(decision.score).toBeDefined();
        expect(decision.score).toBeGreaterThan(0);
        expect(decision.score).toBeLessThanOrEqual(100);
      }
    });

    it('rejects when oracle confidence too low', () => {
      const token = createTestToken({
        liquidity: {
          liq_usd: null,
          liq_sol: 35, // >= 30 for ranked
          lp_locked_pct: null,
          lp_lock_days: null,
          lp_burned: null,
        },
        oracle: {
          sentiment: 0.5,
          confidence: 0.4, // < 0.55
          trend_score: 50,
        },
      });

      const decision = evaluateToken({ token, tab: 'ranked' });

      expect(decision.action).toBe('reject');
      expect(decision.reasons.some((r) => r.code === 'oracle_confidence_low')).toBe(true);
    });
  });

  describe('Preset Override', () => {
    it('applies preset rules when specified', () => {
      const token = createTestToken({
        manipulation: {
          bundle_score: 40, // > 35 (would reject in bundler_exclusion_gate)
          identical_buy_cluster_score: 20,
          same_funder_cluster_score: 20,
          wash_trade_score: 20,
        },
      });

      const decision = evaluateToken({
        token,
        tab: 'not_bonded',
        preset: 'bundler_exclusion_gate',
      });

      expect(decision.action).toBe('reject');
      expect(decision.reasons.some((r) => r.code === 'bundle_score_high')).toBe(true);
    });
  });

  describe('Reason Trimming', () => {
    it('trims reasons to max 2 chips for UI', () => {
      const token = createTestToken({
        authorities: {
          mint_authority_revoked: false,
          freeze_authority_revoked: false,
        },
        liquidity: {
          liq_usd: null,
          liq_sol: 15,
          lp_locked_pct: null,
          lp_lock_days: null,
          lp_burned: null,
        },
        holders: {
          holder_count: 100,
          top1_pct: 10,
          top10_pct: 40,
          deployer_pct: 3,
        },
      });

      const decision = evaluateToken({ token, tab: 'not_bonded' });

      // Sollte mehrere Reasons haben, aber nur max 2 für UI
      expect(decision.reasons.length).toBeLessThanOrEqual(2);
    });
  });
});

