import type { OnchainContextErrorCode } from './types';

export class OnchainFetchError extends Error {
  code: OnchainContextErrorCode;
  status?: number;

  constructor(message: string, code: OnchainContextErrorCode, status?: number) {
    super(message);
    this.name = 'OnchainFetchError';
    this.code = code;
    this.status = status;
  }
}

interface FetchOptions {
  headers?: Record<string, string>;
  timeoutMs: number;
}

export async function fetchJsonWithTimeout<T>(url: string, options: FetchOptions): Promise<T> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), options.timeoutMs);

  try {
    const response = await fetch(url, {
      headers: options.headers,
      signal: controller.signal,
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new OnchainFetchError(`Not found: ${url}`, 'HTTP_ERROR', 404);
      }
      if (response.status === 401 || response.status === 403) {
        throw new OnchainFetchError('Unauthorized/Forbidden', 'MISSING_API_KEY', response.status);
      }
      if (response.status === 429) {
        throw new OnchainFetchError('Rate limited', 'HTTP_ERROR', 429);
      }
      throw new OnchainFetchError(`HTTP ${response.status}`, 'HTTP_ERROR', response.status);
    }

    try {
      return (await response.json()) as T;
    } catch {
      throw new OnchainFetchError('Invalid JSON response', 'PARSE_ERROR');
    }
  } catch (err) {
    if (err instanceof OnchainFetchError) {
      throw err;
    }
    if (err instanceof Error) {
      if (err.name === 'AbortError') {
        throw new OnchainFetchError(`Timeout after ${options.timeoutMs}ms`, 'TIMEOUT');
      }
      // fetch network errors
      throw new OnchainFetchError(err.message, 'HTTP_ERROR');
    }
    throw new OnchainFetchError('Unknown fetch error', 'UNKNOWN_ERROR');
  } finally {
    clearTimeout(id);
  }
}

