import { useEffect, useRef } from 'react';
import { createChart, CandlestickSeries, ColorType } from 'lightweight-charts';
import type { CandlestickData, UTCTimestamp } from 'lightweight-charts';
import { Card, CardContent } from '@/components/ui/card';
import type { ChartCandle } from '@/lib/trading/chart/chartCandleService';
import type { SolTimeframe } from '../../../shared/contracts/sol-chart-ta-journal';

interface ChartPanelProps {
  candles: ChartCandle[];
  status: 'idle' | 'loading' | 'ready' | 'empty' | 'error';
  pairLabel: string;
  timeframe: SolTimeframe;
  error?: string | null;
}

const DARK_THEME = {
  layout: {
    background: { type: ColorType.Solid, color: 'transparent' },
    textColor: '#94a3b8',
  },
  grid: {
    vertLines: { color: 'rgba(148, 163, 184, 0.1)' },
    horzLines: { color: 'rgba(148, 163, 184, 0.1)' },
  },
  crosshair: {
    vertLine: { color: 'rgba(148, 163, 184, 0.5)' },
    horzLine: { color: 'rgba(148, 163, 184, 0.5)' },
  },
  rightPriceScale: {
    borderColor: 'rgba(148, 163, 184, 0.2)',
    scaleMargins: { top: 0.1, bottom: 0.2 },
  },
  timeScale: {
    borderColor: 'rgba(148, 163, 184, 0.2)',
    timeVisible: true,
    secondsVisible: false,
  },
};

function toSeriesData(candles: ChartCandle[]): CandlestickData[] {
  return candles.map((candle) => ({
    time: Math.floor(candle.ts / 1000) as UTCTimestamp,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
  }));
}

function ChartStateMessage({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <Card className="h-full">
      <CardContent className="flex h-full items-center justify-center p-6">
        <div className="text-center text-muted-foreground">
          <p className="text-lg font-medium">{title}</p>
          <p className="mt-2 text-sm">{message}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function ChartPanel({ candles, status, pairLabel, timeframe, error }: ChartPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof createChart> | null>(null);
  const shouldRenderChart = status === 'ready' && candles.length > 0;

  useEffect(() => {
    if (!shouldRenderChart) return;
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      ...DARK_THEME,
      width: container.clientWidth,
      height: container.clientHeight,
      autoSize: true,
    });

    chartRef.current = chart;

    const handleResize = () => {
      if (container && chartRef.current) {
        chartRef.current.applyOptions({ width: container.clientWidth, height: container.clientHeight });
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [shouldRenderChart]);

  useEffect(() => {
    if (!shouldRenderChart) return;
    const chart = chartRef.current;
    if (!chart) return;

    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderDownColor: '#ef4444',
      borderUpColor: '#22c55e',
      wickDownColor: '#ef4444',
      wickUpColor: '#22c55e',
    });

    series.setData(toSeriesData(candles));
    chart.timeScale().fitContent();

    return () => {
      chart.removeSeries(series);
    };
  }, [candles, shouldRenderChart]);

  if (status === 'idle') {
    return (
      <ChartStateMessage
        title={pairLabel}
        message="Select a trading pair to view the chart"
      />
    );
  }

  if (status === 'loading') {
    return <ChartStateMessage title={pairLabel} message="Loading chart candles..." />;
  }

  if (status === 'error') {
    const isProviderUnavailable =
      error?.toUpperCase().includes('PROVIDER_UNAVAILABLE') ||
      error?.toLowerCase().includes('provider unavailable');
    return (
      <ChartStateMessage
        title={isProviderUnavailable ? 'Provider unavailable' : 'Chart unavailable'}
        message={isProviderUnavailable ? 'Chart candle provider is currently unreachable.' : error ?? 'Unable to load chart candles'}
      />
    );
  }

  if (status === 'empty' || candles.length === 0) {
    return <ChartStateMessage title={pairLabel} message="No chart candles available" />;
  }

  return (
    <Card className="h-full overflow-hidden">
      <CardContent className="relative h-full p-2">
        <p className="absolute left-4 top-2 z-10 text-sm font-medium text-muted-foreground">
          {pairLabel} · {timeframe}
        </p>
        <div ref={containerRef} className="h-full w-full" style={{ minHeight: 200 }} />
      </CardContent>
    </Card>
  );
}
