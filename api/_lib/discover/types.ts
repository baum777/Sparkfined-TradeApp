export interface DiscoverToken {
  mint: string;
  symbol: string;
  name: string;
  launchpad: 'pumpfun' | 'moonshot' | string;
  market: {
    age_minutes: number;
    is_bonded: boolean;
    bonding_progress_pct: number | null;
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
    bundle_score: number | null;
    identical_buy_cluster_score: number | null;
    same_funder_cluster_score: number | null;
    wash_trade_score: number | null;
  };
  safety: {
    jupiter_shield_level: 'none' | 'low' | 'medium' | 'high' | 'critical' | null;
  };
  social: {
    x_mentions_15m: number | null;
    x_velocity_15m: number | null;
    x_account_quality_score: number | null;
  };
  oracle: {
    sentiment: number | null;
    confidence: number | null;
    trend_score: number | null;
  };
}
