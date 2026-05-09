import crypto from 'crypto';
import { getRateLimitCounterStore } from './store.js';
import { emitRateLimitHitSignal } from '../../observability/securitySignals.js';

export interface RateLimitResult {
  allowed: boolean;
  reason?: string;
  remaining?: number;
  resetAt?: number;
}

const GLOBAL_IP_LIMIT = 60; // 60 req/min
const GLOBAL_USER_LIMIT = 120; // 120 req/min
const WINDOW_MS = 60000;

export async function checkRateLimit(ip?: string, userId?: string): Promise<RateLimitResult> {
  const store = getRateLimitCounterStore();

  // 1. Check IP Limit
  if (ip) {
    const ipHash = crypto.createHash('sha256').update(ip).digest('hex');
    const key = `rl:v2:global:ip:${ipHash}`;
    const { count, resetAt } = await store.incr(key, WINDOW_MS);
    if (count > GLOBAL_IP_LIMIT) {
      const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);
      emitRateLimitHitSignal({
        scope: 'global:ip',
        actorId: ip,
        count,
        limit: GLOBAL_IP_LIMIT,
        retryAfterSeconds: Math.max(1, retryAfter),
      });
      return { 
        allowed: false, 
        reason: 'Rate limit exceeded (IP)',
        resetAt,
      };
    }
  }

  // 2. Check User Limit
  if (userId) {
    const key = `rl:v2:global:user:${userId}`;
    const { count, resetAt } = await store.incr(key, WINDOW_MS);
    if (count > GLOBAL_USER_LIMIT) {
      const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);
      emitRateLimitHitSignal({
        scope: 'global:user',
        actorId: userId,
        count,
        limit: GLOBAL_USER_LIMIT,
        retryAfterSeconds: Math.max(1, retryAfter),
      });
      return { 
        allowed: false, 
        reason: 'Rate limit exceeded (User)',
        resetAt,
      };
    }
  }

  return { allowed: true };
}
