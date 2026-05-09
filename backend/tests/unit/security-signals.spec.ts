import { afterEach, describe, expect, it, vi } from 'vitest';
import { logger } from '../../src/observability/logger.js';
import {
  emitFailedLoginSignal,
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
});
