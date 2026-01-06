/**
 * Rate Limiting Helpers
 * KV-backed rate limiting for API endpoints
 */

import { kv, kvKeys } from './kv';
import { rateLimited } from './errors';
import crypto from 'crypto';

export interface RateLimitConfig {
  limit: number;
  windowSeconds: number;
}

const DEFAULT_LIMITS: Record<string, RateLimitConfig> = {
  journal: { limit: 60, windowSeconds: 60 },
  alerts: { limit: 60, windowSeconds: 60 },
  oracle: { limit: 30, windowSeconds: 60 },
  ta: { limit: 10, windowSeconds: 60 },
  evaluate: { limit: 30, windowSeconds: 60 },
  reasoning: { limit: 10, windowSeconds: 60 },
};

function getBucket(windowSeconds: number): string {
  const now = Math.floor(Date.now() / 1000);
  const bucket = Math.floor(now / windowSeconds);
  return bucket.toString();
}

export async function checkRateLimit(
  resource: string,
  identifier: string,
  config?: RateLimitConfig
): Promise<void> {
  const cfg = config || DEFAULT_LIMITS[resource] || { limit: 60, windowSeconds: 60 };
  const bucket = getBucket(cfg.windowSeconds);
  const key = kvKeys.rateLimit(resource, identifier, bucket);
  
  // Note: kv.incr in api now takes (key, amount, ttl)
  const count = await kv.incr(key, 1, cfg.windowSeconds);
  
  if (count > cfg.limit) {
    throw rateLimited(`Rate limit exceeded for ${resource}. Try again later.`);
  }
}

export async function getRateLimitRemaining(
  resource: string,
  identifier: string,
  config?: RateLimitConfig
): Promise<number> {
  const cfg = config || DEFAULT_LIMITS[resource] || { limit: 60, windowSeconds: 60 };
  const bucket = getBucket(cfg.windowSeconds);
  const key = kvKeys.rateLimit(resource, identifier, bucket);
  
  const count = await kv.get<number>(key) || 0;
  return Math.max(0, cfg.limit - count);
}

// Global LLM Rate Limits
const GLOBAL_IP_LIMIT = 60; // 60 req/min
const GLOBAL_USER_LIMIT = 120; // 120 req/min
const WINDOW_MS = 60000;
const WINDOW_SEC = 60;

export interface RateLimitResult {
  allowed: boolean;
  reason?: string;
  remaining?: number;
  resetAt?: number;
}

export async function checkGlobalRateLimit(ip?: string, userId?: string): Promise<RateLimitResult> {
  const now = Date.now();
  const windowKey = Math.floor(now / WINDOW_MS);

  // 1. Check IP Limit
  if (ip) {
    const ipHash = crypto.createHash('sha256').update(ip).digest('hex');
    // kvKeys.rateLimit returns sf:v1:rl:{resource}:{id}:{bucket}
    // backend uses `rl:v1:ip:{ipHash}:{windowKey}`
    // Let's match backend exactly to share limits if they share KV
    const backendKey = `rl:v1:ip:${ipHash}:${windowKey}`; 
    // Note: api kv adds prefix sf:v1 automatically in keys? No, kvKeys adds it. 
    // Backend uses `rl:v1:...`. 
    // API `KV_PREFIX` is `sf:v1:`.
    // If backend and API share KV, they must share keys.
    // Backend: `rl:v1:ip:...`. API `kvKeys` uses `sf:v1:rl:...`.
    // There is a prefix mismatch.
    // Backend `backend/src/lib/rateLimit/limiter.ts` uses `rl:v1:ip:...` directly (no prefix logic seen in `backend/src/lib/kv/store.ts`? No, `store.ts` just passes key).
    // API `kvKeys` enforces `sf:v1:`.
    // I should probably fix backend to use `sf:v1:` or stick to `rl:v1:` for global limits.
    // If I use `rl:v1:` here, I bypass `kvKeys` (which is fine, `kv` helper takes any string).
    
    const count = await kv.incr(backendKey, 1, WINDOW_SEC);
    if (count > GLOBAL_IP_LIMIT) {
      return { 
        allowed: false, 
        reason: 'Rate limit exceeded (IP)',
        resetAt: (windowKey + 1) * WINDOW_MS
      };
    }
  }

  // 2. Check User Limit
  if (userId) {
    const backendKey = `rl:v1:user:${userId}:${windowKey}`;
    const count = await kv.incr(backendKey, 1, WINDOW_SEC);
    if (count > GLOBAL_USER_LIMIT) {
      return { 
        allowed: false, 
        reason: 'Rate limit exceeded (User)',
        resetAt: (windowKey + 1) * WINDOW_MS
      };
    }
  }

  return { allowed: true };
}
