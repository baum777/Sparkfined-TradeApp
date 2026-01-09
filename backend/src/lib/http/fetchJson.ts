export interface FetchJsonOptions {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs: number;
  signal?: AbortSignal;
}

export interface FetchJsonResult<T> {
  status: number;
  ok: boolean;
  headers: Headers;
  text: string;
  json: T;
}

export class FetchJsonError extends Error {
  readonly status?: number;
  readonly bodyText?: string;
  readonly responseHeaders?: Headers;

  constructor(message: string, input?: { status?: number; bodyText?: string; responseHeaders?: Headers }) {
    super(message);
    this.name = 'FetchJsonError';
    this.status = input?.status;
    this.bodyText = input?.bodyText;
    this.responseHeaders = input?.responseHeaders;
  }
}

export async function fetchJson<T>(url: string, opts: FetchJsonOptions): Promise<FetchJsonResult<T>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs);

  let signal: AbortSignal = controller.signal;
  if (opts.signal) {
    // If the caller passes a signal, abort when either aborts
    const outer = opts.signal;
    if (outer.aborted) controller.abort();
    else outer.addEventListener('abort', () => controller.abort(), { once: true });
    signal = controller.signal;
  }

  try {
    const res = await fetch(url, {
      method: opts.method,
      headers: {
        'Content-Type': 'application/json',
        ...(opts.headers ?? {}),
      },
      body: opts.body == null ? undefined : JSON.stringify(opts.body),
      signal,
    });

    const text = await res.text();
    let json: T;
    try {
      json = text ? (JSON.parse(text) as T) : (undefined as unknown as T);
    } catch {
      throw new FetchJsonError('Upstream returned invalid JSON', {
        status: res.status,
        bodyText: text,
        responseHeaders: res.headers,
      });
    }

    return {
      status: res.status,
      ok: res.ok,
      headers: res.headers,
      text,
      json,
    };
  } catch (err) {
    if (err instanceof FetchJsonError) throw err;
    throw new FetchJsonError(err instanceof Error ? err.message : 'Fetch failed');
  } finally {
    clearTimeout(timeout);
  }
}

