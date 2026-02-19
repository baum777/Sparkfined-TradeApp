/**
 * Symbol → Mint Address Resolver
 * 
 * Converts trading symbols (e.g., "SOL") to Solana mint addresses.
 * Used for Research → Terminal integration.
 * 
 * Priority:
 * 1. Well-known mints (SOL, USDC, USDT, mSOL, etc.)
 * 2. Future: Jupiter Token Registry lookup (if available)
 * 3. Else: null (no conversion possible)
 */

/**
 * Well-known mint addresses for common tokens.
 * Matches the logic from backend/src/domain/grokPulse/assetResolver.ts
 */
function getWellKnownMint(symbolUpper: string): string | null {
  switch (symbolUpper) {
    case 'SOL':
    case 'WSOL':
      return 'So11111111111111111111111111111111111111112';
    case 'USDC':
      return 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
    case 'USDT':
      return 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';
    case 'MSOL':
      return 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So';
    case 'BONK':
      return 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263';
    default:
      return null;
  }
}

/**
 * Resolves a trading symbol to a Solana mint address.
 * 
 * @param symbol - Trading symbol (e.g., "SOL", "USDC", "mSOL")
 * @returns Mint address if found, null otherwise
 * 
 * @example
 * resolveSymbolToMint("SOL") // "So11111111111111111111111111111111111111112"
 * resolveSymbolToMint("USDC") // "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
 * resolveSymbolToMint("UNKNOWN") // null
 */
export function resolveSymbolToMint(symbol: string): string | null {
  if (!symbol || typeof symbol !== 'string') {
    return null;
  }

  const normalized = symbol.trim().toUpperCase();
  if (!normalized) {
    return null;
  }

  // Priority 1: Well-known mints
  const wellKnown = getWellKnownMint(normalized);
  if (wellKnown) {
    return wellKnown;
  }

  // Priority 2: Future: Jupiter Token Registry lookup
  // (Not implemented in MVP - requires async lookup)

  // Priority 3: No conversion possible
  return null;
}

/**
 * Default quote mint (USDC) for pair construction.
 */
export const DEFAULT_QUOTE_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
export const DEFAULT_QUOTE_SYMBOL = 'USDC';

