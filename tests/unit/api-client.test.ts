import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApiClient, ApiContractError, ApiHttpError } from '../../src/services/api/client';

function makeResponse(init: { ok: boolean; status: number; body: unknown; statusText?: string }): Response {
  const text = init.body === undefined ? '' : JSON.stringify(init.body);
  return new Response(text, {
    status: init.status,
    statusText: init.statusText,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('apiClient envelope handling', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('unwraps canonical success envelope by default', async () => {
    const fetchMock = vi.fn(async () =>
      makeResponse({ ok: true, status: 200, body: { status: 'ok', data: { ok: true } } })
    );
    vi.stubGlobal('fetch', fetchMock as any);

    const client = new ApiClient({ baseURL: '' });
    const data = await client.get<{ ok: boolean }>('/health');
    expect(data).toEqual({ ok: true });
  });

  it('throws ApiContractError on non-enveloped success payload (drift)', async () => {
    const fetchMock = vi.fn(async () => makeResponse({ ok: true, status: 200, body: { ok: true } }));
    vi.stubGlobal('fetch', fetchMock as any);

    const client = new ApiClient({ baseURL: '' });
    await expect(client.get<{ ok: boolean }>('/health')).rejects.toBeInstanceOf(ApiContractError);
  });

  it('raw mode returns the body unchanged (opt-in during migration)', async () => {
    const fetchMock = vi.fn(async () => makeResponse({ ok: true, status: 200, body: { ok: true } }));
    vi.stubGlobal('fetch', fetchMock as any);

    const client = new ApiClient({ baseURL: '' });
    const raw = await client.raw.get<{ ok: boolean }>('/health');
    expect(raw).toEqual({ ok: true });
  });

  it('parses canonical error body into ApiHttpError', async () => {
    const fetchMock = vi.fn(async () =>
      makeResponse({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        body: { error: { code: 'RATE_LIMITED', message: 'Slow down', details: { retryAfterMs: 1000 } } },
      })
    );
    vi.stubGlobal('fetch', fetchMock as any);

    const client = new ApiClient({ baseURL: '' });
    await expect(client.get('/rate-limited')).rejects.toMatchObject<ApiHttpError>({
      name: 'ApiHttpError',
      status: 429,
      code: 'RATE_LIMITED',
    });
  });

  it('keeps auth headers and credentials off when auth flag is disabled', async () => {
    vi.stubEnv('VITE_ENABLE_AUTH', 'false');

    const fetchMock = vi.fn(async () =>
      makeResponse({ ok: true, status: 200, body: { status: 'ok', data: { ok: true } } })
    );
    vi.stubGlobal('fetch', fetchMock as any);

    const client = new ApiClient({ baseURL: '' });
    client.setAuthToken('disabled-token');

    await client.get('/secure');

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.credentials).toBe('same-origin');
    expect(init.headers).not.toMatchObject({ Authorization: 'Bearer disabled-token' });
  });

  it('sends credentials and bearer token when auth flag is enabled', async () => {
    vi.stubEnv('VITE_ENABLE_AUTH', 'true');

    const fetchMock = vi.fn(async () =>
      makeResponse({ ok: true, status: 200, body: { status: 'ok', data: { ok: true } } })
    );
    vi.stubGlobal('fetch', fetchMock as any);

    const client = new ApiClient({ baseURL: '' });
    client.setAuthToken('enabled-token');

    await client.get('/secure');

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.credentials).toBe('include');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer enabled-token' });
  });
});
