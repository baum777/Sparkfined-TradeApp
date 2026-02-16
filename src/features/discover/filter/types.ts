/**
 * Normalized Token Data Model
 * Alle Felder können null sein (Missing Data)
 */
export interface Token {
  mint: string;
  symbol: string;
  name: string;
  launchpad: 'pumpfun' | 'moonshot' | string;
  market: {
    age_minutes: number;
    is_bonded: boolean;
    bonding_progress_pct: number | null; // 0..100 (if not bonded)
  };
  authorities: {
    mint_authority_revoked: boolean;
    freeze_authority_revoked: boolean;
  };
  liquidity: {
    liq_usd: number | null;
    liq_sol: number | null;
    lp_locked_pct: number | null;
    lp_lock_days: number | null;
    lp_burned: boolean | null;
  };
  holders: {
    holder_count: number;
    top1_pct: number;
    top10_pct: number;
    deployer_pct: number | null;
  };
  trading: {
    tx_per_min_5m: number;
    buys_5m: number;
    sells_5m: number;
    volume_usd_5m: number;
    volume_usd_15m: number;
    volume_usd_60m: number;
    price_change_5m: number;
    price_change_60m: number;
  };
  manipulation: {
    bundle_score: number | null; // 0..100 (higher = worse)
    identical_buy_cluster_score: number | null; // 0..100
    same_funder_cluster_score: number | null; // 0..100
    wash_trade_score: number | null; // 0..100
  };
  safety: {
    jupiter_shield_level: 'none' | 'low' | 'medium' | 'high' | 'critical' | null;
  };
  social: {
    x_mentions_15m: number | null;
    x_velocity_15m: number | null;
    x_account_quality_score: number | null; // 0..100
  };
  oracle: {
    sentiment: number | null; // -1..+1
    confidence: number | null; // 0..1
    trend_score: number | null; // 0..100
  };
}

/**
 * Filter Actions
 */
export type FilterAction = 'allow' | 'downrank' | 'reject';

/**
 * Reason for action
 */
export interface Reason {
  code: string;
  message: string;
}

/**
 * Filter Decision
 */
export interface Decision {
  action: FilterAction;
  reasons: Reason[];
  score?: number; // 0..100 (only for ranked tab)
}

/**
 * Tab Types
 */
export type Tab = 'not_bonded' | 'bonded' | 'ranked';

/**
 * Preset IDs
 */
export type PresetId =
  | 'strict_safety_gate'
  | 'bundler_exclusion_gate'
  | 'organic_momentum'
  | 'deployer_reputation_gate'
  | 'signal_fusion';

/**
 * Evaluation Input
 */
export interface EvaluateTokenInput {
  token: Token;
  tab: Tab;
  preset?: PresetId; // optional override
  now?: Date;
}

