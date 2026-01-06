/**
 * Application Error Classes
 * Consistent error schema across all routes per VERCEL_COMPATIBLE_BACKEND.md
 */

import type { VercelResponse } from '@vercel/node';
import { sendError } from './response';

// Standard error codes per API_SPEC.md
export const ErrorCodes = {
  // General
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  INVALID_JSON: 'INVALID_JSON',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  INVALID_QUERY: 'INVALID_QUERY',
  METHOD_NOT_ALLOWED: 'METHOD_NOT_ALLOWED',
  RATE_LIMITED: 'RATE_LIMITED',
  BUDGET_EXCEEDED: 'BUDGET_EXCEEDED',
  
  // Auth
  UNAUTHORIZED: 'UNAUTHORIZED',
  INVALID_AUTH_HEADER: 'INVALID_AUTH_HEADER',
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_TOKEN_CLAIMS: 'INVALID_TOKEN_CLAIMS',
  FORBIDDEN: 'FORBIDDEN',
  
  // Journal
  JOURNAL_NOT_FOUND: 'JOURNAL_NOT_FOUND',
  JOURNAL_INVALID_STATE: 'JOURNAL_INVALID_STATE',
  
  // Alerts
  ALERT_NOT_FOUND: 'ALERT_NOT_FOUND',
  ALERT_INVALID_STATE: 'ALERT_INVALID_STATE',
  
  // Oracle
  ORACLE_NOT_FOUND: 'ORACLE_NOT_FOUND',

  // Phase B: Webhook / Profile
  WEBHOOK_UNAUTHORIZED: 'WEBHOOK_UNAUTHORIZED',
  PROFILE_WALLET_IN_USE: 'PROFILE_WALLET_IN_USE',
  HELIUS_WEBHOOK_UPDATE_FAILED: 'HELIUS_WEBHOOK_UPDATE_FAILED',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

export class AppError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly details?: Record<string, string[]>;

  constructor(
    message: string,
    status: number,
    code: ErrorCode,
    details?: Record<string, string[]>
  ) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// Factory functions for common errors
export function notFound(message: string, code: ErrorCode = ErrorCodes.NOT_FOUND): AppError {
  return new AppError(message, 404, code);
}

export function badRequest(
  message: string,
  details?: Record<string, string[]>
): AppError {
  return new AppError(message, 400, ErrorCodes.VALIDATION_FAILED, details);
}

export function invalidJson(): AppError {
  return new AppError('Invalid JSON in request body', 400, ErrorCodes.INVALID_JSON);
}

export function invalidQuery(message: string): AppError {
  return new AppError(message, 400, ErrorCodes.INVALID_QUERY);
}

export function conflict(message: string, code: ErrorCode): AppError {
  return new AppError(message, 409, code);
}

export function methodNotAllowed(method: string): AppError {
  return new AppError(`Method ${method} not allowed`, 405, ErrorCodes.METHOD_NOT_ALLOWED);
}

export function rateLimited(message = 'Rate limit exceeded'): AppError {
  return new AppError(message, 429, ErrorCodes.RATE_LIMITED);
}

export function internalError(message = 'Internal server error'): AppError {
  return new AppError(message, 500, ErrorCodes.INTERNAL_ERROR);
}

export function unauthorized(message: string, code: ErrorCode = ErrorCodes.UNAUTHORIZED): AppError {
  return new AppError(message, 401, code);
}

export function forbidden(message: string): AppError {
  return new AppError(message, 403, ErrorCodes.FORBIDDEN);
}

export function handleError(res: VercelResponse, error: unknown): void {
  if (error instanceof AppError) {
    sendError(res, error.status, error.code, error.message, error.details);
    return;
  }

  // Log unexpected errors
  console.error('Unexpected error:', error);

  const message = error instanceof Error ? error.message : 'Unknown error';
  sendError(res, 500, ErrorCodes.INTERNAL_ERROR, message);
}
