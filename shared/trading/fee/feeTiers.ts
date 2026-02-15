import type { FeeTier, FeeTierId } from '../types';

/**
 * Sparkfined Fee Tiers (Phase 1)
 *
 * Basis Points (bps): 1 bps = 0.01%
 */
export const FEE_TIERS: Record<FeeTierId, FeeTier> = {
  free: { tier: 'free', feeBps: 65 },
  soft: { tier: 'soft', feeBps: 55 },
  hardI: { tier: 'hardI', feeBps: 40 },
  hardII: { tier: 'hardII', feeBps: 30 },
  genesis: { tier: 'genesis', feeBps: 20 },
} as const;

