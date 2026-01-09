import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, type Server } from 'http';
import { createApp } from '../../src/app';
 
async function readJson(res: Response): Promise<any> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { _raw: text };
  }
}
 
describe('Theme Group 5: Missing/Expected Endpoints (Feeds & Signals)', () => {
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
 
  it('GET /api/feed/oracle exists and returns canonical envelope', async () => {
    const res = await fetch(`${baseUrl}/api/feed/oracle?asset=SOL`);
    const body = await readJson(res);
 
    expect(res.status).toBe(200);
    expect(body).toHaveProperty('status', 'ok');
    expect(body).toHaveProperty('data');
    expect(Array.isArray(body.data)).toBe(true);
  });
 
  it('GET /api/feed/pulse exists and returns canonical envelope', async () => {
    const res = await fetch(`${baseUrl}/api/feed/pulse?asset=So11111111111111111111111111111111111111112`);
    const body = await readJson(res);
 
    expect(res.status).toBe(200);
    expect(body).toHaveProperty('status', 'ok');
    expect(body).toHaveProperty('data');
    expect(body.data).toHaveProperty('assetResolved');
    expect(body.data.assetResolved).toHaveProperty('kind', 'address');
    expect(body.data).toHaveProperty('snapshot');
    expect(body.data).toHaveProperty('history');
    expect(Array.isArray(body.data.history)).toBe(true);
  });

  it('GET /api/feed/pulse resolves ticker-like assets', async () => {
    const res = await fetch(`${baseUrl}/api/feed/pulse?asset=SOL`);
    const body = await readJson(res);

    expect(res.status).toBe(200);
    expect(body).toHaveProperty('status', 'ok');
    expect(body).toHaveProperty('data');
    expect(body.data).toHaveProperty('assetResolved');
    expect(body.data.assetResolved).toHaveProperty('kind', 'ticker');
    expect(body.data.assetResolved).toHaveProperty('symbol', 'SOL');
    expect(typeof body.data.assetResolved.address).toBe('string');
  });

  it('GET /api/feed/pulse invalid asset returns canonical validation error', async () => {
    const res = await fetch(`${baseUrl}/api/feed/pulse?asset=not$valid`);
    const body = await readJson(res);

    expect(res.status).toBe(400);
    expect(body).toHaveProperty('status', 'error');
    expect(body).toHaveProperty('error');
    expect(body.error).toHaveProperty('code', 'VALIDATION_ERROR');
  });

  it('GET /api/feed/pulse unknown ticker returns NOT_FOUND', async () => {
    const res = await fetch(`${baseUrl}/api/feed/pulse?asset=ZZZZZZ`);
    const body = await readJson(res);

    expect(res.status).toBe(404);
    expect(body).toHaveProperty('status', 'error');
    expect(body).toHaveProperty('error');
    expect(body.error).toHaveProperty('code', 'NOT_FOUND');
  });
 
  it('GET /api/signals/unified exists and returns canonical envelope', async () => {
    const res = await fetch(`${baseUrl}/api/signals/unified?asset=SOL`);
    const body = await readJson(res);
 
    expect(res.status).toBe(200);
    expect(body).toHaveProperty('status', 'ok');
    expect(body).toHaveProperty('data');
    expect(body.data).toHaveProperty('items');
    expect(Array.isArray(body.data.items)).toBe(true);
  });
 
  it('GET /api/market/daily-bias aliases oracle daily feed', async () => {
    const res = await fetch(`${baseUrl}/api/market/daily-bias`);
    const body = await readJson(res);
 
    expect(res.status).toBe(200);
    expect(body).toHaveProperty('status', 'ok');
    expect(body).toHaveProperty('data');
    expect(body.data).toHaveProperty('pinned');
    expect(body.data).toHaveProperty('insights');
  });
 
  it('GET /api/signals/unified without asset returns canonical error envelope', async () => {
    const res = await fetch(`${baseUrl}/api/signals/unified`);
    const body = await readJson(res);
 
    expect(res.status).toBe(400);
    expect(body).toHaveProperty('status', 'error');
    expect(body).toHaveProperty('error');
    expect(body.error).toHaveProperty('code');
    expect(body.error).toHaveProperty('message');
  });
});

