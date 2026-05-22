import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  chartCandleService,
  type ChartCandle,
} from '@/lib/trading/chart/chartCandleService';
import { apiClient, ApiHttpError } from '@/services/api/client';

const apiGetSpy = vi.spyOn(apiClient, 'get');

function createCandle(overrides: Partial<ChartCandle> = {}): ChartCandle {
  return {
    ts: 1_700_000_000_000,
    open: 100,
    high: 105,
    low: 98,
    close: 102,
    volume: 1_000,
    ...overrides,
  };
}

describe('chartCandleService.getCandles', () => {
  afterEach(() => {
    apiGetSpy.mockReset();
  });

  it('fetches chart candles through the canonical API client', async () => {
    const candles = [createCandle()];
    apiGetSpy.mockResolvedValue({ candles });

    const result = await chartCandleService.getCandles({
      mint: 'So11111111111111111111111111111111111111112',
      quoteMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      timeframe: '1m',
      limit: 168,
    });

    expect(apiGetSpy).toHaveBeenCalledWith(
      '/chart/candles?mint=So11111111111111111111111111111111111111112&quoteMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&timeframe=1m&limit=168'
    );
    expect(result).toEqual(candles);
  });

  it('propagates provider-unavailable errors without fallback candles', async () => {
    apiGetSpy.mockRejectedValue(
      new ApiHttpError('Chart candle provider unavailable', 503, {
        code: 'PROVIDER_UNAVAILABLE',
        details: { provider: 'chart-candles' },
      })
    );

    await expect(
      chartCandleService.getCandles({
        mint: 'So11111111111111111111111111111111111111112',
        quoteMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        timeframe: '1m',
      })
    ).rejects.toMatchObject({
      status: 503,
      code: 'PROVIDER_UNAVAILABLE',
    });
  });

  it('rejects non-array candle payloads', async () => {
    apiGetSpy.mockResolvedValue({ candles: null });

    await expect(
      chartCandleService.getCandles({
        mint: 'So11111111111111111111111111111111111111112',
        quoteMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        timeframe: '1m',
      })
    ).rejects.toThrow('Invalid chart candle payload');
  });
});
