import type { IncomingMessage, ServerResponse, IncomingHttpHeaders } from 'http';
import { parse as parseUrl } from 'url';
import { handleError, invalidJson, methodNotAllowed, notFound, ErrorCodes } from './error.js';
import { createRequestContext, setRequestIdHeader, clearRequestId } from './requestId.js';
import { logger } from '../observability/logger.js';
import { verifyToken, type AuthUser } from '../lib/auth/jwt.js';

/**
 * Simple HTTP Router
 * Supports path parameters and JSON body parsing
 */

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RouteParams {
  [key: string]: string;
}

export interface ParsedRequest {
  method: HttpMethod;
  path: string;
  params: RouteParams;
  query: Record<string, string | string[] | undefined>;
  body: unknown;
  headers: IncomingHttpHeaders;
  userId: string; // Extracted from auth or 'anon'
  user?: AuthUser;
}

export type RouteHandler = (
  req: ParsedRequest,
  res: ServerResponse
) => Promise<void> | void;

interface Route {
  method: HttpMethod;
  pattern: RegExp;
  paramNames: string[];
  handler: RouteHandler;
}

export class Router {
  private routes: Route[] = [];
  private basePath: string;

  constructor(basePath = '/api') {
    this.basePath = basePath;
  }

  private pathToRegex(path: string): { pattern: RegExp; paramNames: string[] } {
    const paramNames: string[] = [];
    
    const regexStr = path
      .replace(/\//g, '\\/')
      .replace(/:(\w+)/g, (_, name) => {
        paramNames.push(name);
        return '([^/]+)';
      });
    
    return {
      pattern: new RegExp(`^${this.basePath}${regexStr}$`),
      paramNames,
    };
  }

  private addRoute(method: HttpMethod, path: string, handler: RouteHandler): void {
    const { pattern, paramNames } = this.pathToRegex(path);
    this.routes.push({ method, pattern, paramNames, handler });
  }

  get(path: string, handler: RouteHandler): void {
    this.addRoute('GET', path, handler);
  }

  post(path: string, handler: RouteHandler): void {
    this.addRoute('POST', path, handler);
  }

  put(path: string, handler: RouteHandler): void {
    this.addRoute('PUT', path, handler);
  }

  patch(path: string, handler: RouteHandler): void {
    this.addRoute('PATCH', path, handler);
  }

  delete(path: string, handler: RouteHandler): void {
    this.addRoute('DELETE', path, handler);
  }

  private findRoute(method: string, path: string): { route: Route; params: RouteParams } | null {
    for (const route of this.routes) {
      if (route.method !== method) continue;
      
      const match = path.match(route.pattern);
      if (match) {
        const params: RouteParams = {};
        route.paramNames.forEach((name, i) => {
          params[name] = match[i + 1];
        });
        return { route, params };
      }
    }
    return null;
  }

  private async parseBody(req: IncomingMessage): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const contentType = req.headers['content-type'];
      
      // No body for GET/DELETE
      if (req.method === 'GET' || req.method === 'DELETE') {
        resolve(undefined);
        return;
      }

      // No content-type or no body
      if (!contentType || !contentType.includes('application/json')) {
        resolve(undefined);
        return;
      }

      const chunks: Buffer[] = [];
      
      req.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });
      
      req.on('end', () => {
        if (chunks.length === 0) {
          resolve(undefined);
          return;
        }
        
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString());
          resolve(body);
        } catch {
          reject(invalidJson());
        }
      });
      
      req.on('error', (err) => {
        reject(err);
      });
    });
  }

  private parseCookies(header?: string): Record<string, string> {
    if (!header) return {};
    const entries = header.split(';').map(part => part.trim());
    const out: Record<string, string> = {};
    for (const entry of entries) {
      const [key, ...rest] = entry.split('=');
      if (!key) continue;
      out[key] = decodeURIComponent(rest.join('='));
    }
    return out;
  }

  private extractAuth(req: IncomingMessage): { userId: string; user?: AuthUser } {
    const authHeader = req.headers['authorization'];
    
    // Expect "Bearer <token>"
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      
      if (token) {
        const user = verifyToken(token);
        if (user) {
          return { userId: user.userId, user };
        }
      }
    }

    const cookies = this.parseCookies(req.headers['cookie']);
    const cookieToken = cookies.access_token;
    if (cookieToken) {
      const user = verifyToken(cookieToken);
      if (user) {
        return { userId: user.userId, user };
      }
    }
    
    // Default to anonymous if no valid token found
    return { userId: 'anon' };
  }

  async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const ctx = createRequestContext(req);
    setRequestIdHeader(res, ctx.requestId);

    try {
      const parsed = parseUrl(req.url || '/', true);
      const path = parsed.pathname || '/';
      const method = req.method as HttpMethod;

      logger.debug('Incoming request', { method, path });

      // Find matching route
      const found = this.findRoute(method, path);
      
      if (!found) {
        // Check if path exists with different method
        const anyMethodMatch = this.routes.some(r => path.match(r.pattern));
        if (anyMethodMatch) {
          throw methodNotAllowed(method);
        }
        throw notFound(`Route not found: ${path}`, ErrorCodes.NOT_FOUND);
      }

      const body = await this.parseBody(req);
      const { userId, user } = this.extractAuth(req);

      const parsedReq: ParsedRequest = {
        method,
        path,
        params: found.params,
        query: parsed.query as Record<string, string | string[] | undefined>,
        body,
        headers: req.headers,
        userId,
        user,
      };

      await found.route.handler(parsedReq, res);

      const duration = Date.now() - ctx.startTime;
      logger.info('Request completed', { method, path, duration: `${duration}ms` });

    } catch (error) {
      handleError(res, error);
    } finally {
      clearRequestId();
    }
  }
}
