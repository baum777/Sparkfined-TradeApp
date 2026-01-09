import type { AuthUser } from '../../lib/auth/jwt.js';
import type { ResolvedTier } from './settings.types.js';

/**
 * Resolve a normalized tier for feature gating.
 *
 * Assumptions (easy to change):
 * - JWT claim tiers are legacy: free|pro|vip
 * - vip maps to 'high'
 * - unknown/absent tier => null (safe: disallow enabling)
 */
export function resolveTierFromAuthUser(user?: AuthUser): ResolvedTier {
  const t = user?.tier;
  if (t === 'pro') return 'pro';
  if (t === 'vip') return 'high';
  if (t === 'free') return 'free';
  return null;
}

