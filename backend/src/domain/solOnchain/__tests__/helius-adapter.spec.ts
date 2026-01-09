import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resetEnvCache } from '../../../config/env.js';
import { HeliusAdapter } from '../adapters/helius.js';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('HeliusAdapter (SolanaOnchainProvider) - unit', () => {
  const mint = 'So11111111111111111111111111111111111111112';

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

  it('fingerprint is stable and cache-friendly', () => {
    const p = new HeliusAdapter();
    expect(p.fingerprint()).toBe('helius@2.0.0:a=1,h=1,f=1,l=1,r=1:flows:v2:enhanced:pages=6,limit=100');
  });

  it('getRiskFlags maps mint/freeze authority from DAS getAsset (and best-effort largeHolderDominance)', async () => {
    const fetchMock = vi.fn(async (url: any, init?: any) => {
      const body = init?.body ? JSON.parse(init.body) : null;
      if (url === 'https://das.test' && body?.method === 'getAsset') {
        return jsonResponse({
          jsonrpc: '2.0',
          id: '1',
          result: {
            token_info: {
              mint_authority: 'MintAuthPubkey',
              freeze_authority: null,
              supply: '1000',
              decimals: 0,
            },
          },
        });
      }
      if (url === 'https://rpc.test' && body?.method === 'getTokenSupply') {
        return jsonResponse({
          jsonrpc: '2.0',
          id: '1',
          result: { value: { amount: '1000', decimals: 0, uiAmountString: '1000' } },
        });
      }
      if (url === 'https://rpc.test' && body?.method === 'getTokenLargestAccounts') {
        return jsonResponse({
          jsonrpc: '2.0',
          id: '1',
          result: {
            value: Array.from({ length: 10 }, (_, i) => ({ address: `a${i}`, amount: '70' })),
          },
        });
      }
      throw new Error(`Unexpected fetch: ${String(url)} ${String(body?.method)}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const p = new HeliusAdapter();
    const out = await p.getRiskFlags({ mint, asOfTs: Date.now() });

    expect(out.available).toBe(true);
    expect(out.data.mintAuthorityActive?.value).toBe(true);
    expect(out.data.freezeAuthorityActive?.value).toBe(false);
    expect(out.data.mintAuthorityActive?.why).toContain('MintAuthPubkey');
    expect(out.data.freezeAuthorityActive?.why).toContain('null');
    expect(out.data.largeHolderDominance?.value).toBe(true);
  });

  it('getHolders computes concentrationTop10Pct from getTokenLargestAccounts + getTokenSupply', async () => {
    const fetchMock = vi.fn(async (url: any, init?: any) => {
      const body = init?.body ? JSON.parse(init.body) : null;
      if (url === 'https://rpc.test' && body?.method === 'getTokenSupply') {
        return jsonResponse({
          jsonrpc: '2.0',
          id: '1',
          result: { value: { amount: '1000', decimals: 0, uiAmountString: '1000' } },
        });
      }
      if (url === 'https://rpc.test' && body?.method === 'getTokenLargestAccounts') {
        return jsonResponse({
          jsonrpc: '2.0',
          id: '1',
          result: {
            value: Array.from({ length: 10 }, (_, i) => ({ address: `a${i}`, amount: '70' })),
          },
        });
      }
      throw new Error(`Unexpected fetch: ${String(url)} ${String(body?.method)}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const p = new HeliusAdapter();
    const out = await p.getHolders({ mint, windows: { short: '5m', baseline: '1h' }, asOfTs: Date.now() });

    expect(out.available).toBe(true);
    expect(out.data.holders.current).toBeNull();
    expect(out.data.concentrationTop10Pct).toBe(0.7);
    expect(out.notes ?? []).toContain('holders:holder_count_not_computed_v1');
  });

  it('getActivity paginates getTransactionsForAddress and stops after baseline cutoff', async () => {
    const asOfTs = 1_700_000_000_000;

    const page1 = {
      jsonrpc: '2.0',
      id: '1',
      result: {
        transactions: [
          { signature: 's1', blockTime: Math.floor((asOfTs - 60_000) / 1000) },
          { signature: 's2', blockTime: Math.floor((asOfTs - 100_000) / 1000) },
          { signature: 's3', blockTime: Math.floor((asOfTs - 400_000) / 1000) },
        ],
        paginationToken: 'p2',
      },
    };

    const page2 = {
      jsonrpc: '2.0',
      id: '1',
      result: {
        transactions: [
          { signature: 's4', blockTime: Math.floor((asOfTs - 3_700_000) / 1000) },
          { signature: 's5', blockTime: Math.floor((asOfTs - 3_800_000) / 1000) },
        ],
        paginationToken: 'p3',
      },
    };

    const fetchMock = vi.fn(async (url: any, init?: any) => {
      const body = init?.body ? JSON.parse(init.body) : null;
      if (url !== 'https://rpc.test') throw new Error(`Unexpected URL: ${String(url)}`);
      if (body?.method !== 'getTransactionsForAddress') throw new Error(`Unexpected method: ${String(body?.method)}`);
      const cfg = body?.params?.[1] ?? {};
      if (!cfg.paginationToken) return jsonResponse(page1);
      if (cfg.paginationToken === 'p2') return jsonResponse(page2);
      throw new Error(`Unexpected paginationToken: ${String(cfg.paginationToken)}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const p = new HeliusAdapter();
    const out = await p.getActivity({ mint, windows: { short: '5m', baseline: '1h' }, asOfTs });

    expect(out.available).toBe(true);
    expect(out.data.txCount.short).toBe(2);
    expect(out.data.txCount.baseline).toBe(3);
    expect(out.data.uniqueWallets.short).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('getFlows computes netInflowProxy and largeTransfersProxy from enhanced tokenTransfers (user-side heuristic)', async () => {
    const asOfTs = 1_700_000_000_000;
    // windows: short=5m, baseline=1h
    // Create transfers such that:
    // - inflow (toUserAccount only): +100 within short
    // - outflow (fromUserAccount only): -40 within short
    // baseline also contains an older outflow -10 (still within 1h)
    const enhancedPage1 = [
      {
        signature: 'sig1',
        timestamp: Math.floor((asOfTs - 60_000) / 1000),
        tokenTransfers: [{ mint, tokenAmount: 100, toUserAccount: 'u1' }],
      },
      {
        signature: 'sig2',
        timestamp: Math.floor((asOfTs - 120_000) / 1000),
        tokenTransfers: [{ mint, tokenAmount: 40, fromUserAccount: 'u2' }],
      },
      {
        signature: 'sig3',
        timestamp: Math.floor((asOfTs - 3_000_000) / 1000),
        tokenTransfers: [{ mint, tokenAmount: 10, fromUserAccount: 'u3' }],
      },
    ];

    const fetchMock = vi.fn(async (url: any, init?: any) => {
      const u = String(url);
      if (u.startsWith('https://api.helius.xyz/v0/addresses/') && u.includes('/transactions?')) {
        // Return one page, then empty (simulates pagination end once "before" cursor is used).
        if (u.includes('before=')) return jsonResponse([]);
        return jsonResponse(enhancedPage1);
      }
      const body = init?.body ? JSON.parse(init.body) : null;
      if (u === 'https://rpc.test' && body?.method === 'getTokenSupply') {
        return jsonResponse({
          jsonrpc: '2.0',
          id: '1',
          result: { value: { amount: '100000', decimals: 0, uiAmountString: '100000' } },
        });
      }
      throw new Error(`Unexpected fetch: ${u}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const p = new HeliusAdapter();
    const out = await p.getFlows({ mint, windows: { short: '5m', baseline: '1h' }, asOfTs });
    expect(out.available).toBe(true);
    expect(out.data.netInflowProxy.short).toBe(60); // 100 - 40
    expect(out.data.netInflowProxy.baseline).toBe(50); // (100) - (40+10)
    // Large transfers threshold: max(0.5% supply=500, p95=100) => 500, so 0 large transfers.
    expect(out.data.largeTransfersProxy?.short).toBe(0);
    expect(out.data.largeTransfersProxy?.baseline).toBe(0);
  });

  it('getLiquidity returns best-effort liquidityDeltaPct proxy from transfer volume rate', async () => {
    const asOfTs = 1_700_000_000_000;
    // baseline window 1h: include 2 directional transfers totaling 100 (baseline)
    // short window 5m: include 1 directional transfer totaling 50 (short)
    const enhancedPage1 = [
      {
        signature: 'sig1',
        timestamp: Math.floor((asOfTs - 60_000) / 1000),
        tokenTransfers: [{ mint, tokenAmount: 50, toUserAccount: 'u1' }],
      },
      {
        signature: 'sig2',
        timestamp: Math.floor((asOfTs - 3_000_000) / 1000),
        tokenTransfers: [{ mint, tokenAmount: 50, fromUserAccount: 'u2' }],
      },
    ];

    const fetchMock = vi.fn(async (url: any) => {
      const u = String(url);
      if (u.startsWith('https://api.helius.xyz/v0/addresses/') && u.includes('/transactions?')) {
        return jsonResponse(enhancedPage1);
      }
      throw new Error(`Unexpected fetch: ${u}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const p = new HeliusAdapter();
    const out = await p.getLiquidity({ mint, windows: { short: '5m', baseline: '1h' }, asOfTs });
    expect(out.available).toBe(true);
    expect(out.data.liquidityDeltaPct?.short).not.toBeNull();
  });
});

