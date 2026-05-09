import { afterEach, describe, expect, it, vi } from 'vitest';
import { logger } from '../../src/observability/logger.js';
import { resetConfigCache } from '../../src/config/config.js';
import { resetEnvCache } from '../../src/config/env.js';

type EnvSnapshot = Record<string, string | undefined>;

function snapshotEnv(keys: string[]): EnvSnapshot {
  const out: EnvSnapshot = {};
  for (const key of keys) out[key] = process.env[key];
  return out;
}

function restoreEnv(snapshot: EnvSnapshot): void {
  for (const [key, value] of Object.entries(snapshot)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

afterEach(() => {
  vi.restoreAllMocks();
  resetConfigCache();
  resetEnvCache();
});

describe('structured logger redaction', () => {
  it('emits JSON and redacts sensitive fields recursively', () => {
    const keys = ['LOG_LEVEL'];
    const envBefore = snapshotEnv(keys);
    try {
      process.env.LOG_LEVEL = 'debug';
      resetConfigCache();
      resetEnvCache();

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      logger.error('Auth failure', {
        authorization: 'Bearer sk-THIS_SHOULD_NOT_LEAK',
        accessToken: 'abc',
        nested: {
          cookie: 'session=1234',
          safe: 'ok',
        },
      });

      expect(errorSpy).toHaveBeenCalledTimes(1);
      const raw = String(errorSpy.mock.calls[0]?.[0] ?? '');
      const parsed = JSON.parse(raw);

      expect(parsed.level).toBe('error');
      expect(parsed.message).toBe('Auth failure');
      expect(parsed.data.authorization).toBe('[REDACTED]');
      expect(parsed.data.accessToken).toBe('[REDACTED]');
      expect(parsed.data.nested.cookie).toBe('[REDACTED]');
      expect(parsed.data.nested.safe).toBe('ok');
    } finally {
      restoreEnv(envBefore);
    }
  });

  it('serializes Error objects with redacted inline secrets', () => {
    const keys = ['LOG_LEVEL'];
    const envBefore = snapshotEnv(keys);
    try {
      process.env.LOG_LEVEL = 'debug';
      resetConfigCache();
      resetEnvCache();

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      logger.warn('Upstream failure', {
        error: new Error('Authorization: Bearer sk-LEAK_ME_NOT'),
      });

      const raw = String(warnSpy.mock.calls[0]?.[0] ?? '');
      const parsed = JSON.parse(raw);
      expect(parsed.level).toBe('warn');
      expect(parsed.data.error.name).toBe('Error');
      expect(parsed.data.error.message).toContain('[REDACTED]');
      expect(parsed.data.error.message).not.toContain('LEAK_ME_NOT');
    } finally {
      restoreEnv(envBefore);
    }
  });
});
