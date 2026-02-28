/**
 * Trading Quote API Contract Tests
 *
 * Compile-time type tests using `satisfies` and `@ts-expect-error`.
 * These tests fail at build time if the API contract drifts.
 *
 * Run: pnpm tsc --noEmit
 */

import type { ApiOk, ApiError } from '../../contracts/http/envelope';
import type { TerminalQuoteData } from '../../trading/types';
import { validSolBuyQuote } from '../fixtures/tradingQuote';

// =============================================================================
// POSITIVE CASES (Must Compile)
// =============================================================================

/**
 * Test: Valid quote response satisfies the contract
 */
const _validQuoteResponse: ApiOk<TerminalQuoteData> = validSolBuyQuote;

/**
 * Test: Minimal valid quote satisfies contract
 */
const _minimalValidQuote = {
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
    provider: {
      name: 'jupiter' as const,
      quoteResponse: {},
      feeMechanism: 'jupiter-platform-fee' as const,
    },
  },
} satisfies ApiOk<TerminalQuoteData>;

/**
 * Test: Quote with optional meta field
 */
const _quoteWithMeta = {
  status: 'ok',
  data: {
    expectedOut: {
      mint: 'So11111111111111111111111111111111111111112',
      decimals: 9,
      amountBaseUnits: '1000000000',
      amountUi: '1.0',
    },
    minOut: {
      mint: 'So11111111111111111111111111111111111111112',
      decimals: 9,
      amountBaseUnits: '995000000',
      amountUi: '0.995',
    },
    feeBps: 65,
    feeAmountEstimate: {
      mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      decimals: 6,
      amountBaseUnits: '65000',
      amountUi: '0.065',
    },
    meta: {
      priceImpactPct: 0.05,
      routeLabel: 'Jupiter V6 Direct',
    },
    provider: {
      name: 'jupiter' as const,
      quoteResponse: {},
      feeMechanism: 'jupiter-platform-fee' as const,
    },
  },
} satisfies ApiOk<TerminalQuoteData>;

// =============================================================================
// NEGATIVE CASES (Must Error - validated via @ts-expect-error)
// =============================================================================

/**
 * Test: Missing required field 'provider' should error
 * @ts-expect-error - provider is required
 */
const _missingProvider = {
  status: 'ok',
  data: {
    expectedOut: {
      mint: 'So11111111111111111111111111111111111111112',
      decimals: 9,
      amountBaseUnits: '1000000000',
      amountUi: '1.0',
    },
    minOut: {
      mint: 'So11111111111111111111111111111111111111112',
      decimals: 9,
      amountBaseUnits: '995000000',
      amountUi: '0.995',
    },
    feeBps: 65,
    feeAmountEstimate: {
      mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      decimals: 6,
      amountBaseUnits: '65000',
      amountUi: '0.065',
    },
  },
} satisfies ApiOk<TerminalQuoteData>;

/**
 * Test: Missing provider.feeMechanism should error
 * @ts-expect-error - provider.feeMechanism is required
 */
const _missingFeeMechanism = {
  status: 'ok',
  data: {
    expectedOut: {
      mint: 'So11111111111111111111111111111111111111112',
      decimals: 9,
      amountBaseUnits: '1000000000',
      amountUi: '1.0',
    },
    minOut: {
      mint: 'So11111111111111111111111111111111111111112',
      decimals: 9,
      amountBaseUnits: '995000000',
      amountUi: '0.995',
    },
    feeBps: 65,
    feeAmountEstimate: {
      mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      decimals: 6,
      amountBaseUnits: '65000',
      amountUi: '0.065',
    },
    provider: {
      name: 'jupiter' as const,
      quoteResponse: {},
    },
  },
} satisfies ApiOk<TerminalQuoteData>;

/**
 * Test: Wrong provider.name should error (not 'jupiter')
 * @ts-expect-error - provider.name must be 'jupiter'
 */
