import { afterEach, describe, expect, it, vi } from 'vitest';
import { logger } from '../../src/observability/logger.js';
import {
  consumeSecuritySignalsSummary,
  emitFailedLoginSignal,
  emitRateLimitHitSignal,
  hashForSecurityTelemetry,
  resetSecuritySignalsStateForTesting,
} from '../../src/observability/securitySignals.js';

afterEach(() => {
  vi.restoreAllMocks();
  resetSecuritySignalsStateForTesting();
});

describe('security signal helpers', () => {
  it('hashes telemetry identifiers deterministically without returning raw values', () => {
    const a = hashForSecurityTelemetry('user@example.com');
    const b = hashForSecurityTelemetry('user@example.com');
    const c = hashForSecurityTelemetry('other@example.com');

    expect(a).toBeDefined();
    expect(a).toHaveLength(16);
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).not.toContain('user@example.com');
  });

  it('emits suspicious_activity after failed-login burst threshold', () => {
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});

    for (let i = 0; i < 5; i += 1) {
      emitFailedLoginSignal({
        reason: 'wrong_password',
        email: 'burst@example.com',
        ip: '203.0.113.14',
        userAgent: 'vitest-security-signals',
      });
    }

    const suspiciousCalls = warnSpy.mock.calls.filter((call) => {
      if (call[0] !== 'security.signal') return false;
      const payload = (call[1] ?? {}) as Record<string, unknown>;
      return payload.signalType === 'suspicious_activity' && payload.detector === 'failed_login_burst';
    });

    // One for email-basis and one for ip-basis when threshold is reached.
    expect(suspiciousCalls.length).toBe(2);
    for (const call of suspiciousCalls) {
      const payload = (call[1] ?? {}) as Record<string, unknown>;
      expect(payload.threshold).toBe(5);
      expect(payload.observedCount).toBe(5);
      expect(payload.actorHash).toBeDefined();
    }
  });

  it('aggregates and resets periodic summary counters', () => {
    for (let i = 0; i < 5; i += 1) {
      emitFailedLoginSignal({
        reason: 'wrong_password',
        email: 'summary@example.com',
        ip: '203.0.113.99',
      });
    }
    emitRateLimitHitSignal({
      scope: 'route:reasoning',
      path: '/api/reasoning/trade-review',
      actorId: 'user-1',
      count: 11,
      limit: 10,
      retryAfterSeconds: 33,
    });
    emitRateLimitHitSignal({
      scope: 'route:reasoning',
      path: '/api/reasoning/insight-critic',
      actorId: 'user-2',
      count: 11,
      limit: 10,
      retryAfterSeconds: 33,
    });

    const summary = consumeSecuritySignalsSummary();
    expect(summary.totalSignals).toBe(9);
    expect(summary.counters.failedLogin).toBe(5);
    expect(summary.counters.rateLimitHit).toBe(2);
    expect(summary.counters.suspiciousActivity).toBe(2);
    expect(summary.topRateLimitScopes[0]).toEqual({ scope: 'route:reasoning', hits: 2 });
    expect(summary.suspiciousDetectors[0]).toEqual({ detector: 'failed_login_burst', hits: 2 });

    const reset = consumeSecuritySignalsSummary();
    expect(reset.totalSignals).toBe(0);
    expect(reset.counters.failedLogin).toBe(0);
    expect(reset.counters.rateLimitHit).toBe(0);
    expect(reset.counters.suspiciousActivity).toBe(0);
  });
});
