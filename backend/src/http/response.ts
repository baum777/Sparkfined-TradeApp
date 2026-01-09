import type { ServerResponse } from 'http';
import { getRequestId } from './requestId.js';

/**
 * Standardized API Response (FROZEN)
 * Success: { "status": "ok", "data": <T> }
 * Error:   { "status": "error", "error": { code, message, details? } }
 *
 * Always include `x-request-id` response header.
 */

export interface ApiOkResponse<T> {
  status: 'ok';
  data: T;
}

export function sendJson<T>(
  res: ServerResponse,
  data: T,
  status = 200
): void {
  const response: ApiOkResponse<T> = { status: 'ok', data };

  const body = JSON.stringify(response);
  
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'x-request-id': getRequestId(),
  });
  res.end(body);
}

export function sendNoContent(res: ServerResponse): void {
  // Canonical envelope even for "no content" semantics.
  // Note: HTTP 204 traditionally has an empty body; we keep status=204 but still return the envelope.
  sendJson(res, null, 204);
}

export function sendCreated<T>(res: ServerResponse, data: T): void {
  sendJson(res, data, 201);
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
