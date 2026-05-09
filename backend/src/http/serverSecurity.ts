import type { IncomingMessage, ServerResponse } from 'http';
import type { AppConfig } from '../config/config.js';

const DEFAULT_DEV_ORIGINS = ['http://localhost:8080', 'http://127.0.0.1:8080'];

function parseAllowedOrigins(config: AppConfig): Set<string> {
  const configured = (config.env.BACKEND_CORS_ORIGINS || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);

  if (configured.length > 0) {
    return new Set(configured);
  }
  if (config.isDev) {
    return new Set(DEFAULT_DEV_ORIGINS);
  }
  return new Set();
}

function setCorsHeaders(req: IncomingMessage, res: ServerResponse, config: AppConfig): boolean {
  const originHeader = req.headers.origin;
  const origin = Array.isArray(originHeader) ? originHeader[0] : originHeader;
  const allowedOrigins = parseAllowedOrigins(config);

  if (origin && allowedOrigins.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  } else if (config.isDev && !origin) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, x-request-id, Idempotency-Key, x-csrf-token'
  );

  if (req.method === 'OPTIONS') {
    if (origin && !allowedOrigins.has(origin)) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { code: 'CORS_ORIGIN_DENIED', message: 'Origin not allowed' } }));
      return true;
    }
    res.writeHead(204);
    res.end();
    return true;
  }

  return false;
}

function setSecurityHeaders(res: ServerResponse, config: AppConfig): void {
  // Baseline hardening headers (raw Node HTTP, no Express middleware).
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; object-src 'none'; form-action 'self'"
  );

  if (config.isProd) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
}

export function applyServerSecurity(req: IncomingMessage, res: ServerResponse, config: AppConfig): boolean {
  setSecurityHeaders(res, config);
  return setCorsHeaders(req, res, config);
}
