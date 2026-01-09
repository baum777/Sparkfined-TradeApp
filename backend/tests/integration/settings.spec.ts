import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, type Server } from 'http';
import { createApp } from '../../src/app';
import { signToken } from '../../src/lib/auth/jwt';

async function readJson(res: Response): Promise<any> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { _raw: text };
  }
}

describe('Settings API (Grok toggle)', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
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

  it('GET /api/settings requires auth (401 UNAUTHENTICATED)', async () => {
    const res = await fetch(`${baseUrl}/api/settings`);
    const body = await readJson(res);
    expect(res.status).toBe(401);
    expect(body.status).toBe('error');
    expect(body.error.code).toBe('UNAUTHENTICATED');
  });

  it('default grokEnabled is false', async () => {
    const token = signToken({ userId: 'u-settings-1', tier: 'free' });
    const res = await fetch(`${baseUrl}/api/settings`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await readJson(res);
    expect(res.status).toBe(200);
    expect(body.status).toBe('ok');
    expect(body.data).toEqual({ ai: { grokEnabled: false } });
  });

  it('free tier cannot enable grokEnabled (403 FORBIDDEN_TIER)', async () => {
    const token = signToken({ userId: 'u-settings-2', tier: 'free' });
    const res = await fetch(`${baseUrl}/api/settings`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ai: { grokEnabled: true } }),
    });
    const body = await readJson(res);
    expect(res.status).toBe(403);
    expect(body.status).toBe('error');
    expect(body.error.code).toBe('FORBIDDEN_TIER');
  });

  it('pro tier can enable grokEnabled and it persists', async () => {
    const token = signToken({ userId: 'u-settings-3', tier: 'pro' });

    const patchRes = await fetch(`${baseUrl}/api/settings`, {
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

    const getRes = await fetch(`${baseUrl}/api/settings`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const getBody = await readJson(getRes);
    expect(getRes.status).toBe(200);
    expect(getBody.data).toEqual({ ai: { grokEnabled: true } });
  });
});

