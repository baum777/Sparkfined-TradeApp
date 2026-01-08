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
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('status', 200);
    expect(Array.isArray(body.data)).toBe(true);
  });
 
  it('GET /api/feed/pulse exists and returns canonical envelope', async () => {
    const res = await fetch(`${baseUrl}/api/feed/pulse?asset=So11111111111111111111111111111111111111112`);
    const body = await readJson(res);
 
    expect(res.status).toBe(200);
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('status', 200);
    expect(body.data).toHaveProperty('asset');
    expect(body.data).toHaveProperty('source', 'pulse');
  });
 
  it('GET /api/signals/unified exists and returns canonical envelope', async () => {
    const res = await fetch(`${baseUrl}/api/signals/unified?asset=SOL`);
    const body = await readJson(res);
 
    expect(res.status).toBe(200);
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('status', 200);
    expect(body.data).toHaveProperty('items');
    expect(Array.isArray(body.data.items)).toBe(true);
  });
 
  it('GET /api/market/daily-bias aliases oracle daily feed', async () => {
    const res = await fetch(`${baseUrl}/api/market/daily-bias`);
    const body = await readJson(res);
 
    expect(res.status).toBe(200);
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('status', 200);
    expect(body.data).toHaveProperty('pinned');
    expect(body.data).toHaveProperty('insights');
  });
 
  it('GET /api/signals/unified without asset returns canonical error envelope', async () => {
    const res = await fetch(`${baseUrl}/api/signals/unified`);
    const body = await readJson(res);
 
    expect(res.status).toBe(400);
    expect(body).toHaveProperty('error');
    expect(body.error).toHaveProperty('code');
    expect(body.error).toHaveProperty('message');
  });
});

