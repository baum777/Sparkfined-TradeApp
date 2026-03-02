import { apiClient } from '@/services/api/client';
import type { Token } from '@/features/discover/filter/types';

/** Use mock data when API fails or returns empty. Toggle for development. */
const USE_MOCK_WHEN_EMPTY = true;

/** Seeded random for consistent mock data */
function seededUnit(base: string, salt: number): number {
  let hash = 2166136261 ^ salt;
  for (let i = 0; i < base.length; i++) {
    hash ^= base.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

function seededBetween(base: string, salt: number, min: number, max: number): number {
  return min + seededUnit(base, salt) * (max - min);
}

function createMockMint(index: number): string {
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let value = '';
  for (let i = 0; i < 44; i++) {
    const unit = seededUnit(`mock-${index}`, i + 1);
    const charIndex = Math.floor(unit * alphabet.length) % alphabet.length;
    value += alphabet[charIndex];
  }
  return value;
}

const MOCK_SYMBOLS = [
  'PEPE', 'BONK', 'WIF', 'POPCAT', 'MEW', 'FARTCOIN', 'NEIRO', 'GIGA',
  'TOSHI', 'MOG', 'BRETT', 'DUKO', 'PNUT', 'ACT', 'MYRO', 'JUP',
  'RAY', 'ORCA', 'MNGO', 'STEP', 'COPE', 'FIDA', 'PORTAL', 'JTO',
  'PYTH', 'JTO', 'W', 'BOME', 'Slerf', 'SLERF', 'CAT', 'DOGS',
  'MOODENG', 'GOAT', 'DUCK', 'FROG', 'DOGE', 'SHIB', 'FLOKI',
];

function buildMockToken(index: number): Token {
  const seedKey = `mock-token-${index}`;
  const symbol = MOCK_SYMBOLS[index % MOCK_SYMBOLS.length];
  const liqSol = Math.round(seededBetween(seedKey, 1, 25, 800) * 100) / 100;
  const liqUsd = Math.round(liqSol * seededBetween(seedKey, 2, 95, 260) * 100) / 100;
  const isBonded = seededUnit(seedKey, 3) > 0.5;
  const lpBurned = seededUnit(seedKey, 4) > 0.6;
  const lpLockedPct = lpBurned ? null : (seededUnit(seedKey, 5) > 0.3 ? 85 : null);
  const lpLockDays = lpLockedPct ? Math.round(seededBetween(seedKey, 6, 30, 365)) : null;

  return {
    mint: createMockMint(index),
    symbol: `${symbol}${index > MOCK_SYMBOLS.length ? String(index).slice(-2) : ''}`,
    name: `${symbol} Token ${index + 1}`,
    launchpad: seededUnit(seedKey, 7) > 0.5 ? 'pumpfun' : 'moonshot',
    market: {
      age_minutes: Math.floor(seededBetween(seedKey, 8, 5, 6000)),
      is_bonded: isBonded,
      bonding_progress_pct: isBonded ? null : Math.round(seededBetween(seedKey, 9, 10, 95) * 100) / 100,
    },
    authorities: {
      mint_authority_revoked: seededUnit(seedKey, 10) > 0.15,
      freeze_authority_revoked: seededUnit(seedKey, 11) > 0.12,
    },
    liquidity: {
      liq_usd: liqUsd,
      liq_sol: liqSol,
      lp_locked_pct: lpLockedPct,
      lp_lock_days: lpLockDays,
      lp_burned: lpBurned,
    },
    holders: {
      holder_count: Math.floor(seededBetween(seedKey, 12, 80, 12000)),
      top1_pct: Math.round(seededBetween(seedKey, 13, 2, 7) * 100) / 100,
      top10_pct: Math.round(seededBetween(seedKey, 14, 15, 32) * 100) / 100,
      deployer_pct: Math.round(seededBetween(seedKey, 15, 1, 6) * 100) / 100,
    },
    trading: {
      tx_per_min_5m: Math.round(seededBetween(seedKey, 16, 2.5, 40) * 100) / 100,
      buys_5m: Math.floor(seededBetween(seedKey, 17, 5, 200)),
      sells_5m: Math.floor(seededBetween(seedKey, 18, 3, 180)),
      volume_usd_5m: Math.round(seededBetween(seedKey, 19, 500, 200000) * 100) / 100,
      volume_usd_15m: Math.round(seededBetween(seedKey, 20, 800, 400000) * 100) / 100,
      volume_usd_60m: Math.round(seededBetween(seedKey, 21, 1500, 800000) * 100) / 100,
      price_change_5m: Math.round(seededBetween(seedKey, 22, -25, 35) * 100) / 100,
      price_change_60m: Math.round(seededBetween(seedKey, 23, -50, 80) * 100) / 100,
    },
    manipulation: {
      bundle_score: seededUnit(seedKey, 24) > 0.2 ? Math.round(seededBetween(seedKey, 25, 5, 32) * 100) / 100 : null,
      identical_buy_cluster_score: seededUnit(seedKey, 26) > 0.25 ? Math.round(seededBetween(seedKey, 27, 3, 30) * 100) / 100 : null,
      same_funder_cluster_score: seededUnit(seedKey, 28) > 0.3 ? Math.round(seededBetween(seedKey, 29, 5, 35) * 100) / 100 : null,
      wash_trade_score: seededUnit(seedKey, 30) > 0.2 ? Math.round(seededBetween(seedKey, 31, 8, 38) * 100) / 100 : null,
    },
    safety: {
      jupiter_shield_level: seededUnit(seedKey, 32) > 0.95 ? 'critical' : seededUnit(seedKey, 33) > 0.75 ? 'high' : seededUnit(seedKey, 34) > 0.5 ? 'medium' : 'low',
    },
    social: {
      x_mentions_15m: seededUnit(seedKey, 35) > 0.4 ? Math.floor(seededBetween(seedKey, 36, 10, 2000)) : null,
      x_velocity_15m: seededUnit(seedKey, 37) > 0.5 ? Math.round(seededBetween(seedKey, 38, 5, 80) * 100) / 100 : null,
      x_account_quality_score: seededUnit(seedKey, 39) > 0.3 ? Math.round(seededBetween(seedKey, 40, 45, 95) * 100) / 100 : null,
    },
    oracle: {
      sentiment: seededUnit(seedKey, 41) > 0.25 ? Math.round(seededBetween(seedKey, 42, -0.5, 0.9) * 100) / 100 : null,
      confidence: seededUnit(seedKey, 43) > 0.2 ? Math.round(seededBetween(seedKey, 44, 0.55, 0.95) * 100) / 100 : null,
      trend_score: seededUnit(seedKey, 45) > 0.3 ? Math.round(seededBetween(seedKey, 46, 40, 95) * 100) / 100 : null,
    },
  };
}

function getMockTokens(): Token[] {
  const count = 80;
  return Array.from({ length: count }, (_, i) => buildMockToken(i));
}

/**
 * Discover Service
 * Fetches token data for Discover Overlay
 */
export const discoverService = {
  /**
   * Fetch tokens for Discover overlay
   * Returns normalized Token[] ready for filter engine
   * Falls back to mock data when API fails or returns empty (when USE_MOCK_WHEN_EMPTY)
   */
  async getTokens(): Promise<Token[]> {
    try {
      const response = await apiClient.get<Token[]>('/discover/tokens');
      const tokens = Array.isArray(response) ? response : [];
      if (USE_MOCK_WHEN_EMPTY && tokens.length === 0) {
        return getMockTokens();
      }
      return tokens;
    } catch (error) {
      console.warn('Discover tokens endpoint unavailable, using mock data', error);
      if (USE_MOCK_WHEN_EMPTY) {
        return getMockTokens();
      }
      return [];
    }
  },
};
