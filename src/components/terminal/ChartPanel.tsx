import { useEffect, useRef } from 'react';
import { createChart, CandlestickSeries, ColorType } from 'lightweight-charts';
import type { CandlestickData, UTCTimestamp } from 'lightweight-charts';
import { Card, CardContent } from '@/components/ui/card';

interface ChartPanelProps {
  baseMint?: string;
  quoteMint?: string;
}

/** Seeded random for consistent mock data per pair */
function seededUnit(base: string, salt: number): number {
  let hash = 2166136261 ^ salt;
  for (let i = 0; i < base.length; i++) {
    hash ^= base.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

function seededBetween(base: string, salt: number, min: number, max: number): number {
  return min + seededUnit(base, salt) * (max - min);
}

function generateMockCandles(baseMint: string, quoteMint: string, count: number): CandlestickData[] {
  const seedKey = `${baseMint}:${quoteMint}`;
  const basePrice = 50 + seededBetween(seedKey, 0, 0, 200);
  const candles: CandlestickData[] = [];
  let open = basePrice;
  const now = Math.floor(Date.now() / 1000) as UTCTimestamp;
  const intervalSeconds = 3600; // 1h candles

  for (let i = count - 1; i >= 0; i--) {
    const time = (now - i * intervalSeconds) as UTCTimestamp;
    const volatility = seededBetween(seedKey, i * 4, 0.005, 0.03);
    const change = (seededUnit(seedKey, i * 4 + 1) - 0.5) * 2 * volatility * open;
    const close = Math.max(open * 0.5, open + change);
    const high = Math.max(open, close) * (1 + seededUnit(seedKey, i * 4 + 2) * 0.01);
    const low = Math.min(open, close) * (1 - seededUnit(seedKey, i * 4 + 3) * 0.01);

    candles.push({
      time,
      open: Math.round(open * 100) / 100,
      high: Math.round(high * 100) / 100,
      low: Math.round(low * 100) / 100,
      close: Math.round(close * 100) / 100,
    });
    open = close;
  }

  return candles;
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

export function ChartPanel({ baseMint, quoteMint }: ChartPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof createChart> | null>(null);

  useEffect(() => {
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
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !baseMint || !quoteMint) return;

    const candles = generateMockCandles(baseMint, quoteMint, 168);
    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderDownColor: '#ef4444',
      borderUpColor: '#22c55e',
      wickDownColor: '#ef4444',
      wickUpColor: '#22c55e',
    });

    series.setData(candles);
    chart.timeScale().fitContent();

    return () => {
      chart.removeSeries(series);
    };
  }, [baseMint, quoteMint]);

  const pairLabel =
    baseMint && quoteMint
      ? `${baseMint.slice(0, 4)}...${baseMint.slice(-4)} / ${quoteMint.slice(0, 4)}...${quoteMint.slice(-4)}`
      : 'Select a pair';

  if (!baseMint || !quoteMint) {
    return (
      <Card className="h-full">
        <CardContent className="flex h-full items-center justify-center p-6">
          <div className="text-center text-muted-foreground">
            <p className="text-lg font-medium">{pairLabel}</p>
            <p className="mt-2 text-sm">Select a trading pair to view the chart</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full overflow-hidden">
      <CardContent className="relative h-full p-2">
        <p className="absolute left-4 top-2 z-10 text-sm font-medium text-muted-foreground">{pairLabel}</p>
        <div ref={containerRef} className="h-full w-full" style={{ minHeight: 200 }} />
      </CardContent>
    </Card>
  );
}
