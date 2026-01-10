import { getKV } from '../kv/store.js';
import crypto from 'crypto';

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
  const now = Date.now();
  const windowKey = Math.floor(now / WINDOW_MS);
  const kv = getKV();

  // 1. Check IP Limit
  if (ip) {
    const ipHash = crypto.createHash('sha256').update(ip).digest('hex');
    const key = `rl:v1:ip:${ipHash}:${windowKey}`;
    const count = await kv.incr(key, 1, 60);
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
    const key = `rl:v1:user:${userId}:${windowKey}`;
    const count = await kv.incr(key, 1, 60);
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

