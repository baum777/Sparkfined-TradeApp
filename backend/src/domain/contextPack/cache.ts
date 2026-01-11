/**
 * ContextPack Cache Helpers (FROZEN SPEC)
 * Per BACKEND MAP section 1: cache.ts handles cache key generation and KV/SQLite helpers
 */

import { createHash } from 'crypto';
import { getKV } from '../../lib/kv/store.js';
import type { ContextPack, AnchorMode, ResolvedTier } from './types.js';

/**
 * Build cache key per FROZEN SPEC section 6
 * hash(
 *   userId + mint +
 *   anchor.mode + anchorTimeRoundedTo5Min +
 *   tier +
 *   (includeGrok? settings.ai.userQuantsHash + presetQuantsVersion : 'noNarrative') +
 *   (deltasEnabled? 'deltas' : 'noDeltas')
 * )
 */
export function buildContextCacheKey(
  userId: string,
  mint: string,
  anchorMode: AnchorMode,
  anchorTimeISO: string,
  tier: ResolvedTier,
  includeGrok: boolean,
  includeDeltas: boolean,
  settingsHash?: string
): string {
  // Round anchor time to 5 minutes
  const anchorTime = new Date(anchorTimeISO);
  const roundedMinutes = Math.floor(anchorTime.getMinutes() / 5) * 5;
  const roundedTime = new Date(anchorTime);
  roundedTime.setMinutes(roundedMinutes, 0, 0);
  const anchorTimeRoundedTo5Min = roundedTime.toISOString();
  
  // Build settings hash for narrative (if includeGrok)
  const narrativeHash = includeGrok ? (settingsHash || 'default') : 'noNarrative';
  
  const parts = [
    userId,
    mint,
    anchorMode,
    anchorTimeRoundedTo5Min,
    tier || 'free',
    narrativeHash,
    includeDeltas ? 'deltas' : 'noDeltas',
  ];
  
  const keyString = parts.join('|');
  const hash = createHash('sha256').update(keyString).digest('hex').substring(0, 16);
  
  return `contextpack:v1:${hash}`;
}

/**
 * Get ContextPack from cache
 */
export async function getCachedContextPack(cacheKey: string): Promise<ContextPack | null> {
  const kv = getKV();
  return await kv.get<ContextPack>(cacheKey);
}

/**
 * Set ContextPack in cache with TTL
 * Per FROZEN SPEC section 6:
 * - market snapshot: 2–5 min (now_centered), 24h (at-trade immutable)
 * - deltas: immutable per entry once computed
 * - narrative: 30–120 min
 */
export async function setCachedContextPack(
  cacheKey: string,
  contextPack: ContextPack,
  anchorMode: AnchorMode
): Promise<void> {
  const kv = getKV();
  const ttlSeconds = getCacheTTL(anchorMode);
  await kv.set(cacheKey, contextPack, ttlSeconds);
}

/**
 * Get cache TTL in seconds based on anchor mode
 */
function getCacheTTL(mode: AnchorMode): number {
  switch (mode) {
    case 'now_centered':
    case 'latest_only':
      return 300; // 5 minutes
    case 'trade_centered':
    case 'launch_centered':
      return 86400; // 24 hours (immutable)
    default:
      return 300;
  }
}

