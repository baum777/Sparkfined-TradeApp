import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { createServer, type Server } from 'http';
import { createApp } from '../../src/app';
import { resetEnvCache } from '../../src/config/env';
import { resetDiscoverCacheForTesting } from '../../src/lib/discover/discoverService';

async function readJson(res: Response): Promise<unknown> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { _raw: text };
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

describe('GET /api/discover/tokens', () => {
  const TEST_TIMEOUT_MS = 15_000;
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    process.env.HELIUS_API_KEY = 'test-helius-api-key';
    resetEnvCache();

    const app = createApp();
    server = createServer((req, res) => app.handle(req, res));

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });

    const addr = server.address();
    if (!addr || typeof addr === 'string') throw new Error('Failed to bind test server');
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  beforeEach(() => {
    resetEnvCache();
    resetDiscoverCacheForTesting();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns canonical envelope and array of tokens with mocked Jupiter', { timeout: TEST_TIMEOUT_MS }, async () => {
    const realFetch = globalThis.fetch;
    const fetchMock = vi.fn(async (url: string | URL) => {
      const u = String(url);
      // Only mock Jupiter API calls, not local server
      if (u.includes('quote-api.jup.ag') || u.includes('jup.ag')) {
        if (u.includes('/tokens')) {
          return jsonResponse([
            { address: 'Token1111111111111111111111111111111111111', symbol: 'TOK1', name: 'Token 1' },
            { address: 'Token2222222222222222222222222222222222222', symbol: 'TOK2', name: 'Token 2' },
          ]);
        }
      }
      return realFetch(url);
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await fetch(`${baseUrl}/api/discover/tokens?limit=10`);
    const body = await readJson(res);

    expect(res.status).toBe(200);
    expect(body).toHaveProperty('status', 'ok');
    expect(body).toHaveProperty('data');
    const data = (body as { data: unknown }).data;
    expect(Array.isArray(data)).toBe(true);
    const arr = data as unknown[];
    expect(arr.length).toBeGreaterThan(0);
    const first = arr[0] as Record<string, unknown>;
    expect(first).toHaveProperty('mint');
    expect(first).toHaveProperty('symbol');
    expect(first).toHaveProperty('name');
    expect(first).toHaveProperty('market');
    expect(first).toHaveProperty('liquidity');
    expect(first).toHaveProperty('trading');
  });

  it('returns paginated results with cursor', { timeout: TEST_TIMEOUT_MS }, async () => {
    const realFetch = globalThis.fetch;
    const fetchMock = vi.fn(async (url: string | URL) => {
      const u = String(url);
      if (u.includes('quote-api.jup.ag') || u.includes('jup.ag')) {
        if (u.includes('/tokens')) {
          return jsonResponse(
            Array.from({ length: 50 }, (_, i) => ({
              address: `Mint${i}111111111111111111111111111111111111`,
              symbol: `T${i}`,
              name: `Token ${i}`,
            }))
          );
        }
      }
      return realFetch(url);
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await fetch(`${baseUrl}/api/discover/tokens?limit=5&cursor=0`);
    const body = await readJson(res);

    expect(res.status).toBe(200);
    expect(body).toHaveProperty('status', 'ok');
    const data = (body as { data: unknown[] }).data;
    expect(data.length).toBe(5);
    expect(res.headers.get('x-next-cursor')).toBe('5');
  });
});
