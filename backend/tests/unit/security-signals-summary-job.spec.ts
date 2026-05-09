import { afterEach, describe, expect, it, vi } from 'vitest';
import { logger } from '../../src/observability/logger.js';
import { emitFailedLoginSignal, resetSecuritySignalsStateForTesting } from '../../src/observability/securitySignals.js';
import { runSecuritySignalsSummaryJob } from '../../src/jobs/securitySignalsSummary.job.js';

afterEach(() => {
  vi.restoreAllMocks();
  resetSecuritySignalsStateForTesting();
});

describe('security signals summary job', () => {
  it('does not emit summary when no signals are present', async () => {
    const infoSpy = vi.spyOn(logger, 'info').mockImplementation(() => {});
    const result = await runSecuritySignalsSummaryJob();

    expect(result.emitted).toBe(false);
    expect(result.totalSignals).toBe(0);
    expect(infoSpy).not.toHaveBeenCalledWith('security.summary', expect.anything());
  });

  it('emits summary when signals were observed', async () => {
    emitFailedLoginSignal({ reason: 'unknown_email', email: 'job@example.com', ip: '203.0.113.55' });
    const infoSpy = vi.spyOn(logger, 'info').mockImplementation(() => {});

    const result = await runSecuritySignalsSummaryJob();

    expect(result.emitted).toBe(true);
    expect(result.totalSignals).toBe(1);
    expect(infoSpy).toHaveBeenCalledWith('security.summary', expect.objectContaining({
      totalSignals: 1,
    }));
  });
});
