import type { ServerResponse } from 'http';
import { AppError, ErrorCodes } from './error.js';
import { getRateLimitCounterStore, resetRateLimitCounterStoreForTesting } from '../lib/rateLimit/store.js';

interface RateLimitConfig {
  windowMs: number;
  max: number;
  scope: string;
}

export function createRateLimiter(config: RateLimitConfig) {
  return async function checkRateLimit(path: string, userId: string): Promise<void> {
    const store = getRateLimitCounterStore();
    const { count, resetAt } = await store.incr(`rl:v2:${config.scope}:${path}:${userId}`, config.windowMs);

    if (count > config.max) {
      const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);
      throw new AppError(
        `Rate limit exceeded. Try again in ${Math.max(1, retryAfter)} seconds.`,
        429,
        ErrorCodes.RATE_LIMITED
      );
    }
  };
}

export function setRateLimitHeaders(
  res: ServerResponse,
  limit: number,
  remaining: number,
  resetAt: number
): void {
  res.setHeader('X-RateLimit-Limit', limit.toString());
  res.setHeader('X-RateLimit-Remaining', Math.max(0, remaining).toString());
  res.setHeader('X-RateLimit-Reset', Math.ceil(resetAt / 1000).toString());
}

export const rateLimiters = {
  journal: createRateLimiter({ scope: 'journal', windowMs: 60000, max: 60 }),
  alerts: createRateLimiter({ scope: 'alerts', windowMs: 60000, max: 60 }),
  oracle: createRateLimiter({ scope: 'oracle', windowMs: 60000, max: 30 }),
  ta: createRateLimiter({ scope: 'ta', windowMs: 60000, max: 10 }),
  reasoning: createRateLimiter({ scope: 'reasoning', windowMs: 60000, max: 10 }),
  discover: createRateLimiter({ scope: 'discover', windowMs: 60000, max: 120 }),
};

export function resetRateLimitStore(): void {
  resetRateLimitCounterStoreForTesting();
}
