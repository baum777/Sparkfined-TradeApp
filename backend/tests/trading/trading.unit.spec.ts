/**
 * Trading unit tests (no Jupiter network calls)
 * feeHelpers, validation logic
 */

import { describe, it, expect } from 'vitest';
import {
  parseUiAmountToBaseUnits,
  computeFeeAmountBaseUnits,
  formatBaseUnitsToUi,
  feeQuoteFromJupiter,
  type JupiterQuoteResponseLike,
} from '../../src/lib/trading/feeHelpers.js';

describe('feeHelpers', () => {
  describe('parseUiAmountToBaseUnits', () => {
    it('valid input: integer', () => {
      expect(parseUiAmountToBaseUnits('100', 6)).toBe(100_000_000n);
      expect(parseUiAmountToBaseUnits('0', 6)).toBe(0n);
      expect(parseUiAmountToBaseUnits('1', 0)).toBe(1n);
    });

    it('valid input: decimal', () => {
      expect(parseUiAmountToBaseUnits('0.5', 6)).toBe(500_000n);
      expect(parseUiAmountToBaseUnits('1.25', 2)).toBe(125n);
      expect(parseUiAmountToBaseUnits('0.01', 6)).toBe(10_000n);
    });

    it('invalid input returns 0n', () => {
      expect(parseUiAmountToBaseUnits('', 6)).toBe(0n);
      expect(parseUiAmountToBaseUnits('  ', 6)).toBe(0n);
      expect(parseUiAmountToBaseUnits('abc', 6)).toBe(0n);
      expect(parseUiAmountToBaseUnits('-1', 6)).toBe(0n);
      expect(parseUiAmountToBaseUnits('1.2.3', 6)).toBe(0n);
    });
  });

  describe('computeFeeAmountBaseUnits', () => {
    it('computes fee correctly', () => {
      expect(computeFeeAmountBaseUnits(10000n, 65)).toBe(65n);
      expect(computeFeeAmountBaseUnits(10000n, 100)).toBe(100n);
      expect(computeFeeAmountBaseUnits(1000000n, 50)).toBe(5000n);
    });

    it('returns 0n when feeBps <= 0 or amount <= 0', () => {
      expect(computeFeeAmountBaseUnits(1000n, 0)).toBe(0n);
      expect(computeFeeAmountBaseUnits(0n, 65)).toBe(0n);
      expect(computeFeeAmountBaseUnits(1000n, -1)).toBe(0n);
    });
  });

  describe('formatBaseUnitsToUi', () => {
    it('formats correctly', () => {
      expect(formatBaseUnitsToUi(1000000n, 6)).toBe('1');
      expect(formatBaseUnitsToUi(1500000n, 6)).toBe('1.5');
      expect(formatBaseUnitsToUi(1234567n, 6, 8)).toBe('1.234567');
    });
  });

  describe('feeQuoteFromJupiter', () => {
    it('returns expected shape from valid quote', () => {
      const quote: JupiterQuoteResponseLike = {
        outAmount: '1000000',
        otherAmountThreshold: '950000',
        priceImpactPct: 0.5,
        platformFee: { amount: '650', feeBps: 65 },
      };

      const result = feeQuoteFromJupiter({
        feeBps: 65,
        outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        outputSymbol: 'USDC',
        outputDecimals: 6,
        quote,
      });

      expect(result.expectedOut).toBeDefined();
      expect(result.expectedOut.amountBaseUnits).toBe('1000000');
      expect(result.minOut).toBeDefined();
      expect(result.minOut.amountBaseUnits).toBe('950000');
      expect(result.feeBps).toBe(65);
      expect(result.feeAmountEstimate).toBeDefined();
      expect(result.provider.name).toBe('jupiter');
      expect(result.provider.quoteResponse).toEqual(quote);
      expect(result.meta?.priceImpactPct).toBe(0.5);
    });
  });
});
