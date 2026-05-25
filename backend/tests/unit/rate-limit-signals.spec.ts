import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRateLimiter, resetRateLimitStore } from '../../src/http/rateLimit.js';
import { resetEnvCache } from '../../src/config/env.js';
import { logger } from '../../src/observability/logger.js';

type EnvSnapshot = Record<string, string | undefined>;

const KEYS = ['NODE_ENV', 'RATE_LIMIT_STORE', 'REDIS_URL'] as const;

function snapshotEnv(): EnvSnapshot {
  const out: EnvSnapshot = {};
  for (const key of KEYS) out[key] = process.env[key];
  return out;
}

function restoreEnv(snapshot: EnvSnapshot): void {
  for (const key of KEYS) {
    const value = snapshot[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

afterEach(() => {
  vi.restoreAllMocks();
  resetRateLimitStore();
  resetEnvCache();
});

describe('Rate-limit security signals', () => {
  it('emits a security.signal event when route limiter is exceeded', async () => {
    const envBefore = snapshotEnv();
    try {
      process.env.NODE_ENV = 'development';
      process.env.RATE_LIMIT_STORE = 'memory';
      delete process.env.REDIS_URL;
      resetRateLimitStore();
      resetEnvCache();

      const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
      const limiter = createRateLimiter({ scope: 'unit', windowMs: 60_000, max: 1 });

      await limiter('/unit/rate-limit', 'user-42');
      await expect(limiter('/unit/rate-limit', 'user-42')).rejects.toMatchObject({
        status: 429,
        code: 'RATE_LIMITED',
      });

      expect(warnSpy).toHaveBeenCalled();
      const signalCall = warnSpy.mock.calls.find((call) => call[0] === 'security.signal');
      expect(signalCall).toBeTruthy();
      const payload = (signalCall?.[1] ?? {}) as Record<string, unknown>;
      expect(payload.signalType).toBe('rate_limit_hit');
      expect(payload.scope).toBe('route:unit');
      expect(payload.path).toBe('/unit/rate-limit');
      expect(payload.limit).toBe(1);
      expect(payload.count).toBe(2);
      expect(payload.actorHash).toBeDefined();
      expect(String(payload.actorHash)).not.toContain('user-42');
    } finally {
      restoreEnv(envBefore);
    }
  });
});
