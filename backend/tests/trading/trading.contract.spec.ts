/**
 * Trading Contract Tests: GET /api/quote, POST /api/swap
 * Baseline: validation + envelope (no network).
 * Gated: quote→swap happy path when E2E_JUPITER=1.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, type Server } from 'http';
import { createApp } from '../../src/app.js';

async function readJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { _raw: text };
  }
}

const KNOWN_GOOD_QUOTE_PARAMS =
  'baseMint=So11111111111111111111111111111111111111112' +
  '&quoteMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' +
  '&side=sell&amount=0.01&amountMode=base&slippageBps=50&feeBps=0';

describe('Trading contract (baseline, no network)', () => {
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

  it('GET /api/quote without params ⇒ 400 + INVALID_QUERY + details.requestId', async () => {
    const res = await fetch(`${baseUrl}/api/quote`);
    const body = await readJson(res);

    expect(res.status).toBe(400);
    expect(body.status).toBeUndefined();
    expect(body.error).toBeDefined();
    expect((body.error as Record<string, unknown>).code).toBe('INVALID_QUERY');
    expect((body.error as Record<string, unknown>).message).toBeTruthy();

    const details = (body.error as Record<string, unknown>).details as Record<string, unknown>;
    expect(details).toBeDefined();
    expect(typeof details.requestId).toBe('string');
    expect((details.requestId as string).length).toBeGreaterThan(0);
  });

  it('POST /api/swap with invalid body ⇒ 400 + VALIDATION_FAILED + details.requestId', async () => {
    const res = await fetch(`${baseUrl}/api/swap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const body = await readJson(res);

    expect(res.status).toBe(400);
    expect(body.status).toBeUndefined();
    expect(body.error).toBeDefined();
    expect((body.error as Record<string, unknown>).code).toBe('VALIDATION_FAILED');
    expect((body.error as Record<string, unknown>).message).toBeTruthy();

    const details = (body.error as Record<string, unknown>).details as Record<string, unknown>;
    expect(details).toBeDefined();
    expect(typeof details.requestId).toBe('string');
    expect((details.requestId as string).length).toBeGreaterThan(0);
  });

  it('400 responses: no status:"ok", must have .error', async () => {
    const quoteRes = await fetch(`${baseUrl}/api/quote`);
    const quoteBody = await readJson(quoteRes);

    expect(quoteBody.status).not.toBe('ok');
    expect(quoteBody.error).toBeDefined();
    expect((quoteBody.error as Record<string, unknown>).code).toBeTruthy();
    expect((quoteBody.error as Record<string, unknown>).message).toBeTruthy();

    const swapRes = await fetch(`${baseUrl}/api/swap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const swapBody = await readJson(swapRes);

    expect(swapBody.status).not.toBe('ok');
    expect(swapBody.error).toBeDefined();
  });
});

describe('Trading contract (gated: Jupiter E2E)', () => {
  const runE2E = process.env.E2E_JUPITER === '1';

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

  it.skipIf(!runE2E)(
    'quote→swap happy path (Jupiter reachable)',
    { timeout: 30000 },
    async () => {
      const quoteRes = await fetch(`${baseUrl}/api/quote?${KNOWN_GOOD_QUOTE_PARAMS}`);
      const quoteBody = await readJson(quoteRes);

      expect(quoteRes.status).toBe(200);
      expect(quoteBody.status).toBe('ok');
      expect(quoteBody.data).toBeDefined();

      const data = quoteBody.data as Record<string, unknown>;
      expect(data.provider).toBeDefined();
      const provider = data.provider as Record<string, unknown>;
      expect(provider.quoteResponse).toBeDefined();

      const providerQuote = provider.quoteResponse;

      const swapRes = await fetch(`${baseUrl}/api/swap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publicKey: '11111111111111111111111111111111',
          baseMint: 'So11111111111111111111111111111111111111112',
          quoteMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          side: 'sell',
          amount: '0.01',
          amountMode: 'base',
          slippageBps: 50,
          feeBps: 0,
          providerQuote,
        }),
      });
      const swapBody = await readJson(swapRes);

      expect(swapRes.status).toBe(200);
      expect(swapBody.status).toBe('ok');
      expect(swapBody.data).toBeDefined();

      const swapData = swapBody.data as Record<string, unknown>;
      expect(swapData.swapTransactionBase64).toBeDefined();
      expect(typeof swapData.swapTransactionBase64).toBe('string');
      expect((swapData.swapTransactionBase64 as string).length).toBeGreaterThan(0);
    }
  );
});
