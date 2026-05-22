import { afterEach, describe, expect, it } from 'vitest';
import { getRateLimitCounterStore, resetRateLimitCounterStoreForTesting } from '../../src/lib/rateLimit/store.js';
import { resetEnvCache } from '../../src/config/env.js';

type Snapshot = Record<string, string | undefined>;

const KEYS = ['NODE_ENV', 'RATE_LIMIT_STORE', 'REDIS_URL'] as const;

function snapshotEnv(): Snapshot {
  const out: Snapshot = {};
  for (const key of KEYS) out[key] = process.env[key];
  return out;
}

function restoreEnv(snapshot: Snapshot): void {
  for (const key of KEYS) {
    const value = snapshot[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

afterEach(() => {
  resetRateLimitCounterStoreForTesting();
  resetEnvCache();
});

describe('RateLimitCounterStore', () => {
  it('uses memory store in development and increments per key', async () => {
    const envBefore = snapshotEnv();
    try {
      process.env.NODE_ENV = 'development';
      process.env.RATE_LIMIT_STORE = 'memory';
      delete process.env.REDIS_URL;
      resetRateLimitCounterStoreForTesting();
      resetEnvCache();

      const store = getRateLimitCounterStore();
      const first = await store.incr('unit:rate-limit', 60_000);
      const firstCount = first.count;
      const firstResetAt = first.resetAt;
      const second = await store.incr('unit:rate-limit', 60_000);

      expect(firstCount).toBe(1);
      expect(second.count).toBe(2);
      expect(second.resetAt).toBe(firstResetAt);
      expect(second.resetAt).toBeGreaterThan(Date.now());
    } finally {
      restoreEnv(envBefore);
    }
  });

  it('rejects in-memory store in production', () => {
    const envBefore = snapshotEnv();
    try {
      process.env.NODE_ENV = 'production';
      process.env.RATE_LIMIT_STORE = 'memory';
      process.env.REDIS_URL = 'redis://localhost:6379';
      resetRateLimitCounterStoreForTesting();
      resetEnvCache();

      expect(() => getRateLimitCounterStore()).toThrow(/in-memory rate limiting/i);
    } finally {
      restoreEnv(envBefore);
    }
  });

  it('requires REDIS_URL for redis store', () => {
    const envBefore = snapshotEnv();
    try {
      process.env.NODE_ENV = 'production';
      process.env.RATE_LIMIT_STORE = 'redis';
      delete process.env.REDIS_URL;
      resetRateLimitCounterStoreForTesting();
      resetEnvCache();

      expect(() => getRateLimitCounterStore()).toThrow(/REDIS_URL/);
    } finally {
      restoreEnv(envBefore);
    }
  });
});
