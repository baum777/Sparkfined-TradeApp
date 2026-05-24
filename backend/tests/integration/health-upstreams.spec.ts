import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetEnvCache } from '../../src/config/env';
import { createAppFetch } from '../helpers/httpClient';

async function readJson(res: Response): Promise<unknown> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { _raw: text };
  }
}

describe('GET /api/health/upstreams', () => {
  const request = createAppFetch();

  beforeEach(() => {
    process.env.HELIUS_API_KEY = '';
    process.env.JUPITER_PLATFORM_FEE_ACCOUNT = '';
    process.env.JUPITER_BASE_URL = 'https://quote-api.jup.ag/v6';
    resetEnvCache();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.HELIUS_API_KEY;
    delete process.env.JUPITER_PLATFORM_FEE_ACCOUNT;
    delete process.env.JUPITER_BASE_URL;
    resetEnvCache();
  });

  it('reports missing Jupiter platform fee account when default terminal fee is positive', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })));

    const res = await request('/api/health/upstreams');
    const body = await readJson(res);

    expect(res.status).toBe(200);
    expect(body).toHaveProperty('status', 'ok');
    expect(body).toHaveProperty('data.status', 'degraded');
    expect(body).toHaveProperty('data.checks.jupiter', 'ok');
    expect(body).toHaveProperty('data.checks.jupiterPlatformFeeAccount', 'missing');
    expect(JSON.stringify(body)).not.toContain('test-fee-account-secret');
  });

  it('classifies Jupiter network failures without leaking configured secrets', async () => {
    process.env.JUPITER_PLATFORM_FEE_ACCOUNT = 'test-fee-account-secret';
    resetEnvCache();
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('getaddrinfo ENOTFOUND quote-api.jup.ag');
    }));

    const res = await request('/api/health/upstreams');
    const body = await readJson(res);

    expect(res.status).toBe(200);
    expect(body).toHaveProperty('data.status', 'degraded');
    expect(body).toHaveProperty('data.checks.jupiter', 'error');
    expect(body).toHaveProperty('data.checks.jupiterReason', 'network_error');
    expect(body).toHaveProperty('data.checks.jupiterPlatformFeeAccount', 'ok');
    expect(JSON.stringify(body)).not.toContain('test-fee-account-secret');
    expect(JSON.stringify(body)).not.toContain('ENOTFOUND');
  });
});
