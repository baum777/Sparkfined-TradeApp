/**
 * Trading Quote Stub Fixture
 *
 * Shared between:
 * - Playwright E2E tests (stubApi)
 * - Type contract tests (compile-time validation)
 *
 * This ensures E2E stubs and type contracts never drift.
 */

import type { ApiOk } from '../../contracts/http/envelope';
import type { TerminalQuoteData } from '../../trading/types';

/**
 * Valid mock quote response for SOL buy
 * Satisfies: ApiOk<TerminalQuoteData>
 */
export const validSolBuyQuote = {
  status: 'ok',
  data: {
    expectedOut: {
      mint: 'So11111111111111111111111111111111111111112',
      symbol: 'SOL',
      decimals: 9,
      amountBaseUnits: '1000000000',
      amountUi: '1.0',
    },
    minOut: {
      mint: 'So11111111111111111111111111111111111111112',
      symbol: 'SOL',
      decimals: 9,
      amountBaseUnits: '995000000',
      amountUi: '0.995',
    },
    feeBps: 65,
    feeAmountEstimate: {
      mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      symbol: 'USDC',
      decimals: 6,
      amountBaseUnits: '65000',
      amountUi: '0.065',
    },
    meta: {
      priceImpactPct: 0.1,
      routeLabel: 'Jupiter V6',
    },
    provider: {
      name: 'jupiter' as const,
      quoteResponse: { mocked: true, outAmount: '1000000000' },
      feeMechanism: 'jupiter-platform-fee' as const,
    },
  },
} satisfies ApiOk<TerminalQuoteData>;

/**
 * Valid mock swap response
 */
export const validSwapResponse = {
  status: 'ok',
  data: {
    swapTransaction: 'base64encodedtx123456789',
    lastValidBlockHeight: 123456789,
  },
};

/**
 * Valid discover tokens response
 */
export const validDiscoverTokensResponse = {
  status: 'ok',
  data: [
    { mint: 'So11111111111111111111111111111111111111112', symbol: 'SOL', name: 'Wrapped SOL' },
    { mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', symbol: 'USDC', name: 'USD Coin' },
    { mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', symbol: 'USDT', name: 'Tether USD' },
  ],
};
