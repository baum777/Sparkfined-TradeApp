export interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

export interface RetryAfterHint {
  retryAfterHeader?: string | null;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function parseRetryAfterMs(retryAfter: string | null | undefined): number | null {
  if (!retryAfter) return null;

  // Retry-After can be seconds or HTTP date
  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;

  const dateMs = Date.parse(retryAfter);
  if (Number.isFinite(dateMs)) {
    const delta = dateMs - Date.now();
    return delta > 0 ? delta : 0;
  }

  return null;
}

export function isRetryableHttpStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  opts: RetryOptions,
  input?: {
    isRetryableError?: (err: unknown) => boolean;
    getRetryAfterHint?: (value: T | unknown) => RetryAfterHint | null;
  }
): Promise<T> {
  const isRetryableError =
    input?.isRetryableError ??
    ((err: unknown) => {
      const status = (err as any)?.status;
      if (typeof status === 'number') return isRetryableHttpStatus(status);
      const msg = err instanceof Error ? err.message : String(err);
      return msg.includes('fetch failed') || msg.includes('ECONN') || msg.includes('ENOTFOUND');
    });

  let lastErr: unknown;

  const maxAttempts = opts.maxRetries + 1;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const value = await fn(attempt);
      return value;
    } catch (err) {
      lastErr = err;
      if (!isRetryableError(err)) break;
      if (attempt >= maxAttempts) break;

      const hint = input?.getRetryAfterHint?.(err);
      const retryAfterMs = parseRetryAfterMs(hint?.retryAfterHeader);

      const exp = opts.baseDelayMs * Math.pow(2, attempt - 1);
      const jitter = Math.floor(exp * (0.1 * (Math.random() * 2 - 1))); // ±10%
      const backoffMs = Math.min(opts.maxDelayMs, Math.max(0, exp + jitter));
      const delayMs = retryAfterMs != null ? Math.max(retryAfterMs, backoffMs) : backoffMs;

      await sleep(delayMs);
    }
  }

  throw lastErr;
}

