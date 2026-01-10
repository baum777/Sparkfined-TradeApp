import { ApiHttpError } from '../api/client';

export type QueueFailureKind = 'retryable' | 'permanent';

export type QueueFailureClassification = {
  kind: QueueFailureKind;
  status?: number;
  message: string;
};

export type OfflineQueueRetryPolicy = {
  /** Maximum number of retries before marking item failed */
  maxRetries: number;
  /** Base delay used for exponential backoff (ms) */
  baseDelayMs: number;
  /** Random jitter added to delay (ms) */
  maxJitterMs: number;
};

export const OFFLINE_QUEUE_RETRYABLE_STATUSES = new Set<number>([408, 429]);
export const OFFLINE_QUEUE_PERMANENT_STATUSES = new Set<number>([
  400, 401, 403, 404, 409,
]);

export const DEFAULT_OFFLINE_QUEUE_POLICY: OfflineQueueRetryPolicy = {
  // Recommendation: 5–10. Keep default conservative for UX.
  maxRetries: 5,
  baseDelayMs: 1000,
  maxJitterMs: 250,
};

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === 'string' ? Number.parseInt(value, 10) : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

export function getDefaultOfflineQueuePolicy(): OfflineQueueRetryPolicy {
  // Allow runtime override via env (optional).
  // Vite env values are strings at build time.
  const maxRetries = clampInt(import.meta.env.VITE_OFFLINE_QUEUE_MAX_RETRIES, DEFAULT_OFFLINE_QUEUE_POLICY.maxRetries, 0, 50);
  const baseDelayMs = clampInt(import.meta.env.VITE_OFFLINE_QUEUE_BASE_DELAY_MS, DEFAULT_OFFLINE_QUEUE_POLICY.baseDelayMs, 50, 60_000);
  const maxJitterMs = clampInt(import.meta.env.VITE_OFFLINE_QUEUE_MAX_JITTER_MS, DEFAULT_OFFLINE_QUEUE_POLICY.maxJitterMs, 0, 60_000);
  return { maxRetries, baseDelayMs, maxJitterMs };
}

export function isRetryableFailure(error: unknown): QueueFailureClassification {
  const message = error instanceof Error ? error.message : 'Unknown error';

  // Network / fetch failures.
  if (error instanceof TypeError) {
    return { kind: 'retryable', message };
  }

  // Canonical HTTP failures.
  if (error instanceof ApiHttpError) {
    const { status } = error;
    if (OFFLINE_QUEUE_RETRYABLE_STATUSES.has(status)) {
      return { kind: 'retryable', status, message };
    }
    if (status >= 500 && status < 600) {
      return { kind: 'retryable', status, message };
    }

    // Permanent failures (strict list + safe default for other 4xx)
    if (OFFLINE_QUEUE_PERMANENT_STATUSES.has(status)) {
      return { kind: 'permanent', status, message };
    }
    if (status >= 400 && status < 500) {
      return { kind: 'permanent', status, message };
    }
  }

  // Unknown errors: retryable up to maxRetries to avoid silent drops.
  return { kind: 'retryable', message };
}

export function computeNextDelayMs(params: {
  baseDelayMs: number;
  retryCount: number;
  maxJitterMs: number;
  random?: () => number;
}): number {
  const random = params.random ?? Math.random;
  const jitter = Math.floor(random() * Math.max(0, params.maxJitterMs));
  const exp = Math.pow(2, Math.max(0, params.retryCount));
  return params.baseDelayMs * exp + jitter;
}

export function computeNextAttemptAt(params: {
  now: number;
  baseDelayMs: number;
  retryCount: number;
  maxJitterMs: number;
  random?: () => number;
}): number {
  return params.now + computeNextDelayMs(params);
}

export type QueueItemRetryFields = {
  retryCount: number;
  lastError?: string;
  lastAttemptAt?: number;
  nextAttemptAt?: number;
  status?: 'pending' | 'failed';
  failedAt?: number;
};

/**
 * Apply strict retry policy and return updated item fields.
 *
 * - Retryable failures schedule `nextAttemptAt` with exponential backoff + jitter.
 * - Permanent failures are marked failed immediately.
 * - After `maxRetries`, item is marked failed and auto-retry stops.
 *
 * Note: Delay uses the *current* retryCount (0-based) per spec: base * 2^retryCount + jitter.
 * The returned object increments retryCount by 1 on every failure attempt.
 */
export function applyRetryPolicyToFailure(params: {
  item: QueueItemRetryFields;
  error: unknown;
  now: number;
  policy: OfflineQueueRetryPolicy;
  random?: () => number;
}): QueueItemRetryFields {
  const classification = isRetryableFailure(params.error);
  const errorMessage = classification.message;

  const nextRetryCount = (params.item.retryCount ?? 0) + 1;

  if (classification.kind === 'permanent') {
    return {
      ...params.item,
      retryCount: nextRetryCount,
      lastError: errorMessage,
      lastAttemptAt: params.now,
      status: 'failed',
      failedAt: params.now,
      nextAttemptAt: undefined,
    };
  }

  if (nextRetryCount >= params.policy.maxRetries) {
    return {
      ...params.item,
      retryCount: nextRetryCount,
      lastError: errorMessage,
      lastAttemptAt: params.now,
      status: 'failed',
      failedAt: params.now,
      nextAttemptAt: undefined,
    };
  }

  return {
    ...params.item,
    retryCount: nextRetryCount,
    lastError: errorMessage,
    lastAttemptAt: params.now,
    status: 'pending',
    nextAttemptAt: computeNextAttemptAt({
      now: params.now,
      baseDelayMs: params.policy.baseDelayMs,
      retryCount: params.item.retryCount ?? 0,
      maxJitterMs: params.policy.maxJitterMs,
      random: params.random,
    }),
  };
}

