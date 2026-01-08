import { describe, it, expect } from 'vitest';
import { ApiHttpError } from '../../src/services/api/client';
import {
  isRetryableFailure,
  applyRetryPolicyToFailure,
  computeNextDelayMs,
} from '../../src/services/sync/queuePolicy';

describe('offline queue policy', () => {
  it('classifies retryable HTTP failures (429, 5xx, 408)', () => {
    expect(isRetryableFailure(new ApiHttpError('rate limited', 429)).kind).toBe('retryable');
    expect(isRetryableFailure(new ApiHttpError('server down', 503)).kind).toBe('retryable');
    expect(isRetryableFailure(new ApiHttpError('timeout', 408)).kind).toBe('retryable');
  });

  it('classifies permanent HTTP failures (4xx except 408/429)', () => {
    expect(isRetryableFailure(new ApiHttpError('bad request', 400)).kind).toBe('permanent');
    expect(isRetryableFailure(new ApiHttpError('unauthorized', 401)).kind).toBe('permanent');
    expect(isRetryableFailure(new ApiHttpError('forbidden', 403)).kind).toBe('permanent');
    expect(isRetryableFailure(new ApiHttpError('not found', 404)).kind).toBe('permanent');
    expect(isRetryableFailure(new ApiHttpError('conflict', 409)).kind).toBe('permanent');
    // Safe default: other 4xx are permanent too.
    expect(isRetryableFailure(new ApiHttpError('unprocessable', 422)).kind).toBe('permanent');
  });

  it('classifies network/fetch failures as retryable', () => {
    expect(isRetryableFailure(new TypeError('Failed to fetch')).kind).toBe('retryable');
  });

  it('computes exponential backoff with jitter', () => {
    const delay0 = computeNextDelayMs({ baseDelayMs: 1000, retryCount: 0, maxJitterMs: 250, random: () => 0 });
    const delay1 = computeNextDelayMs({ baseDelayMs: 1000, retryCount: 1, maxJitterMs: 250, random: () => 0 });
    const delay2 = computeNextDelayMs({ baseDelayMs: 1000, retryCount: 2, maxJitterMs: 250, random: () => 0 });
    expect(delay0).toBe(1000);
    expect(delay1).toBe(2000);
    expect(delay2).toBe(4000);
  });

  it('schedules retries for retryable failures and marks failed after maxRetries', () => {
    const policy = { maxRetries: 2, baseDelayMs: 1000, maxJitterMs: 0 };
    const now = 10_000;

    const first = applyRetryPolicyToFailure({
      item: { retryCount: 0, status: 'pending' },
      error: new ApiHttpError('server down', 503),
      now,
      policy,
      random: () => 0,
    });

    expect(first.status).toBe('pending');
    expect(first.retryCount).toBe(1);
    expect(first.lastAttemptAt).toBe(now);
    expect(first.nextAttemptAt).toBe(now + 1000);

    const second = applyRetryPolicyToFailure({
      item: first,
      error: new ApiHttpError('server down', 503),
      now: now + 1000,
      policy,
      random: () => 0,
    });

    expect(second.status).toBe('failed');
    expect(second.retryCount).toBe(2);
    expect(second.failedAt).toBe(now + 1000);
    expect(second.nextAttemptAt).toBeUndefined();
    expect(second.lastError).toBe('server down');
  });

  it('marks permanent failures as failed immediately (no loop)', () => {
    const policy = { maxRetries: 10, baseDelayMs: 1000, maxJitterMs: 0 };
    const now = 1234;

    const updated = applyRetryPolicyToFailure({
      item: { retryCount: 0, status: 'pending' },
      error: new ApiHttpError('bad request', 400),
      now,
      policy,
    });

    expect(updated.status).toBe('failed');
    expect(updated.nextAttemptAt).toBeUndefined();
    expect(updated.retryCount).toBe(1);
    expect(updated.lastAttemptAt).toBe(now);
  });
});

