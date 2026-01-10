/**
 * Tier Constants & Helpers
 * SOURCE OF TRUTH for tier feature matrix enforcement
 */

export type Tier = 'free' | 'standard' | 'pro' | 'high';

export type ResolvedTier = Tier | null;

/**
 * Tier comparison helpers
 * Returns true if tier1 >= tier2 in the hierarchy
 */
export function tierGte(tier1: ResolvedTier, tier2: Tier): boolean {
  if (!tier1) return false;
  
  const order: Record<Tier, number> = {
    free: 0,
    standard: 1,
    pro: 2,
    high: 3,
  };
  
  return order[tier1] >= order[tier2];
}

/**
 * Normalize tier string to ResolvedTier
 * Unknown/absent => null (safe: disallow enabling)
 */
export function normalizeTier(raw: string | null | undefined): ResolvedTier {
  if (!raw) return null;
  
  const t = String(raw).toLowerCase().trim();
  
  if (t === 'free') return 'free';
  if (t === 'standard') return 'standard';
  if (t === 'pro') return 'pro';
  if (t === 'high' || t === 'vip') return 'high';
  
  return null;
}

/**
 * Default tier when unknown
 */
export function defaultTier(): Tier {
  return 'free';
}

