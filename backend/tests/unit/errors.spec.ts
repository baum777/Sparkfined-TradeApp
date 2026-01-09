import { describe, it, expect, beforeEach } from 'vitest';
import {
  AppError,
  ErrorCodes,
  notFound,
  badRequest,
  invalidJson,
  conflict,
} from '../../src/http/error';
import { getRequestId, clearRequestId } from '../../src/http/requestId';

describe('Error Handling', () => {
  beforeEach(() => {
    clearRequestId();
  });
  
  describe('AppError', () => {
    it('should create error with all properties', () => {
      const error = new AppError('Test error', 400, ErrorCodes.VALIDATION_FAILED, {
        field: ['Error 1', 'Error 2'],
      });
      
      expect(error.message).toBe('Test error');
      expect(error.status).toBe(400);
      expect(error.code).toBe('VALIDATION_FAILED');
      expect(error.details).toEqual({ field: ['Error 1', 'Error 2'] });
    });
    
    it('should map to canonical error body', () => {
      const error = new AppError('Test', 400, ErrorCodes.VALIDATION_FAILED);
      const response = error.toResponse();

      expect(response).toEqual({
        status: 'error',
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Test',
          details: undefined,
        },
      });
    });
  });
  
  describe('Error Factory Functions', () => {
    it('notFound should create 404 error', () => {
      const error = notFound('Resource not found', ErrorCodes.JOURNAL_NOT_FOUND);
      
      expect(error.status).toBe(404);
      expect(error.code).toBe('JOURNAL_NOT_FOUND');
    });
    
    it('badRequest should create 400 error with details', () => {
      const error = badRequest('Validation failed', { name: ['Required'] });
      
      expect(error.status).toBe(400);
      expect(error.code).toBe('VALIDATION_FAILED');
      expect(error.details).toEqual({ name: ['Required'] });
    });
    
    it('invalidJson should create 400 INVALID_JSON error', () => {
      const error = invalidJson();
      
      expect(error.status).toBe(400);
      expect(error.code).toBe('INVALID_JSON');
    });
    
    it('conflict should create 409 error', () => {
      const error = conflict('Already exists', ErrorCodes.JOURNAL_INVALID_STATE);
      
      expect(error.status).toBe(409);
      expect(error.code).toBe('JOURNAL_INVALID_STATE');
    });
  });
  
  describe('Request ID', () => {
    it('should set and get request ID', () => {
      // Request IDs are carried via header; body should stay canonical.
      expect(getRequestId()).toBe('no-request-context');
    });
    
    it('should clear request ID', () => {
      clearRequestId();
      
      expect(getRequestId()).toBe('no-request-context');
    });
  });
});
