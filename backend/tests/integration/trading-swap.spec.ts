import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { createServer, type Server } from 'http';
import { createApp } from '../../src/app';
import { resetEnvCache } from '../../src/config/env';
import { swapTxResultSchema } from '../contracts/tradingTerminal';

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

describe('POST /api/swap', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    process.env.HELIUS_API_KEY = 'test-helius-api-key';
    process.env.JUPITER_PLATFORM_FEE_ACCOUNT = '';
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
    process.env.JUPITER_PLATFORM_FEE_ACCOUNT = '';
    resetEnvCache();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns canonical envelope and valid swap shape with mocked Jupiter', async () => {
    const wsol = 'So11111111111111111111111111111111111111112';
    const usdc = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
    const pubkey = '11111111111111111111111111111111';

    const realFetch = globalThis.fetch;
    const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
      const u = String(url);
      // Only mock Jupiter API calls, not local server
      if (u.includes('quote-api.jup.ag') || u.includes('jup.ag')) {
        if (u.includes('/tokens')) {
          return jsonResponse([
            { address: wsol, symbol: 'SOL', decimals: 9, name: 'Wrapped SOL' },
            { address: usdc, symbol: 'USDC', decimals: 6, name: 'USD Coin' },
          ]);
        }
        if (u.includes('/swap')) {
          return jsonResponse({
            swapTransaction: 'dGVzdC1iYXNlNjQtdHhh',
            lastValidBlockHeight: 300000,
            prioritizationFeeLamports: 5000,
          });
        }
      }
      return realFetch(url, init);
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await fetch(`${baseUrl}/api/swap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        publicKey: pubkey,
        baseMint: wsol,
        quoteMint: usdc,
        side: 'buy',
        amount: '1',
        amountMode: 'quote',
        slippageBps: 50,
        feeBps: 0,
        providerQuote: { outAmount: '1000000', otherAmountThreshold: '950000' },
      }),
    });
    const body = await readJson(res);

    expect(res.status).toBe(200);
    expect(body).toHaveProperty('status', 'ok');
    expect(body).toHaveProperty('data');
    const data = (body as { data: unknown }).data;
    const parsed = swapTxResultSchema.safeParse(data);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.swapTransactionBase64).toBe('dGVzdC1iYXNlNjQtdHhh');
    }
  });

  it('returns 400 for missing providerQuote', async () => {
    const res = await fetch(`${baseUrl}/api/swap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        publicKey: '11111111111111111111111111111111',
        baseMint: 'So11111111111111111111111111111111111111112',
        quoteMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        side: 'buy',
        amount: '1',
        amountMode: 'quote',
        slippageBps: 50,
        feeBps: 0,
      }),
    });
    const body = await readJson(res);

    expect(res.status).toBe(400);
    expect(body).toHaveProperty('error');
  });
});
