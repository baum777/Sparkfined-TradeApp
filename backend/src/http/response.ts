import type { ServerResponse } from 'http';
import { getRequestId } from './requestId.js';

/**
 * Standardized API Response
 * Matches API_SPEC.md ApiResponse contract
 */

export interface ApiResponse<T> {
  data: T;
  status: number;
  message?: string;
}

export function sendJson<T>(
  res: ServerResponse,
  data: T,
  status = 200,
  message?: string
): void {
  const response: ApiResponse<T> = {
    data,
    status,
    message,
  };

  const body = JSON.stringify(response);
  
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'x-request-id': getRequestId(),
  });
  res.end(body);
}

export function sendNoContent(res: ServerResponse): void {
  // Canonical envelope even for "no content" semantics.
  // Note: HTTP 204 traditionally has an empty body; we keep status=204 but still return the envelope
  // to avoid frontend/backend shape drift.
  sendJson(res, null, 204);
}

export function sendCreated<T>(res: ServerResponse, data: T, message?: string): void {
  sendJson(res, data, 201, message);
}

export interface CacheOptions {
  public?: boolean;
  maxAge?: number;
  noStore?: boolean;
}

export function setCacheHeaders(res: ServerResponse, options: CacheOptions): void {
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
