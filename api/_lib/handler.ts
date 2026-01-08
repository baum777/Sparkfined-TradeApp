/**
 * Vercel Serverless Function Handler Wrapper
 * Provides consistent request handling, error management, and CORS
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getRequestIdFromHeader, setCurrentRequestId, clearRequestId } from './request-id';
import { handleError, methodNotAllowed } from './errors';
import { logger } from './logger';
import { verifyJwtFromAuthHeader } from './auth/jwt';
import { maybeBlockInProduction } from './production-guard';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface HandlerContext {
  req: VercelRequest;
  res: VercelResponse;
  userId: string;
  requestId: string;
}

export type HandlerFunction = (ctx: HandlerContext) => Promise<void>;

export interface RouteConfig {
  /**
   * Auth policy for this endpoint.
   * - 'required': Valid JWT required (default)
   * - 'none': Public access (userId will be 'anon')
   */
  auth?: 'required' | 'none';
  
  GET?: HandlerFunction;
  POST?: HandlerFunction;
  PUT?: HandlerFunction;
  PATCH?: HandlerFunction;
  DELETE?: HandlerFunction;
}

function setCorsHeaders(res: VercelResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-request-id, Idempotency-Key');
}

/**
 * Create a Vercel serverless function handler with standard middleware
 */
export function createHandler(config: RouteConfig) {
  return async (req: VercelRequest, res: VercelResponse): Promise<void> => {
    const startTime = Date.now();
    const requestId = getRequestIdFromHeader(req);
    setCurrentRequestId(requestId);
    
    // Set CORS headers for all requests
    setCorsHeaders(res);
    
    // Handle preflight
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    
    if (maybeBlockInProduction(req, res)) {
      clearRequestId();
      return;
    }
    
    try {
      const method = req.method as HttpMethod;
      const handler = config[method];
      
      if (!handler) {
        throw methodNotAllowed(method);
      }
      
      // Auth logic
      const authPolicy = config.auth || 'required';
      let userId = 'anon';

      if (authPolicy === 'required') {
        const payload = verifyJwtFromAuthHeader(req.headers['authorization']);
        userId = payload.sub;
      } else {
        // auth: 'none'
        userId = 'anon';
      }
      
      const ctx: HandlerContext = {
        req,
        res,
        userId,
        requestId,
      };
      
      await handler(ctx);
      
      const duration = Date.now() - startTime;
      logger.info('Request completed', {
        method,
        path: req.url,
        duration: `${duration}ms`,
        userId,
      });
      
    } catch (error) {
      handleError(res, error);
    } finally {
      clearRequestId();
    }
  };
}

/**
 * Get query parameter as string
 */
export function getQueryParam(req: VercelRequest, name: string): string | undefined {
  const value = req.query[name];
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

/**
 * Get all query parameters as flat object
 */
export function getQueryParams(req: VercelRequest): Record<string, string | undefined> {
  const result: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(req.query)) {
    result[key] = Array.isArray(value) ? value[0] : value;
  }
  return result;
}

/**
 * Get path parameter
 */
export function getPathParam(req: VercelRequest, index: number): string | undefined {
  // Vercel passes path params as query params for catch-all routes
  // For specific routes, we need to parse from URL
  const url = req.url || '';
  const path = url.split('?')[0];
  const segments = path.split('/').filter(Boolean);
  return segments[index];
}

/**
 * Get Idempotency-Key header
 */
export function getIdempotencyKey(req: VercelRequest): string | undefined {
  const value = req.headers['idempotency-key'];
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}
