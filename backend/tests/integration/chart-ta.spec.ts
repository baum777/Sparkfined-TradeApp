import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { createServer, type Server } from 'http';
import { createApp } from '../../src/app';
import { resetEnvCache } from '../../src/config/env';
import type { InputCandle } from '../../src/domain/solChart/types';
import { buildChartFeaturePackWithCacheMeta } from '../../src/domain/solChart/builder';
import { generateSetupCardsFromChart } from '../../src/domain/solChartAnalysis/setupGenerator';

async function readJson(res: Response): Promise<any> {
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

function mkTrendUpCandles(count = 80, startTs = 1_700_000_000_000, stepMs = 60_000): InputCandle[] {
  const out: InputCandle[] = [];
  for (let i = 0; i < count; i++) {
    const base = 1 + i * 0.01;
    out.push({
      ts: startTs + i * stepMs,
      open: base,
      high: base + 0.01,
      low: base - 0.01,
      close: base + 0.005,
      volume: 100 + (i % 7) * 10,
    });
  }
  return out;
}

describe('POST /api/chart/ta (Chart → Setups → Onchain → Gates → Sort → Response)', () => {
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

  beforeEach(() => {
    process.env.HELIUS_API_KEY = 'test-helius-api-key';
    process.env.HELIUS_RPC_URL = 'https://rpc.test';
    process.env.HELIUS_DAS_RPC_URL = 'https://das.test';
    process.env.HELIUS_TIMEOUT_MS = '1000';
    resetEnvCache();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('Case A: tier=free, setups>0 → 0 Enhanced Tx calls + confidence identisch zu base', async () => {
    const mint = 'So11111111111111111111111111111111111111112';
    const candles = mkTrendUpCandles();

    // Base setups (deterministic, chart-only)
    const chart = buildChartFeaturePackWithCacheMeta({ mint, timeframe: '1m', candles }).pack;
    const setupsBase = generateSetupCardsFromChart(chart, { tier: 'free', taskKind: 'chart_setups' });
    expect(setupsBase.length).toBeGreaterThan(0);

    const realFetch = globalThis.fetch;
    let enhancedCalls = 0;
    const fetchMock = vi.fn(async (url: any, init?: any) => {
      const u = String(url);
      if (u.startsWith('https://api.helius.xyz/v0/addresses/')) {
        enhancedCalls++;
        return jsonResponse([], 200);
      }
      const body = init?.body ? JSON.parse(init.body) : null;
      if (u === 'https://das.test' && body?.method === 'getAsset') {
        return jsonResponse({ jsonrpc: '2.0', id: '1', result: { token_info: { mint_authority: null, freeze_authority: null, supply: '1000', decimals: 0 } } });
      }
      if (u === 'https://rpc.test' && body?.method === 'getTokenSupply') {
        return jsonResponse({ jsonrpc: '2.0', id: '1', result: { value: { amount: '1000', decimals: 0, uiAmountString: '1000' } } });
      }
      if (u === 'https://rpc.test' && body?.method === 'getTokenLargestAccounts') {
        return jsonResponse({ jsonrpc: '2.0', id: '1', result: { value: Array.from({ length: 10 }, (_, i) => ({ address: `a${i}`, amount: '1' })) } });
      }
      if (u === 'https://rpc.test' && body?.method === 'getTransactionsForAddress') {
        return jsonResponse({ jsonrpc: '2.0', id: '1', result: { transactions: [], paginationToken: null } });
      }
      // Allow the test to call the local HTTP server via fetch().
      return await realFetch(url, init);
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await fetch(`${baseUrl}/api/chart/ta`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mint, timeframe: '1m', candles, tier: 'free', taskKind: 'chart_setups' }),
    });
    const body = await readJson(res);

    expect(res.status).toBe(200);
    expect(body.status).toBe('ok');
    expect(enhancedCalls).toBe(0);
    expect(body.data.json.plan.map((s: any) => s.confidence)).toEqual(setupsBase.map(s => s.confidence));
  });

  it('Case B: hasSetups=false, tier=pro → 0 Enhanced Tx calls', async () => {
    const mint = 'So11111111111111111111111111111111111111112';
    const candles = mkTrendUpCandles();

    const realFetch = globalThis.fetch;
    let enhancedCalls = 0;
    const fetchMock = vi.fn(async (url: any, init?: any) => {
      const u = String(url);
      if (u.startsWith('https://api.helius.xyz/v0/addresses/')) {
        enhancedCalls++;
        return jsonResponse([], 200);
      }
      const body = init?.body ? JSON.parse(init.body) : null;
      if (u === 'https://das.test' && body?.method === 'getAsset') {
        return jsonResponse({ jsonrpc: '2.0', id: '1', result: { token_info: { mint_authority: null, freeze_authority: null, supply: '1000', decimals: 0 } } });
      }
      if (u === 'https://rpc.test' && body?.method === 'getTokenSupply') {
        return jsonResponse({ jsonrpc: '2.0', id: '1', result: { value: { amount: '1000', decimals: 0, uiAmountString: '1000' } } });
      }
      if (u === 'https://rpc.test' && body?.method === 'getTokenLargestAccounts') {
        return jsonResponse({ jsonrpc: '2.0', id: '1', result: { value: Array.from({ length: 10 }, (_, i) => ({ address: `a${i}`, amount: '1' })) } });
      }
      if (u === 'https://rpc.test' && body?.method === 'getTransactionsForAddress') {
        return jsonResponse({ jsonrpc: '2.0', id: '1', result: { transactions: [], paginationToken: null } });
      }
      return await realFetch(url, init);
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await fetch(`${baseUrl}/api/chart/ta`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // taskKind intentionally returns [] in generator, ensuring hasSetups=false.
      body: JSON.stringify({ mint, timeframe: '1m', candles, tier: 'pro', taskKind: 'chart_teaser_free' }),
    });
    const body = await readJson(res);

    expect(res.status).toBe(200);
    expect(body.status).toBe('ok');
    expect(body.data.json.plan.length).toBe(0);
    expect(enhancedCalls).toBe(0);
  });

  it('Case C: tier=pro, setups>0 → Enhanced Tx calls >0 + confidence geändert (geclamped)', async () => {
    const mint = 'So11111111111111111111111111111111111111112';
    const candles = mkTrendUpCandles();

    // Base setups (chart-only)
    const chart = buildChartFeaturePackWithCacheMeta({ mint, timeframe: '1m', candles }).pack;
    const setupsBase = generateSetupCardsFromChart(chart, { tier: 'pro', taskKind: 'chart_setups' });
    expect(setupsBase.length).toBeGreaterThan(0);

    const realFetch = globalThis.fetch;
    let enhancedCalls = 0;
    const enhancedTxs = [
      // Minimal single tx so the enhanced endpoint is exercised deterministically.
      {
        signature: 's1',
        timestamp: Math.floor(1_700_000_000_000 / 1000),
        events: { swap: { tokenInputs: [{ mint: 'USDC', rawTokenAmount: { tokenAmount: '1000' } }], tokenOutputs: [{ mint, rawTokenAmount: { tokenAmount: '1000' } }] } },
        tokenTransfers: [{ mint, tokenAmount: 1 }],
      },
    ];

    const fetchMock = vi.fn(async (url: any, init?: any) => {
      const u = String(url);
      if (u.startsWith('https://api.helius.xyz/v0/addresses/')) {
        enhancedCalls++;
        // First page: data, second page: stop.
        if (u.includes('before=')) return jsonResponse([], 200);
        return jsonResponse(enhancedTxs, 200);
      }
      const body = init?.body ? JSON.parse(init.body) : null;
      if (u === 'https://das.test' && body?.method === 'getAsset') {
        // Force a deterministic confidence penalty via risk flag.
        return jsonResponse({ jsonrpc: '2.0', id: '1', result: { token_info: { mint_authority: 'MintAuthPubkey', freeze_authority: null, supply: '1000', decimals: 0 } } });
      }
      if (u === 'https://rpc.test' && body?.method === 'getTokenSupply') {
        return jsonResponse({ jsonrpc: '2.0', id: '1', result: { value: { amount: '1000', decimals: 0, uiAmountString: '1000' } } });
      }
      if (u === 'https://rpc.test' && body?.method === 'getTokenLargestAccounts') {
        return jsonResponse({ jsonrpc: '2.0', id: '1', result: { value: Array.from({ length: 10 }, (_, i) => ({ address: `a${i}`, amount: '1' })) } });
      }
      if (u === 'https://rpc.test' && body?.method === 'getTransactionsForAddress') {
        return jsonResponse({ jsonrpc: '2.0', id: '1', result: { transactions: [], paginationToken: null } });
      }
      return await realFetch(url, init);
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await fetch(`${baseUrl}/api/chart/ta`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mint, timeframe: '1m', candles, tier: 'pro', taskKind: 'chart_setups', chartContext: { nearResistance: true } }),
    });
    const body = await readJson(res);

    expect(res.status).toBe(200);
    expect(body.status).toBe('ok');
    expect(enhancedCalls).toBeGreaterThan(0);

    const outPlan = body.data.json.plan;
    expect(outPlan.length).toBeGreaterThan(0);
    expect(outPlan[0].confidence).toBeGreaterThanOrEqual(0);
    expect(outPlan[0].confidence).toBeLessThanOrEqual(1);
    expect(outPlan[0].confidence).not.toBe(setupsBase[0]!.confidence);
  });
});

