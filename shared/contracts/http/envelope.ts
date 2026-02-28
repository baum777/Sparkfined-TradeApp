/**
 * Canonical HTTP Envelope Types
 *
 * Source of Truth for API response envelopes.
 * See: shared/docs/API_CONTRACTS.md
 */

/**
 * Success envelope - canonical format for all /api/* responses
 */
export interface ApiOk<T> {
  status: 'ok';
  data: T;
}

/**
 * Error envelope - canonical format for error responses
 */
export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: {
      requestId: string;
      [key: string]: unknown;
    };
  };
}

/**
 * Union type for API responses (when status is unknown)
 */
export type ApiResult<T> = ApiOk<T> | ApiError;

/**
 * Type guard for success responses
 */
export function isApiOk<T>(result: ApiResult<T>): result is ApiOk<T> {
  return result.status === 'ok';
}

/**
 * Type guard for error responses
 */
export function isApiError<T>(result: ApiResult<T>): result is ApiError {
  return 'error' in result && !('status' in result);
}
