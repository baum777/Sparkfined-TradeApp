import type { ServerResponse } from 'http';
import type { ParsedRequest } from '../http/router.js';
import { sendJson, setCacheHeaders } from '../http/response.js';
import { getConfig } from '../config/config.js';
import { getEnv } from '../config/env.js';
import { getDatabase } from '../db/index.js';
import { logger } from '../observability/logger.js';

/**
 * Health & Meta Routes
 * Per API_SPEC.md sections 0
 * Railway-compatible health checks
 */

export interface HealthResponse {
  ok: true;
  status: string;
  mode: string;
  now: string;
  version: string;
}

export interface HealthReadyResponse {
  status: 'ready' | 'not_ready';
  mode: string;
  checks: {
    database: 'ok' | 'error';
    redis?: 'ok' | 'error' | 'not_configured';
  };
  now: string;
}

export interface HealthUpstreamsResponse {
  status: 'ok' | 'degraded';
  mode: string;
  checks: {
    jupiter: 'ok' | 'error' | 'timeout';
    helius?: 'ok' | 'error' | 'timeout' | 'not_configured';
  };
  now: string;
}

export interface MetaResponse {
  apiBasePath: '/api';
  environment: 'development' | 'test' | 'production';
  mode: string;
  features: {
    watchlistSync: boolean;
    serviceWorkerJobs: boolean;
  };
}

/**
 * Basic health check - always returns 200
 * Used by load balancers for keep-alive
 */
export function handleHealth(_req: ParsedRequest, res: ServerResponse): void {
  const config = getConfig();
  const env = getEnv();

  setCacheHeaders(res, { noStore: true });

  const response: HealthResponse = {
    ok: true,
    status: 'ok',
    mode: env.SERVICE_MODE,
    now: new Date().toISOString(),
    version: config.version,
  };

  sendJson(res, response);
}

/**
 * Ready check - verifies DB and Redis connectivity
 * Used by Railway for deployment health verification
 * Should return 200 only when service can accept traffic
 */
export async function handleHealthReady(_req: ParsedRequest, res: ServerResponse): Promise<void> {
  const env = getEnv();
  const checks: HealthReadyResponse['checks'] = {
    database: 'error',
  };

  // Check database (max 2s timeout)
  try {
    const db = getDatabase();
    const stmt = db.prepare('SELECT 1');
    await Promise.race([
      stmt.get(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('DB timeout')), 2000)),
    ]);
    checks.database = 'ok';
  } catch (error) {
    logger.warn('Health ready check failed - database', { error: String(error) });
    checks.database = 'error';
  }

  // Check Redis/KV only when we have a real remote store (Vercel KV)
  // REDIS_URL alone uses in-memory fallback - no external dependency
  if (env.KV_REST_API_URL && env.KV_REST_API_TOKEN) {
    try {
      // Lazy import to avoid startup dependency
      const { pingKV } = await import('../lib/kv/store.js');
      const isHealthy = await Promise.race([
        pingKV(),
        new Promise<boolean>((_, reject) => setTimeout(() => reject(new Error('KV timeout')), 2000)),
      ]);
      checks.redis = isHealthy ? 'ok' : 'error';
    } catch (error) {
      logger.warn('Health ready check failed - kv store', { error: String(error) });
      checks.redis = 'error';
    }
  } else {
    checks.redis = 'not_configured';
  }

  const isReady = checks.database === 'ok';
  const response: HealthReadyResponse = {
    status: isReady ? 'ready' : 'not_ready',
    mode: env.SERVICE_MODE,
    checks,
    now: new Date().toISOString(),
  };

  setCacheHeaders(res, { noStore: true });
  sendJson(res, response, isReady ? 200 : 503);
}

/**
 * Upstreams check - verifies external dependencies
 * Returns 200 with status fields (not 503) to avoid cascading failures
 * Used for monitoring and alerting, not for traffic routing
 */
export async function handleHealthUpstreams(_req: ParsedRequest, res: ServerResponse): Promise<void> {
  const env = getEnv();
  const checks: HealthUpstreamsResponse['checks'] = {
    jupiter: 'error',
  };

  // Check Jupiter API (5s timeout)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${env.JUPITER_BASE_URL}/`, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timeout);

    checks.jupiter = response.ok ? 'ok' : 'error';
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      checks.jupiter = 'timeout';
    } else {
      checks.jupiter = 'error';
    }
  }

  // Check Helius if configured (5s timeout)
  if (env.HELIUS_API_KEY) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const heliusUrl = env.HELIUS_RPC_URL || `https://mainnet.helius-rpc.com/?api-key=${env.HELIUS_API_KEY}`;
      const response = await fetch(heliusUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getHealth',
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      checks.helius = response.ok ? 'ok' : 'error';
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        checks.helius = 'timeout';
      } else {
        checks.helius = 'error';
      }
    }
  } else {
    checks.helius = 'not_configured';
  }

  const isDegraded = checks.jupiter !== 'ok' || (checks.helius && checks.helius !== 'ok' && checks.helius !== 'not_configured');

  const response: HealthUpstreamsResponse = {
    status: isDegraded ? 'degraded' : 'ok',
    mode: env.SERVICE_MODE,
    checks,
    now: new Date().toISOString(),
  };

  setCacheHeaders(res, { noStore: true });
  // Always return 200 - this is for monitoring, not traffic routing
  sendJson(res, response, 200);
}

/**
 * Meta information about the API
 */
export function handleMeta(_req: ParsedRequest, res: ServerResponse): void {
  const config = getConfig();
  const env = getEnv();

  const response: MetaResponse = {
    apiBasePath: '/api',
    environment: config.env.NODE_ENV,
    mode: env.SERVICE_MODE,
    features: {
      watchlistSync: false, // BACKEND_TODO: Implement watchlist sync
      serviceWorkerJobs: true,
    },
  };

  sendJson(res, response);
}
