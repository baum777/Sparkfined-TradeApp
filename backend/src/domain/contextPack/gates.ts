/**
 * ContextPack Tier Gates (FROZEN SPEC)
 * SINGLE SOURCE OF TRUTH for feature inclusion decisions
 * Per BACKEND MAP section 3: gates.ts is the ONLY place that decides feature inclusion
 */

import type { ResolvedTier } from './types.js';
import type { UserSettings } from '../settings/types.js';

/**
 * Check if tier allows market snapshot
 * Per FROZEN SPEC section 2:
 * - free: none
 * - standard+: priceUsd, marketCapUsd, volume24hUsd, holdersCount
 */
export function canIncludeMarket(tier: ResolvedTier): boolean {
  if (!tier) return false;
  return tier === 'standard' || tier === 'pro' || tier === 'high';
}

/**
 * Check if tier allows delta snapshots
 * Per FROZEN SPEC section 2:
 * - pro/high only (fixed windows +15m/+1h/+4h)
 * - standard/free must not compute or persist deltas
 */
export function canIncludeDeltas(tier: ResolvedTier): boolean {
  if (!tier) return false;
  return tier === 'pro' || tier === 'high';
}

/**
 * Check if tier allows narrative snapshot
 * Per FROZEN SPEC section 2:
 * - pro/high only AND settings.ai.grokEnabled=true AND request.includeGrok=true
 * - otherwise: narrative must be absent and providers must not be called
 */
export function canIncludeNarrative(
  tier: ResolvedTier,
  settings: UserSettings,
  includeGrokFlag: boolean
): boolean {
  if (!tier) return false;
  if (tier !== 'pro' && tier !== 'high') return false;
  if (!includeGrokFlag) return false;
  if (settings.ai?.grokEnabled !== true) return false;
  return true;
}

/**
 * Check if tier allows indicators (RSI, trend state)
 * Per FROZEN SPEC section 2:
 * - pro+ only
 */
export function canIncludeIndicators(tier: ResolvedTier): boolean {
  if (!tier) return false;
  return tier === 'pro' || tier === 'high';
}

/**
 * Check if tier allows order pressure
 * Per FROZEN SPEC section 2:
 * - high only (if enabled in settings)
 */
export function canIncludeOrderPressure(tier: ResolvedTier): boolean {
  if (!tier) return false;
  return tier === 'high';
}

