/**
 * Unit Tests: Validation Schemas
 * Per TEST_PLAN.md section 2.1
 */

import { describe, it, expect } from 'vitest';
import {
  journalCreateRequestSchema,
  createAlertRequestSchema,
  oracleReadStateRequestSchema,
  isValidTicker,
  isValidSolanaAddress,
  normalizeSymbolOrAddress,
} from '../../_lib/validation';

describe('Validation Schemas', () => {
  describe('journalCreateRequestSchema', () => {
    it('accepts valid input', () => {
      const result = journalCreateRequestSchema.safeParse({
        summary: 'Test entry',
      });
      expect(result.success).toBe(true);
    });

    it('rejects missing summary', () => {
      const result = journalCreateRequestSchema.safeParse({
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('summary');
      }
    });

    it('accepts optional timestamp', () => {
      const result = journalCreateRequestSchema.safeParse({
        summary: 'Test entry',
        timestamp: '2025-12-31T12:00:00.000Z',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('createAlertRequestSchema', () => {
    it('accepts valid SIMPLE alert', () => {
      const result = createAlertRequestSchema.safeParse({
        type: 'SIMPLE',
        symbolOrAddress: 'BTC',
        timeframe: '1h',
        condition: 'ABOVE',
        targetPrice: 100000,
      });
      expect(result.success).toBe(true);
    });

    it('rejects unknown type', () => {
      const result = createAlertRequestSchema.safeParse({
        type: 'UNKNOWN',
        symbolOrAddress: 'BTC',
        timeframe: '1h',
      });
      expect(result.success).toBe(false);
    });

    it('accepts valid TWO_STAGE_CONFIRMED alert', () => {
      const result = createAlertRequestSchema.safeParse({
        type: 'TWO_STAGE_CONFIRMED',
        symbolOrAddress: 'SOL',
        timeframe: '15m',
        template: 'TREND_MOMENTUM_STRUCTURE',
        expiryMinutes: 60,
        cooldownMinutes: 15,
      });
      expect(result.success).toBe(true);
    });

    it('accepts valid DEAD_TOKEN_AWAKENING_V2 alert', () => {
      const result = createAlertRequestSchema.safeParse({
        type: 'DEAD_TOKEN_AWAKENING_V2',
        symbolOrAddress: 'BONK',
        timeframe: '5m',
        params: {
          DEAD_VOL: 100,
          DEAD_TRADES: 5,
          DEAD_HOLDER_DELTA_6H: 0,
          AWAKE_VOL_MULT: 3,
          AWAKE_TRADES_MULT: 2,
          AWAKE_HOLDER_DELTA_30M: 5,
          STAGE2_WINDOW_MIN: 30,
          COOLDOWN_MIN: 15,
          STAGE3_WINDOW_H: 6,
          STAGE3_VOL_MULT: 2,
          STAGE3_TRADES_MULT: 1.5,
          STAGE3_HOLDER_DELTA: 10,
        },
      });
      expect(result.success).toBe(true);
    });
  });

  describe('oracleReadStateRequestSchema', () => {
    it('accepts valid input', () => {
      const result = oracleReadStateRequestSchema.safeParse({
        id: 'today-takeaway',
        isRead: true,
      });
      expect(result.success).toBe(true);
    });

    it('rejects empty id', () => {
      const result = oracleReadStateRequestSchema.safeParse({
        id: '',
        isRead: true,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('Input heuristics', () => {
    it('validates tickers correctly', () => {
      expect(isValidTicker('BTC')).toBe(true);
      expect(isValidTicker('SOL')).toBe(true);
      expect(isValidTicker('JUP')).toBe(true);
      expect(isValidTicker('WIF')).toBe(true);
      expect(isValidTicker('RAY')).toBe(true);
      expect(isValidTicker('ETH.USD')).toBe(true);
      expect(isValidTicker('BTC-PERP')).toBe(true);
      expect(isValidTicker('')).toBe(false);
      expect(isValidTicker('thisistoolongforaticker')).toBe(false);
    });

    it('validates Solana addresses correctly', () => {
      // Valid base58 addresses (32-44 chars)
      expect(isValidSolanaAddress('So11111111111111111111111111111112')).toBe(true);
      expect(isValidSolanaAddress('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')).toBe(true);
      // Too short
      expect(isValidSolanaAddress('short')).toBe(false);
      // Contains invalid chars
      expect(isValidSolanaAddress('O0I1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx')).toBe(false);
    });

    it('normalizes symbols correctly', () => {
      expect(normalizeSymbolOrAddress('btc')).toBe('BTC');
      expect(normalizeSymbolOrAddress('sol')).toBe('SOL');
      // Long addresses stay as-is
      expect(normalizeSymbolOrAddress('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'))
        .toBe('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
    });
  });
});
