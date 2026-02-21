import type { ServerResponse } from 'http';
import { AppError, ErrorCodes } from './error.js';

/**
 * Simple in-memory rate limiter
 * For production, use Redis-backed rate limiting
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimitConfig {
  windowMs: number;
  max: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt <= now) {
      rateLimitStore.delete(key);
    }
  }
}, 60000); // Cleanup every minute

export function createRateLimiter(config: RateLimitConfig) {
  return function checkRateLimit(
    path: string,
    userId: string
  ): void {
    const key = `${path}:${userId}`;
    const now = Date.now();
    
    let entry = rateLimitStore.get(key);
    
    if (!entry || entry.resetAt <= now) {
      entry = {
        count: 1,
        resetAt: now + config.windowMs,
      };
      rateLimitStore.set(key, entry);
      return;
    }
    
    entry.count++;
    
    if (entry.count > config.max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      const error = new AppError(
        `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
        429,
        ErrorCodes.RATE_LIMITED
      );
      throw error;
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

// Predefined rate limiters per API_SPEC.md
export const rateLimiters = {
  journal: createRateLimiter({ windowMs: 60000, max: 60 }), // 60 req/min
  alerts: createRateLimiter({ windowMs: 60000, max: 60 }),
  oracle: createRateLimiter({ windowMs: 60000, max: 30 }), // 30 req/min
  ta: createRateLimiter({ windowMs: 60000, max: 10 }), // 10 req/min (expensive)
  reasoning: createRateLimiter({ windowMs: 60000, max: 10 }), // 10 req/min (expensive)
  discover: createRateLimiter({ windowMs: 60000, max: 120 }), // 120 req/min
};

export function resetRateLimitStore(): void {
  rateLimitStore.clear();
}
