import type { AuthUser } from '../../lib/auth/jwt.js';
import type { ResolvedTier } from '../../config/tiers.js';
import { normalizeTier, defaultTier } from '../../config/tiers.js';

/**
 * Resolve a normalized tier for feature gating.
 * Uses centralized tier normalization from config/tiers.ts
 * 
 * If tier is unknown/absent, returns null (safe: disallow enabling)
 * For anonymous users, returns defaultTier() ('free')
 */
export function resolveTierFromAuthUser(user?: AuthUser): ResolvedTier {
  if (!user) {
    return defaultTier();
  }
  
  const raw = (user as any)?.tier ?? null;
  return normalizeTier(raw);
}

