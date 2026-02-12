/**
 * Standardized API Response Helpers
 * Matches API_SPEC.md response envelope contracts
 */

import type { VercelResponse } from '@vercel/node';
import { getRequestId } from './request-id';

/**
 * Success Response Envelope (canonical)
 * { status: "ok", data: T }
 */
export interface ApiResponse<T> {
  status: 'ok';
  data: T;
}

/**
 * Error Response Envelope
 * Canonical contract:
 *   { error: { code: string, message: string, details?: object } }
 */
export interface ErrorResponseBody {
  error: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
}

export function sendJson<T>(res: VercelResponse, data: T, status = 200): void {
  const response: ApiResponse<T> = {
    status: 'ok',
    data,
  };

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('x-request-id', getRequestId());
  res.status(status).json(response);
}

export function sendCreated<T>(res: VercelResponse, data: T): void {
  sendJson(res, data, 201);
}

export function sendNoContent(res: VercelResponse): void {
  // Canonical envelope even for "no content" semantics.
  sendJson(res, null, 204);
}

export function sendError(
  res: VercelResponse,
  status: number,
  code: string,
  message: string,
  details?: Record<string, string[]>
): void {
  const response: ErrorResponseBody = {
    error: {
      code,
      message,
      details,
    },
  };

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('x-request-id', getRequestId());
  res.status(status).json(response);
}

export interface CacheOptions {
  public?: boolean;
  maxAge?: number;
  noStore?: boolean;
}

export function setCacheHeaders(res: VercelResponse, options: CacheOptions): void {
  if (options.noStore) {
    res.setHeader('Cache-Control', 'no-store');
    return;
  }

  const directives: string[] = [];
  
  if (options.public) {
    directives.push('public');
  } else {
    directives.push('private');
  }
  
  if (options.maxAge !== undefined) {
    directives.push(`max-age=${options.maxAge}`);
  }

  res.setHeader('Cache-Control', directives.join(', '));
}
