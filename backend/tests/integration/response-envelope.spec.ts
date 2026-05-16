import { describe, it, expect } from 'vitest';
import { createAppFetch } from '../helpers/httpClient';

async function readJson(res: Response): Promise<any> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { _raw: text };
  }
}

describe('Response envelope (canonical)', () => {
  const request = createAppFetch();

  it('GET /api/health returns canonical envelope', async () => {
    const res = await request('/api/health');
    const body = await readJson(res);
    expect(res.status).toBe(200);
    expect(body.status).toBe('ok');
    expect(body.data).toBeTruthy();
    expect(body.data.ok).toBe(true);
  });

  it('GET /api/meta returns canonical envelope', async () => {
    const res = await request('/api/meta');
    const body = await readJson(res);
    expect(res.status).toBe(200);
    expect(body.status).toBe('ok');
    expect(body.data).toBeTruthy();
    expect(body.data.apiBasePath).toBe('/api');
  });
});
