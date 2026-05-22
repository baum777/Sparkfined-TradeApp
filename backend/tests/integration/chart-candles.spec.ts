import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resetEnvCache } from '../../src/config/env';
import {
  resetChartCandleProviderForTesting,
  setChartCandleProviderForTesting,
} from '../../src/lib/chart/candleProvider';
import { createAppFetch } from '../helpers/httpClient';

async function readJson(res: Response): Promise<unknown> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { _raw: text };
  }
}

describe('GET /api/chart/candles', () => {
  const request = createAppFetch();

  beforeEach(() => {
    process.env.SERVICE_MODE = 'terminal';
    process.env.HELIUS_API_KEY = 'test-helius-api-key';
    resetEnvCache();
    resetChartCandleProviderForTesting();
  });

  afterEach(() => {
    delete process.env.SERVICE_MODE;
    delete process.env.HELIUS_API_KEY;
    resetEnvCache();
    resetChartCandleProviderForTesting();
  });

  it('returns canonical envelope and validated candle shape in terminal mode', async () => {
    setChartCandleProviderForTesting({
      async getCandles(query) {
        expect(query).toEqual({
          mint: 'So11111111111111111111111111111111111111112',
          quoteMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          timeframe: '1m',
          limit: 2,
        });
        return [
          { ts: 1_700_000_000_000, open: 100, high: 105, low: 98, close: 102, volume: 1_000 },
          { ts: 1_700_000_060_000, open: 102, high: 106, low: 101, close: 104, volume: 1_250 },
        ];
      },
    });

    const res = await request(
      '/api/chart/candles?mint=So11111111111111111111111111111111111111112&quoteMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&timeframe=1m&limit=2'
    );
    const body = await readJson(res);

    expect(res.status).toBe(200);
    expect(body).toHaveProperty('status', 'ok');
    expect(body).toHaveProperty('data.candles');

    const candles = (body as { data: { candles: unknown[] } }).data.candles;
    expect(candles).toHaveLength(2);
    expect(candles[0]).toEqual({
      ts: 1_700_000_000_000,
      open: 100,
      high: 105,
      low: 98,
      close: 102,
      volume: 1_000,
    });
  });

  it('rejects invalid timeframe and invalid limit before provider access', async () => {
    let providerCalls = 0;
    setChartCandleProviderForTesting({
      async getCandles() {
        providerCalls++;
        return [];
      },
    });

    const res = await request(
      '/api/chart/candles?mint=So11111111111111111111111111111111111111112&quoteMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&timeframe=2m&limit=999'
    );
    const body = await readJson(res);

    expect(res.status).toBe(400);
    expect(body).toHaveProperty('error.code', 'INVALID_QUERY');
    expect(providerCalls).toBe(0);
  });

  it('fails closed with PROVIDER_UNAVAILABLE and no synthetic candles when provider is not configured', async () => {
    const res = await request(
      '/api/chart/candles?mint=So11111111111111111111111111111111111111112&quoteMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&timeframe=1m&limit=168'
    );
    const body = await readJson(res);

    expect(res.status).toBe(503);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(body).toHaveProperty('error.code', 'PROVIDER_UNAVAILABLE');
    expect(body).toHaveProperty('error.details.provider', 'chart-candles');
    expect(body).not.toHaveProperty('data');
  });
});
