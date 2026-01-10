import { getEnv } from '../../config/env.js';
import { HeliusAdapter } from './adapters/helius.js';
import type { SolanaOnchainProvider } from './provider.js';

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : fallback;
  return Math.min(max, Math.max(min, n));
}

/**
 * Provider factory (DI boundary).
 *
 * - Centralizes env wiring.
 * - Allows swapping providers without touching orchestrators.
 */
export function getOnchainProvider(): SolanaOnchainProvider {
  const env = getEnv();

  // Determinism + cost caps for enhanced endpoints.
  const enhancedMaxPages = clampInt(env.HELIUS_ENHANCED_MAX_PAGES, 1, 20, 6);
  const enhancedLimit = clampInt(env.HELIUS_ENHANCED_LIMIT, 1, 500, 100);

  return new HeliusAdapter({ enhancedMaxPages, enhancedLimit });
}

