import { afterEach, describe, expect, it } from 'vitest';
import { getEnv, resetEnvCache } from '../../src/config/env.js';

type Snapshot = Record<string, string | undefined>;

const KEYS = [
  'NODE_ENV',
  'SERVICE_MODE',
  'JWT_SECRET',
  'BACKEND_CORS_ORIGINS',
  'HELIUS_API_KEY',
] as const;

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
  resetEnvCache();
});

describe('Environment Security Validation', () => {
  it('rejects weak JWT secret in production', () => {
    const envBefore = snapshotEnv();
    try {
      process.env.NODE_ENV = 'production';
      process.env.SERVICE_MODE = 'journal';
      process.env.JWT_SECRET = 'dev-secret';
      process.env.BACKEND_CORS_ORIGINS = 'https://allowed.example';
      process.env.HELIUS_API_KEY = 'not-used-in-journal-mode';
      resetEnvCache();

      expect(() => getEnv({ strict: true })).toThrow(/JWT_SECRET/);
    } finally {
      restoreEnv(envBefore);
    }
  });

  it('requires explicit CORS origins in production', () => {
    const envBefore = snapshotEnv();
    try {
      process.env.NODE_ENV = 'production';
      process.env.SERVICE_MODE = 'journal';
      process.env.JWT_SECRET = 'this-is-a-valid-production-jwt-secret-with-32-plus';
      delete process.env.BACKEND_CORS_ORIGINS;
      process.env.HELIUS_API_KEY = 'not-used-in-journal-mode';
      resetEnvCache();

      expect(() => getEnv({ strict: true })).toThrow(/BACKEND_CORS_ORIGINS/);
    } finally {
      restoreEnv(envBefore);
    }
  });

  it('accepts production config with strong secret and CORS allowlist', () => {
    const envBefore = snapshotEnv();
    try {
      process.env.NODE_ENV = 'production';
      process.env.SERVICE_MODE = 'journal';
      process.env.JWT_SECRET = 'this-is-a-valid-production-jwt-secret-with-32-plus';
      process.env.BACKEND_CORS_ORIGINS = 'https://allowed.example,https://app.example';
      process.env.HELIUS_API_KEY = 'not-used-in-journal-mode';
      resetEnvCache();

      expect(() => getEnv({ strict: true })).not.toThrow();
    } finally {
      restoreEnv(envBefore);
    }
  });
});
