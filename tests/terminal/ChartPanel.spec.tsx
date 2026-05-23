// @vitest-environment jsdom

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { ApiHttpError } from '@/services/api/client';
import { ChartPanel } from '@/components/terminal/ChartPanel';
import { TerminalChartPanel } from '@/components/terminal/TerminalChartPanel';
import { chartCandleService, type ChartCandle } from '@/lib/trading/chart/chartCandleService';

const setDataMock = vi.fn();
const addSeriesMock = vi.fn(() => ({ setData: setDataMock }));
const removeSeriesMock = vi.fn();
const fitContentMock = vi.fn();
const removeMock = vi.fn();

vi.mock('lightweight-charts', () => ({
  CandlestickSeries: Symbol('CandlestickSeries'),
  ColorType: { Solid: 'solid' },
  createChart: vi.fn(() => ({
    addSeries: addSeriesMock,
    removeSeries: removeSeriesMock,
    timeScale: () => ({ fitContent: fitContentMock }),
    applyOptions: vi.fn(),
    remove: removeMock,
  })),
}));

vi.mock('@/lib/trading/chart/chartCandleService', async () => {
  const actual = await vi.importActual<typeof import('@/lib/trading/chart/chartCandleService')>(
    '@/lib/trading/chart/chartCandleService'
  );
  return {
    ...actual,
    chartCandleService: {
      getCandles: vi.fn(),
    },
  };
});

class ResizeObserverStub {
  observe = vi.fn();
  disconnect = vi.fn();
}

function createCandle(overrides: Partial<ChartCandle> = {}): ChartCandle {
  return {
    ts: 1_700_000_000_000,
    open: 100,
    high: 105,
    low: 95,
    close: 102,
    volume: 1_000,
    ...overrides,
  };
}

describe('ChartPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('ResizeObserver', ResizeObserverStub);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('renders only caller-provided candles and does not generate seeded chart data', async () => {
    const candles = [createCandle({ ts: 1_700_000_060_000, close: 104 })];

    render(
      <div style={{ width: 800, height: 400 }}>
        <ChartPanel
          candles={candles}
          status="ready"
          pairLabel="SOL / USDC"
          timeframe="1m"
        />
      </div>
    );

    await waitFor(() => expect(setDataMock).toHaveBeenCalledTimes(1));
    expect(setDataMock).toHaveBeenCalledWith([
      {
        time: 1_700_000_060,
        open: 100,
        high: 105,
        low: 95,
        close: 104,
      },
    ]);
  });

  it('renders provider-unavailable state without charting stale candles', () => {
    render(
      <ChartPanel
        candles={[createCandle()]}
        status="error"
        error="Provider unavailable"
        pairLabel="SOL / USDC"
        timeframe="1m"
      />
    );

    expect(screen.getByText('Provider unavailable')).toBeInTheDocument();
    expect(addSeriesMock).not.toHaveBeenCalled();
    expect(setDataMock).not.toHaveBeenCalled();
  });
});

describe('TerminalChartPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('ResizeObserver', ResizeObserverStub);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('loads candles from the canonical chart service for the selected pair', async () => {
    vi.mocked(chartCandleService.getCandles).mockResolvedValue([createCandle()]);

    render(
      <TerminalChartPanel
        baseMint="So11111111111111111111111111111111111111112"
        quoteMint="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
      />
    );

    await waitFor(() => {
      expect(chartCandleService.getCandles).toHaveBeenCalledWith({
        mint: 'So11111111111111111111111111111111111111112',
        quoteMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        timeframe: '1m',
        limit: 168,
      });
    });
  });

  it('surfaces provider-unavailable errors from the chart service', async () => {
    vi.mocked(chartCandleService.getCandles).mockRejectedValue(
      new ApiHttpError('Chart candle provider unavailable', 503, {
        code: 'PROVIDER_UNAVAILABLE',
      })
    );

    render(
      <TerminalChartPanel
        baseMint="So11111111111111111111111111111111111111112"
        quoteMint="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
      />
    );

    expect(await screen.findByText('Provider unavailable')).toBeInTheDocument();
    expect(setDataMock).not.toHaveBeenCalled();
  });
});
