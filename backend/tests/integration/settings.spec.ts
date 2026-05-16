import { describe, it, expect } from 'vitest';
import { signToken } from '../../src/lib/auth/jwt';
import { createAppFetch } from '../helpers/httpClient';

async function readJson(res: Response): Promise<any> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { _raw: text };
  }
}

describe('Settings API (Grok toggle)', () => {
  const request = createAppFetch();

  it('GET /api/settings requires auth (401 UNAUTHENTICATED)', async () => {
    const res = await request('/api/settings');
    const body = await readJson(res);
    expect(res.status).toBe(401);
    expect(body.error.code).toBe('UNAUTHENTICATED');
  });

  it('rejects invalid JWT (401 UNAUTHENTICATED)', async () => {
    const res = await request('/api/settings', {
      headers: { Authorization: 'Bearer invalid.token.value' },
    });
    const body = await readJson(res);
    expect(res.status).toBe(401);
    expect(body.error.code).toBe('UNAUTHENTICATED');
  });

  it('default grokEnabled is false', async () => {
    const token = signToken({ userId: 'u-settings-1', tier: 'free' });
    const res = await request('/api/settings', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await readJson(res);
    expect(res.status).toBe(200);
    expect(body.status).toBe('ok');
    expect(body.data).toEqual({ ai: { grokEnabled: false } });
  });

  it('free tier cannot enable grokEnabled (403 FORBIDDEN_TIER)', async () => {
    const token = signToken({ userId: 'u-settings-2', tier: 'free' });
    const res = await request('/api/settings', {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ai: { grokEnabled: true } }),
    });
    const body = await readJson(res);
    expect(res.status).toBe(403);
    expect(body.error.code).toBe('FORBIDDEN_TIER');
  });

  it('pro tier can enable grokEnabled and it persists', async () => {
    const token = signToken({ userId: 'u-settings-3', tier: 'pro' });

    const patchRes = await request('/api/settings', {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ai: { grokEnabled: true } }),
    });
    const patchBody = await readJson(patchRes);
    expect(patchRes.status).toBe(200);
    expect(patchBody.status).toBe('ok');
    expect(patchBody.data).toEqual({ ai: { grokEnabled: true } });

    const getRes = await request('/api/settings', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const getBody = await readJson(getRes);
    expect(getRes.status).toBe(200);
    expect(getBody.data).toEqual({ ai: { grokEnabled: true } });
  });

  it('allows disabling even if tier is missing/unknown', async () => {
    // 1) enable with pro
    const proToken = signToken({ userId: 'u-settings-4', tier: 'pro' });
    const enableRes = await request('/api/settings', {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${proToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ai: { grokEnabled: true } }),
    });
    const enableBody = await readJson(enableRes);
    expect(enableRes.status).toBe(200);
    expect(enableBody.status).toBe('ok');
    expect(enableBody.data).toEqual({ ai: { grokEnabled: true } });

    // 2) disable with unknown tier claim (should still be allowed)
    const unknownToken = signToken({ userId: 'u-settings-4', tier: 'bogus' });
    const disableRes = await request('/api/settings', {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${unknownToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ai: { grokEnabled: false } }),
    });
    const disableBody = await readJson(disableRes);
    expect(disableRes.status).toBe(200);
    expect(disableBody.status).toBe('ok');
    expect(disableBody.data).toEqual({ ai: { grokEnabled: false } });
  });
});
