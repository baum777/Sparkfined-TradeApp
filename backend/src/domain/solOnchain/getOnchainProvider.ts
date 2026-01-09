import type { SolanaOnchainProvider } from './provider.js';
import { HeliusAdapter } from './adapters/helius.js';

/**
 * Factory: resolves the onchain provider implementation.
 *
 * Kept as a tiny seam so the chart orchestrator can remain provider-agnostic.
 */
export function getOnchainProvider(): SolanaOnchainProvider {
  // Currently canonical provider for SPL mints.
  // Adapter reads env internally (RPC URLs, API key, enhanced caps).
  return new HeliusAdapter();
}