const _wrongProviderName = {
  status: 'ok',
  data: {
    expectedOut: {
      mint: 'So11111111111111111111111111111111111111112',
      decimals: 9,
      amountBaseUnits: '1000000000',
      amountUi: '1.0',
    },
    minOut: {
      mint: 'So11111111111111111111111111111111111111112',
      decimals: 9,
      amountBaseUnits: '995000000',
      amountUi: '0.995',
    },
    feeBps: 65,
    feeAmountEstimate: {
      mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      decimals: 6,
      amountBaseUnits: '65000',
      amountUi: '0.065',
    },
    provider: {
      name: 'uniswap' as const,
      quoteResponse: {},
      feeMechanism: 'jupiter-platform-fee' as const,
    },
  },
} satisfies ApiOk<TerminalQuoteData>;

/**
 * Test: Wrong feeBps type (string instead of number) should error
 * @ts-expect-error - feeBps must be number
 */
const _wrongFeeBpsType = {
  status: 'ok',
  data: {
    expectedOut: {
      mint: 'So11111111111111111111111111111111111111112',
      decimals: 9,
      amountBaseUnits: '1000000000',
      amountUi: '1.0',
    },
    minOut: {
      mint: 'So11111111111111111111111111111111111111112',
      decimals: 9,
      amountBaseUnits: '995000000',
      amountUi: '0.995',
    },
    feeBps: '65',
    feeAmountEstimate: {
      mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      decimals: 6,
      amountBaseUnits: '65000',
      amountUi: '0.065',
    },
    provider: {
      name: 'jupiter' as const,
      quoteResponse: {},
      feeMechanism: 'jupiter-platform-fee' as const,
    },
  },
} satisfies ApiOk<TerminalQuoteData>;

/**
 * Test: Missing required envelope status should error
 * @ts-expect-error - status: 'ok' is required
 */
const _missingEnvelopeStatus = {
  data: {
    expectedOut: {
      mint: 'So11111111111111111111111111111111111111112',
      decimals: 9,
      amountBaseUnits: '1000000000',
      amountUi: '1.0',
    },
    minOut: {
      mint: 'So11111111111111111111111111111111111111112',
      decimals: 9,
      amountBaseUnits: '995000000',
      amountUi: '0.995',
    },
    feeBps: 65,
    feeAmountEstimate: {
      mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      decimals: 6,
      amountBaseUnits: '65000',
      amountUi: '0.065',
    },
    provider: {
      name: 'jupiter' as const,
      quoteResponse: {},
      feeMechanism: 'jupiter-platform-fee' as const,
    },
  },
} satisfies ApiOk<TerminalQuoteData>;

// =============================================================================
// API ERROR CONTRACT TESTS
// =============================================================================

/**
 * Test: Valid error response satisfies ApiError
 */
const _validErrorResponse = {
  error: {
    code: 'QUOTE_FAILED',
    message: 'Failed to fetch quote from provider',
    details: {
      requestId: 'req-123-abc',
      provider: 'jupiter',
    },
  },
} satisfies ApiError;

/**
 * Test: Minimal error response (without details) satisfies ApiError
 */
const _minimalErrorResponse = {
  error: {
    code: 'INVALID_MINT',
    message: 'Invalid mint address provided',
  },
} satisfies ApiError;

/**
 * Test: Missing error.code should error
 * @ts-expect-error - error.code is required
 */
const _missingErrorCode = {
  error: {
    message: 'Something went wrong',
  },
} satisfies ApiError;

// =============================================================================
// TYPE GUARD TESTS (Runtime)
// =============================================================================

import { isApiOk, isApiError } from '../../contracts/http/envelope';

// Compile-time check that type guards work correctly
const _typeGuardTest: void = (() => {
  const result = validSolBuyQuote as ReturnType<typeof _mockApiCall>;

  if (isApiOk(result)) {
    // result.data is TerminalQuoteData here
    const _data: TerminalQuoteData = result.data;
  }

  if (isApiError(result)) {
    // result.error is defined here
    const _code: string = result.error.code;
  }
})();

// Helper type for the test above
type MockResult = ApiOk<TerminalQuoteData> | ApiError;
function _mockApiCall(): MockResult {
  return validSolBuyQuote;
}

// Export empty object to make this a module
export {};
