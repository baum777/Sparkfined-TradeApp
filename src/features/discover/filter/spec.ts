import type { Tab, PresetId, Token } from './types';

/**
 * Sparkfined Filter Spec v1
 * Single Source of Truth für alle Filter-Regeln
 */
export const filterSpec = {
  tabs: {
    not_bonded: {
      fixed: {
        require_launchpad_filter: true,
        hard_reject: [
          {
            if: (token: Token) => token.authorities.freeze_authority_revoked === false,
            reason: { code: 'freeze_authority_present', message: 'Freeze Authority aktiv' },
          },
          {
            if: (token: Token) => token.authorities.mint_authority_revoked === false,
            reason: { code: 'mint_authority_present', message: 'Mint Authority aktiv' },
          },
          {
            if: (token: Token) => token.safety.jupiter_shield_level === 'critical',
            reason: { code: 'jupiter_shield_critical', message: 'Jupiter Shield: Critical' },
          },
        ],
        min_liquidity: {
          liq_sol_min: 20,
          liq_usd_min: null,
        },
        concentration_caps: {
          top1_pct_max: 8,
          top10_pct_max: 35,
          deployer_pct_max: 5,
        },
        organic_activity_floors: {
          tx_per_min_5m_min: 2,
          buys_sells_min_sells_5m: 2,
        },
        anti_bundler_defaults: {
          bundle_score_max: 35,
          identical_buy_cluster_score_max: 35,
          same_funder_cluster_score_max: 40,
          wash_trade_score_max: 40,
        },
        bonding_window: {
          newly_launched: {
            age_minutes_max: 60,
            bonding_progress_pct_range: [0, 60] as [number, number],
          },
          nearing_bonding: {
            age_minutes_max: 360,
            bonding_progress_pct_range: [70, 98] as [number, number],
          },
        },
      },
    },
    bonded: {
      fixed: {
        hard_reject: [
          {
            if: (token: Token) => token.authorities.freeze_authority_revoked === false,
            reason: { code: 'freeze_authority_present', message: 'Freeze Authority aktiv' },
          },
          {
            if: (token: Token) => token.authorities.mint_authority_revoked === false,
            reason: { code: 'mint_authority_present', message: 'Mint Authority aktiv' },
          },
          {
            if: (token: Token) => token.safety.jupiter_shield_level === 'critical',
            reason: { code: 'jupiter_shield_critical', message: 'Jupiter Shield: Critical' },
          },
        ],
        min_liquidity: {
          liq_sol_min: 30,
        },
        lp_policy: {
          require_lp_proof: true,
          accept_if: [
            (token: Token) => token.liquidity.lp_burned === true,
            (token: Token) =>
              (token.liquidity.lp_locked_pct ?? 0) >= 80 &&
              (token.liquidity.lp_lock_days ?? 0) >= 30,
          ],
          reject_if_missing_data: false, // if unknown, downrank instead
        },
        concentration_caps: {
          top1_pct_max: 10,
          top10_pct_max: 30,
          deployer_pct_max: 7,
        },
        anti_manipulation_defaults: {
          bundle_score_max: 40,
          wash_trade_score_max: 45,
        },
        bonded_columns: {
          hot_token: {
            bonded_age_minutes_max: 60,
          },
          trending_token: {
            bonded_age_minutes_max: 1440,
            require_trend_score: true,
          },
        },
      },
    },
    ranked: {
      fixed: {
        safety_floors: {
          mint_authority_revoked_required: true,
          freeze_authority_revoked_required: true,
          min_liquidity_liq_sol: 30,
          top10_pct_max: 30,
          top1_pct_max: 10,
          lp_required_if_bonded: true,
          jupiter_shield_critical_reject: true,
        },
        ranking_requirements: {
          oracle_confidence_min: 0.55,
          x_account_quality_min: 40,
        },
        downrank_rules: [
          {
            if: (token: Token) =>
              token.social.x_velocity_15m != null &&
              token.social.x_velocity_15m > 0 &&
              (token.social.x_account_quality_score ?? 0) < 40,
            reason: { code: 'low_quality_social', message: 'Social Signal: low-quality' },
          },
          {
            if: (token: Token) =>
              token.manipulation.bundle_score != null && token.manipulation.bundle_score > 35,
            reason: { code: 'bundle_risk', message: 'Bundler-Risiko erhöht' },
          },
        ],
        score_formula: {
          weights: {
            dex_trend: 0.4,
            volume_accel: 0.2,
            holder_growth: 0.2,
            oracle_sentiment: 0.15,
            social_velocity: 0.05,
          },
          caps: {
            oracle_sentiment_abs_max: 0.9,
            social_velocity_cap: 100,
          },
        },
      },
    },
  },
  presets: {
    strict_safety_gate: {
      apply_to: ['bonded', 'ranked'] as Tab[],
      hard_reject: [
        {
          if: (token: Token) => token.authorities.freeze_authority_revoked === false,
          reason: { code: 'freeze_authority_present', message: 'Freeze Authority aktiv' },
        },
        {
          if: (token: Token) => token.authorities.mint_authority_revoked === false,
          reason: { code: 'mint_authority_present', message: 'Mint Authority aktiv' },
        },
        {
          if: (token: Token) => token.safety.jupiter_shield_level === 'critical',
          reason: { code: 'jupiter_shield_critical', message: 'Jupiter Shield: Critical' },
        },
      ],
      requirements: {
        liq_sol_min: 30,
        top1_pct_max: 10,
        top10_pct_max: 30,
        lp_policy: {
          accept_if: [
            (token: Token) => token.liquidity.lp_burned === true,
            (token: Token) =>
              (token.liquidity.lp_locked_pct ?? 0) >= 80 &&
              (token.liquidity.lp_lock_days ?? 0) >= 30,
          ],
        },
      },
    },
    bundler_exclusion_gate: {
      apply_to: ['not_bonded'] as Tab[],
      hard_reject: [
        {
          if: (token: Token) =>
            token.manipulation.bundle_score != null && token.manipulation.bundle_score > 35,
          reason: { code: 'bundle_score_high', message: 'Bundler-Score zu hoch' },
        },
        {
          if: (token: Token) =>
            token.manipulation.identical_buy_cluster_score != null &&
            token.manipulation.identical_buy_cluster_score > 35,
          reason: { code: 'identical_buy_cluster_high', message: 'Identical Buy Cluster zu hoch' },
        },
        {
          if: (token: Token) =>
            token.manipulation.same_funder_cluster_score != null &&
            token.manipulation.same_funder_cluster_score > 40,
          reason: { code: 'same_funder_cluster_high', message: 'Same Funder Cluster zu hoch' },
        },
      ],
      requirements: {
        liq_sol_min: 20,
        top1_pct_max: 8,
        top10_pct_max: 35,
      },
    },
    organic_momentum: {
      apply_to: ['bonded', 'ranked'] as Tab[],
      requirements: {
        liq_sol_min: 25,
        tx_per_min_5m_min: 3,
        sells_5m_min: 3,
        holder_count_min: 150,
        top10_pct_max: 40,
      },
      downrank: [
        {
          if: (token: Token) => token.trading.buys_5m > 30 && token.trading.sells_5m === 0,
          reason: { code: 'one_sided_flow', message: 'Nur Buys – ungesund' },
        },
        {
          if: (token: Token) =>
            token.manipulation.wash_trade_score != null && token.manipulation.wash_trade_score > 45,
          reason: { code: 'wash_trade_risk', message: 'Wash-Trading Muster' },
        },
      ],
    },
    deployer_reputation_gate: {
      apply_to: ['not_bonded', 'bonded', 'ranked'] as Tab[],
      requirements: {
        deployer_pct_max: 7,
      },
      external_checks: {
        deployer_history: {
          required: true,
          reject_if: [
            // Stub: würde externe Datenquelle benötigen
            // (token: Token) => token.deployer_history?.prior_rugs_count >= 1,
            // (token: Token) => token.deployer_history?.prior_dead_launches_count >= 5,
          ],
          boost_if: [
            // Stub: würde externe Datenquelle benötigen
            // (token: Token) => token.deployer_history?.prior_successful_launches_count >= 2,
          ],
        },
      },
    },
    signal_fusion: {
      apply_to: ['ranked'] as Tab[],
      safety_floors: {
        mint_authority_revoked_required: true,
        freeze_authority_revoked_required: true,
        liq_sol_min: 30,
        top10_pct_max: 30,
        lp_required_if_bonded: true,
      },
      ranking: {
        oracle_confidence_min: 0.55,
        sentiment_confidence_boost: {
          if: (token: Token) => (token.oracle.confidence ?? 0) >= 0.75,
          multiplier: 1.1,
        },
        downrank: [
          {
            if: (token: Token) =>
              token.social.x_account_quality_score != null &&
              token.social.x_account_quality_score < 40,
            reason: { code: 'social_low_quality', message: 'X Signal low-quality' },
          },
          {
            if: (token: Token) =>
              token.manipulation.bundle_score != null && token.manipulation.bundle_score > 35,
            reason: { code: 'bundle_risk', message: 'Bundler-Risiko' },
          },
        ],
        score_formula: {
          weights: {
            dex_trend: 0.4,
            volume_accel: 0.2,
            holder_growth: 0.2,
            oracle_sentiment: 0.15,
            social_velocity: 0.05,
          },
          caps: {
            oracle_sentiment_abs_max: 0.9,
            social_velocity_cap: 100,
          },
        },
      },
    },
  },
  ui: {
    overlay_tabs: {
      not_bonded: {
        default_preset: 'bundler_exclusion_gate' as PresetId,
        user_selectable_presets: ['bundler_exclusion_gate', 'deployer_reputation_gate'] as PresetId[],
      },
      bonded: {
        default_preset: 'strict_safety_gate' as PresetId,
        user_selectable_presets: ['strict_safety_gate', 'organic_momentum'] as PresetId[],
      },
      ranked: {
        default_preset: 'signal_fusion' as PresetId,
        user_selectable_presets: ['signal_fusion', 'strict_safety_gate', 'organic_momentum'] as PresetId[],
      },
    },
    explainability: {
      show_reject_reason: true,
      show_downrank_reason: true,
      reason_chip_limit: 2,
    },
  },
  fallbacks: {
    if_missing_lp_data: {
      bonded: 'downrank',
      ranked: 'downrank',
    },
    if_missing_social_data: {
      ranked: 'do_not_penalize',
    },
    if_missing_bundle_scores: {
      not_bonded: 'downrank_if_concentration_high',
    },
  },
} as const;

