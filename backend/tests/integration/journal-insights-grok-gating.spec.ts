import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { createServer, type Server } from 'http';
import { createApp } from '../../src/app';
import { signToken } from '../../src/lib/auth/jwt';
import * as grokPulseAdapter from '../../src/domain/grokPulse/grokPulseAdapter';

async function readJson(res: Response): Promise<any> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { _raw: text };
  }
}

describe('Journal insights Grok gating', () => {
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

  it('includeGrok=true + tier<pro => 403 FORBIDDEN_TIER', async () => {
    const token = signToken({ userId: 'u-ins-free', tier: 'free' });

    const createRes = await fetch(`${baseUrl}/api/journal`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': 'idem-ins-1',
      },
      body: JSON.stringify({ summary: 'Entry' }),
    });
    const created = await readJson(createRes);
    expect(createRes.status).toBe(201);
    const id = created.data.id as string;

    const res = await fetch(`${baseUrl}/api/journal/${id}/insights`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ kind: 'teaser', includeGrok: true }),
    });
    const body = await readJson(res);
    expect(res.status).toBe(403);
    expect(body.error.code).toBe('FORBIDDEN_TIER');
  });

  it('includeGrok=true + pro but grokEnabled=false => 403 GROK_DISABLED', async () => {
    const token = signToken({ userId: 'u-ins-pro-off', tier: 'pro' });

    const createRes = await fetch(`${baseUrl}/api/journal`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': 'idem-ins-2',
      },
      body: JSON.stringify({ summary: 'Entry' }),
    });
    const created = await readJson(createRes);
    expect(createRes.status).toBe(201);
    const id = created.data.id as string;

    const res = await fetch(`${baseUrl}/api/journal/${id}/insights`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ kind: 'review', includeGrok: true }),
    });
    const body = await readJson(res);
    expect(res.status).toBe(403);
    expect(body.error.code).toBe('GROK_DISABLED');
  });

  it('includeGrok=false => never calls grokPulseAdapter', async () => {
    const token = signToken({ userId: 'u-ins-pro-nogrok', tier: 'pro' });

    const createRes = await fetch(`${baseUrl}/api/journal`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': 'idem-ins-3',
      },
      body: JSON.stringify({ summary: 'Entry' }),
    });
    const created = await readJson(createRes);
    expect(createRes.status).toBe(201);
    const id = created.data.id as string;

    const spy = vi.spyOn(grokPulseAdapter, 'getPulseFeedSnapshot');

    const res = await fetch(`${baseUrl}/api/journal/${id}/insights`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ kind: 'playbook', includeGrok: false }),
    });
    const body = await readJson(res);

    expect(res.status).toBe(200);
    expect(body.status).toBe('ok');
    expect(spy).not.toHaveBeenCalled();
  });
});

