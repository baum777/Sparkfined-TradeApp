/**
 * Test Setup
 * Global test configuration
 */

import { beforeAll, afterAll, beforeEach } from 'vitest';
import { resetEnvCache } from '../_lib/env';
import { clearMemoryStore } from '../_lib/kv';

// Set test environment
process.env.NODE_ENV = 'test';

// Set deterministic Auth Secrets for testing
process.env.AUTH_JWT_SECRET = 'test-secret-must-be-at-least-32-bytes-long';
process.env.AUTH_JWT_ISSUER = 'test-issuer';
process.env.AUTH_JWT_AUDIENCE = 'test-audience';

beforeAll(() => {
  // Any global setup
});

beforeEach(() => {
  // Reset Env Cache to ensure tests pick up any process.env overrides
  resetEnvCache();
  // Ensure fresh memory store for each test to prevent state leaks
  clearMemoryStore();
});

afterAll(() => {
  // Any global cleanup
});
