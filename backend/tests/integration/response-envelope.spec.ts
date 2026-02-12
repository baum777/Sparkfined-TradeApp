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

describe('Response envelope (canonical)', () => {
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

  it('GET /api/health returns canonical envelope', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    const body = await readJson(res);
    expect(res.status).toBe(200);
    expect(body.status).toBe('ok');
    expect(body.data).toBeTruthy();
    expect(body.data.ok).toBe(true);
  });

  it('GET /api/meta returns canonical envelope', async () => {
    const res = await fetch(`${baseUrl}/api/meta`);
    const body = await readJson(res);
    expect(res.status).toBe(200);
    expect(body.status).toBe('ok');
    expect(body.data).toBeTruthy();
    expect(body.data.apiBasePath).toBe('/api');
  });
});

