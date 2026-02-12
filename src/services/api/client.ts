/**
 * API Client Konfiguration
 * 
 * Zentraler HTTP-Client für alle API-Aufrufe.
 */

export interface ApiClientConfig {
  baseURL: string;
  timeout: number;
  headers: Record<string, string>;
  credentials: RequestCredentials;
}

export interface ApiOkEnvelope<T> {
  status: 'ok';
  data: T;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export class ApiHttpError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: unknown;

  constructor(message: string, status: number, info?: { code?: string; details?: unknown }) {
    super(message);
    this.name = 'ApiHttpError';
    this.status = status;
    this.code = info?.code;
    this.details = info?.details;
  }
}

export class ApiContractError extends Error {
  readonly endpoint: string;
  readonly hint?: string;

  constructor(message: string, endpoint: string, hint?: string) {
    super(message);
    this.name = 'ApiContractError';
    this.endpoint = endpoint;
    this.hint = hint;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object';
}

function parseJsonSafely(text: string): unknown {
  if (!text.length) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function isOkEnvelope(value: unknown): value is ApiOkEnvelope<unknown> {
  return (
    isObject(value) &&
    (value as any).status === 'ok' &&
    'data' in value &&
    'status' in value
  );
}

function parseCanonicalErrorBody(value: unknown): ApiErrorBody | null {
  if (!isObject(value)) return null;
  if (!('error' in value)) return null;
  const err = (value as any).error;
  if (!isObject(err)) return null;
  if (typeof err.code !== 'string' || typeof err.message !== 'string') return null;
  return value as unknown as ApiErrorBody;
}

function parseLegacyErrorBody(value: unknown): { code?: string; message?: string; details?: unknown } | null {
  // Legacy backend shape (pre-envelope standardization)
  // { status, message, code, details?, requestId? }
  if (!isObject(value)) return null;
  const code = typeof (value as any).code === 'string' ? (value as any).code : undefined;
  const message = typeof (value as any).message === 'string' ? (value as any).message : undefined;
  const details = (value as any).details;
  if (!code && !message && details === undefined) return null;
  return { code, message, details };
}

class ApiClient {
  private config: ApiClientConfig;
  readonly raw: {
    get: <TRaw>(endpoint: string, options?: RequestInit) => Promise<TRaw>;
    post: <TRaw>(endpoint: string, data?: unknown, options?: RequestInit) => Promise<TRaw>;
    put: <TRaw>(endpoint: string, data?: unknown, options?: RequestInit) => Promise<TRaw>;
    patch: <TRaw>(endpoint: string, data?: unknown, options?: RequestInit) => Promise<TRaw>;
    delete: <TRaw>(endpoint: string, options?: RequestInit) => Promise<TRaw>;
  };

  constructor(config?: Partial<ApiClientConfig>) {
    this.config = {
      baseURL: config?.baseURL || import.meta.env.VITE_API_URL || '/api',
      timeout: config?.timeout || 10000,
      headers: {
        'Content-Type': 'application/json',
        ...config?.headers,
      },
      credentials:
        config?.credentials ??
        (import.meta.env.VITE_ENABLE_AUTH === 'true' ? 'include' : 'same-origin'),
    };

    // Raw mode: return response JSON as-is (no envelope enforcement / no unwrapping).
    this.raw = {
      get: (endpoint, options) => this.requestJson(endpoint, { ...options, method: 'GET' }),
      post: (endpoint, data, options) =>
        this.requestJson(endpoint, {
          ...options,
          method: 'POST',
          body: data === undefined ? undefined : JSON.stringify(data),
        }),
      put: (endpoint, data, options) =>
        this.requestJson(endpoint, {
          ...options,
          method: 'PUT',
          body: data === undefined ? undefined : JSON.stringify(data),
        }),
      patch: (endpoint, data, options) =>
        this.requestJson(endpoint, {
          ...options,
          method: 'PATCH',
          body: data === undefined ? undefined : JSON.stringify(data),
        }),
      delete: (endpoint, options) => this.requestJson(endpoint, { ...options, method: 'DELETE' }),
    };
  }

  private buildUrl(endpoint: string): string {
    const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    return `${this.config.baseURL}${path}`;
  }

  private async requestJson<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = this.buildUrl(endpoint);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...this.config.headers,
          ...options.headers,
        },
        credentials: options.credentials ?? this.config.credentials,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const text = await response.text();
      const json = parseJsonSafely(text);

      if (!response.ok) {
        const canonical = parseCanonicalErrorBody(json);
        if (canonical) {
          throw new ApiHttpError(canonical.error.message, response.status, {
            code: canonical.error.code,
            details: canonical.error.details,
          });
        }

        const legacy = parseLegacyErrorBody(json);
        if (legacy) {
          throw new ApiHttpError(legacy.message || `HTTP ${response.status}`, response.status, {
            code: legacy.code,
            details: legacy.details,
          });
        }

        throw new ApiHttpError(
          response.statusText ? `HTTP Error: ${response.statusText}` : `HTTP ${response.status}`,
          response.status
        );
      }

      return json as T;
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new ApiHttpError('Request timeout', 408, { code: 'TIMEOUT' });
      }

      throw error;
    }
  }

  private async requestEnvelope<T>(endpoint: string, options?: RequestInit): Promise<ApiOkEnvelope<T>> {
    const json = await this.requestJson<ApiOkEnvelope<T> | T>(endpoint, options);
    if (isOkEnvelope(json)) {
      return json as ApiOkEnvelope<T>;
    }

    // Defensive parsing to catch drift early. Use raw mode to opt in to non-enveloped payloads.
    throw new ApiContractError(
      `Non-canonical response shape for ${endpoint}: expected { status: "ok", data } envelope`,
      endpoint,
      'Use apiClient.raw.* to access the raw JSON during migration, or fix the backend to return the canonical envelope.'
    );
  }

  async get<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const env = await this.requestEnvelope<T>(endpoint, { ...options, method: 'GET' });
    return env.data;
  }

  async post<T>(endpoint: string, data?: unknown, options?: RequestInit): Promise<T> {
    const env = await this.requestEnvelope<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data === undefined ? undefined : JSON.stringify(data),
    });
    return env.data;
  }

  async put<T>(endpoint: string, data?: unknown, options?: RequestInit): Promise<T> {
    const env = await this.requestEnvelope<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: data === undefined ? undefined : JSON.stringify(data),
    });
    return env.data;
  }

  async patch<T>(endpoint: string, data?: unknown, options?: RequestInit): Promise<T> {
    const env = await this.requestEnvelope<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: data === undefined ? undefined : JSON.stringify(data),
    });
    return env.data;
  }

  async delete<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const env = await this.requestEnvelope<T>(endpoint, { ...options, method: 'DELETE' });
    return env.data;
  }

  setAuthToken(token: string) {
    // Auth is intentionally disabled for the current milestone.
    // Keep the method for future readiness, but do not attach headers unless enabled.
    // This prevents accidental auth coupling / redirect loops when backend runs anon.
    // Note: when ENABLE_AUTH is true, callers are responsible for ensuring token validity.
    const enabled = import.meta.env.VITE_ENABLE_AUTH === 'true';
    if (!enabled) return;
    this.config.headers['Authorization'] = `Bearer ${token}`;
  }

  removeAuthToken() {
    delete this.config.headers['Authorization'];
  }
}

// Singleton-Instanz
export const apiClient = new ApiClient();

// Export für Testing oder Custom-Konfigurationen
export { ApiClient };
