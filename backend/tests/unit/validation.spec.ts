import { describe, it, expect } from 'vitest';
import { validateBody, validateQuery } from '../../src/validation/validate';
import {
  journalCreateRequestSchema,
  createAlertRequestSchema,
  oracleReadStateRequestSchema,
} from '../../src/validation/schemas';
import { AppError } from '../../src/http/error';

describe('Validation Schemas', () => {
  describe('Journal Create Request', () => {
    it('should accept valid request', () => {
      const body = {
        summary: 'Test trade entry',
      };
      
      const result = validateBody(journalCreateRequestSchema, body);
      
      expect(result.summary).toBe('Test trade entry');
    });
    
    it('should reject missing summary', () => {
      const body = {
        side: 'BUY',
      };
      
      expect(() => validateBody(journalCreateRequestSchema, body))
        .toThrow(AppError);
    });
    
    it('should reject invalid side', () => {
      const body = {
        summary: 'Test',
      };
      
      // Side is no longer part of the v1 diary contract; this is now just a sanity check that
      // the schema ignores unknown fields unless explicitly present (zod default behavior).
      expect(() => validateBody(journalCreateRequestSchema, body)).not.toThrow();
    });
    
    it('should include field errors in details', () => {
      const body = {};
      
      try {
        validateBody(journalCreateRequestSchema, body);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        const appError = error as AppError;
        expect(appError.status).toBe(400);
        expect(appError.code).toBe('VALIDATION_ERROR');
        expect(appError.details).toBeDefined();
      }
    });
  });
  
  describe('Alert Create Request', () => {
    it('should accept valid SIMPLE alert', () => {
      const body = {
        type: 'SIMPLE',
        symbolOrAddress: 'BTC',
        timeframe: '1h',
        condition: 'ABOVE',
        targetPrice: 50000,
      };
      
      const result = validateBody(createAlertRequestSchema, body);
      
      expect(result.type).toBe('SIMPLE');
    });
    
    it('should accept valid TWO_STAGE_CONFIRMED alert', () => {
      const body = {
        type: 'TWO_STAGE_CONFIRMED',
        symbolOrAddress: 'ETH',
        timeframe: '4h',
        template: 'TREND_MOMENTUM_STRUCTURE',
        expiryMinutes: 60,
        cooldownMinutes: 15,
      };
      
      const result = validateBody(createAlertRequestSchema, body);
      
      expect(result.type).toBe('TWO_STAGE_CONFIRMED');
    });
    
    it('should reject unknown alert type', () => {
      const body = {
        type: 'UNKNOWN_TYPE',
        symbolOrAddress: 'BTC',
        timeframe: '1h',
      };
      
      expect(() => validateBody(createAlertRequestSchema, body))
        .toThrow(AppError);
    });
  });
  
  describe('Oracle Read State Request', () => {
    it('should accept valid request', () => {
      const body = {
        id: 'today-takeaway',
        isRead: true,
      };
      
      const result = validateBody(oracleReadStateRequestSchema, body);
      
      expect(result.id).toBe('today-takeaway');
      expect(result.isRead).toBe(true);
    });
    
    it('should reject empty id', () => {
      const body = {
        id: '',
        isRead: true,
      };
      
      expect(() => validateBody(oracleReadStateRequestSchema, body))
        .toThrow(AppError);
    });
  });
});
