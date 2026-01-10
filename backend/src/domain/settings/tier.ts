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
  const raw = (user as any)?.tier ?? null;
  if (!raw) return null;

  const t = String(raw).toLowerCase().trim();

  // Accept already-normalized tiers (prevents drift with newer JWT claims)
  if (t === 'high') return 'high';
  if (t === 'standard') return 'standard';

  // Legacy mapping
  if (t === 'pro') return 'pro';
  if (t === 'vip') return 'high';
  if (t === 'free') return 'free';

  return null;
}

