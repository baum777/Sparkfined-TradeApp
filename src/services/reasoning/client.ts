import type { ReasoningResponse } from '@/lib/reasoning/types';

interface ApiEnvelope<T> {
  data: T;
  status: number;
  message?: string;
}

interface ErrorBody {
  error: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
}

export class ReasoningHttpError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly requestId?: string;
  readonly details?: Record<string, string[]>;

  constructor(message: string, status: number, info?: Partial<Pick<ReasoningHttpError, 'code' | 'requestId' | 'details'>>) {
    super(message);
    this.name = 'ReasoningHttpError';
    this.status = status;
    this.code = info?.code;
    this.requestId = info?.requestId;
    this.details = info?.details;
  }
}

export class ReasoningContractError extends Error {
  readonly endpoint: string;
  constructor(message: string, endpoint: string) {
    super(message);
    this.name = 'ReasoningContractError';
    this.endpoint = endpoint;
  }
}

function unwrapEnvelopeStrict<T>(json: unknown, endpoint: string): T {
  if (json && typeof json === 'object' && 'data' in json && 'status' in json) {
    return (json as ApiEnvelope<T>).data;
  }
  throw new ReasoningContractError(
    `Non-canonical response shape for ${endpoint}: expected { data, status, message? } envelope`,
    endpoint
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

export class ReasoningClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(config?: { baseUrl?: string; timeoutMs?: number }) {
    this.baseUrl = config?.baseUrl ?? (import.meta.env.VITE_API_URL || '/api');
    this.timeoutMs = config?.timeoutMs ?? 12000;
  }

  async post<TReq extends object, TRes>(
    path: string,
    body: TReq,
    options?: { retries?: number }
  ): Promise<TRes> {
    const url = `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
    const retries = options?.retries ?? 2;

    let lastError: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        const text = await res.text();
        const json = text.length ? JSON.parse(text) : null;
        const requestId = res.headers.get('x-request-id') ?? undefined;

        if (!res.ok) {
          const err = (json && typeof json === 'object' && 'error' in json)
            ? (json as ErrorBody)
            : null;
          const httpErr = new ReasoningHttpError(
            err?.error?.message || `HTTP ${res.status}`,
            res.status,
            err ? { code: err.error.code, requestId, details: err.error.details } : { requestId }
          );

          if (attempt < retries && isRetryableStatus(res.status)) {
            lastError = httpErr;
            const backoff = Math.min(2000, 250 * Math.pow(2, attempt));
            await sleep(backoff);
            continue;
          }

          throw httpErr;
        }

        return unwrapEnvelopeStrict<TRes>(json, path);
      } catch (e) {
        lastError = e;
        const isAbort = e instanceof Error && e.name === 'AbortError';
        if (attempt < retries && isAbort) {
          const backoff = Math.min(2000, 250 * Math.pow(2, attempt));
          await sleep(backoff);
          continue;
        }
        throw e;
      } finally {
        clearTimeout(timeout);
      }
    }

    throw lastError;
  }

  async postReasoning<TReq extends object, TData>(
    path: string,
    body: TReq,
    options?: { retries?: number }
  ): Promise<ReasoningResponse<TData>> {
    return this.post<TReq, ReasoningResponse<TData>>(path, body, options);
  }
}

export const reasoningClient = new ReasoningClient();


