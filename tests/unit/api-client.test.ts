import { describe, it, expect, vi, beforeEach } from 'vitest';
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
});

