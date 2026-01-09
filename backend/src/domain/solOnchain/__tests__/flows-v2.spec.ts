import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resetEnvCache } from '../../../config/env.js';
import { HeliusAdapter } from '../adapters/helius.js';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

describe('HeliusAdapter flows v2 (enhanced swaps) - unit', () => {
  const mint = 'So11111111111111111111111111111111111111112';

  beforeEach(() => {
    process.env.HELIUS_API_KEY = 'test-helius-api-key';
    resetEnvCache();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('computes signed netInflowProxy + largeTransfersProxy (pro/high shape)', async () => {
    // asOfTs is ms; enhanced tx timestamp is seconds.
    const asOfTs = 1_700_000_000_000;
    const asOfSec = Math.floor(asOfTs / 1000);

    // Create baseline+short swaps:
    // - baseline: 4 buys, 6 sells (net -2)
    // - short: 6 buys, 2 sells (net +4)
    // Large amounts: one big buy in baseline (p95 threshold) and one big buy in short.
    const txs = [
      // within short window (5m): recent
      ...Array.from({ length: 6 }, (_, i) => ({
        signature: `sb${i}`,
        timestamp: asOfSec - 60 * i,
        events: {
          swap: {
            tokenInputs: [{ mint: 'USDC', rawTokenAmount: { tokenAmount: '1000' } }],
            tokenOutputs: [{ mint, rawTokenAmount: { tokenAmount: i === 0 ? '9999999' : '1000' } }],
          },
        },
      })),
      ...Array.from({ length: 2 }, (_, i) => ({
        signature: `ss${i}`,
        timestamp: asOfSec - 120 * i,
        events: {
          swap: {
            tokenInputs: [{ mint, rawTokenAmount: { tokenAmount: '1000' } }],
            tokenOutputs: [{ mint: 'USDC', rawTokenAmount: { tokenAmount: '1000' } }],
          },
        },
      })),

      // baseline-only (1h): older but still within baseline cutoff
      ...Array.from({ length: 4 }, (_, i) => ({
        signature: `bb${i}`,
        timestamp: asOfSec - (10 * 60) - 60 * i,
        events: {
          swap: {
            tokenInputs: [{ mint: 'USDC', rawTokenAmount: { tokenAmount: '1000' } }],
            tokenOutputs: [{ mint, rawTokenAmount: { tokenAmount: i === 0 ? '8888888' : '1000' } }],
          },
        },
      })),
      ...Array.from({ length: 6 }, (_, i) => ({
        signature: `bs${i}`,
        timestamp: asOfSec - (15 * 60) - 60 * i,
        events: {
          swap: {
            tokenInputs: [{ mint, rawTokenAmount: { tokenAmount: '1000' } }],
            tokenOutputs: [{ mint: 'USDC', rawTokenAmount: { tokenAmount: '1000' } }],
          },
        },
      })),
    ];

    const fetchMock = vi.fn(async (url: any) => {
      const u = String(url);
      if (!u.startsWith('https://api.helius.xyz/v0/addresses/')) throw new Error(`Unexpected URL: ${u}`);
      // Single page then stop.
      if (u.includes('before=')) return jsonResponse([], 200);
      return jsonResponse(txs, 200);
    });
    vi.stubGlobal('fetch', fetchMock);

    const p = new HeliusAdapter({ enhancedMaxPages: 6, enhancedLimit: 100 });
    const out = await p.getFlows({ mint, windows: { short: '5m', baseline: '1h' }, asOfTs });

    expect(out.available).toBe(true);
    expect(out.data.netInflowProxy.short).not.toBeNull();
    expect(out.data.netInflowProxy.baseline).not.toBeNull();
    // Signed proxy: short net should be > baseline net in this fixture.
    expect((out.data.netInflowProxy.short ?? 0)).toBeGreaterThan((out.data.netInflowProxy.baseline ?? 0));

    expect(out.data.largeTransfersProxy?.short).not.toBeNull();
    expect(out.data.largeTransfersProxy?.baseline).not.toBeNull();
    expect((out.notes ?? []).join(' ')).toContain('best-effort proxy from tokenTransfers; not exchange-identified flows');
  });
});

