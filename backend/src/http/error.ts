import type { ServerResponse } from 'http';

/**
 * Standardized Error Response
 * Canonical contract:
 *   { error: { code: string, message: string, details?: object } }
 *
 * HTTP status code remains authoritative for semantics.
 */

export interface ErrorResponseBody {
  error: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
}

// Standard error codes
export const ErrorCodes = {
  // General
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  INVALID_JSON: 'INVALID_JSON',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  INVALID_QUERY: 'INVALID_QUERY',
  METHOD_NOT_ALLOWED: 'METHOD_NOT_ALLOWED',
  RATE_LIMITED: 'RATE_LIMITED',
  BUDGET_EXCEEDED: 'BUDGET_EXCEEDED',
  
  // Journal
  JOURNAL_NOT_FOUND: 'JOURNAL_NOT_FOUND',
  JOURNAL_INVALID_STATE: 'JOURNAL_INVALID_STATE',
  
  // Alerts
  ALERT_NOT_FOUND: 'ALERT_NOT_FOUND',
  ALERT_INVALID_STATE: 'ALERT_INVALID_STATE',
  
  // Oracle
  ORACLE_NOT_FOUND: 'ORACLE_NOT_FOUND',
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

  toResponse(): ErrorResponseBody {
    return {
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
      },
    };
  }
}

// Factory functions for common errors
export function notFound(message: string, code: ErrorCode = ErrorCodes.NOT_FOUND): AppError {
  return new AppError(message, 404, code);
}

export function unauthorized(message = 'Unauthorized'): AppError {
  return new AppError(message, 401, ErrorCodes.UNAUTHORIZED);
}

export function badRequest(
  message: string,
  details?: Record<string, string[]>
): AppError {
  return new AppError(message, 400, ErrorCodes.VALIDATION_FAILED, details);
}

export function badRequestCode(message: string, code: ErrorCode, details?: Record<string, string[]>): AppError {
  return new AppError(message, 400, code, details);
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

export function internalError(message = 'Internal server error'): AppError {
  return new AppError(message, 500, ErrorCodes.INTERNAL_ERROR);
}

export function sendError(res: ServerResponse, error: AppError): void {
  const body = JSON.stringify(error.toResponse());
  res.writeHead(error.status, {
    'Content-Type': 'application/json',
  });
  res.end(body);
}

export function handleError(res: ServerResponse, error: unknown): void {
  if (error instanceof AppError) {
    sendError(res, error);
    return;
  }

  // Log unexpected errors
  console.error('Unexpected error:', error);

  const appError = internalError(
    error instanceof Error ? error.message : 'Unknown error'
  );
  sendError(res, appError);
}
