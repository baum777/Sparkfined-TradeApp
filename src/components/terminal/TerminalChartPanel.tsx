import { useEffect, useMemo, useState } from 'react';
import { ApiHttpError } from '@/services/api/client';
import {
  chartCandleService,
  type ChartCandle,
} from '@/lib/trading/chart/chartCandleService';
import { ChartPanel } from './ChartPanel';
import type { SolTimeframe } from '../../../shared/contracts/sol-chart-ta-journal';

interface TerminalChartPanelProps {
  baseMint?: string;
  quoteMint?: string;
  timeframe?: SolTimeframe;
}

type ChartLoadStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error';

function formatPairLabel(baseMint?: string, quoteMint?: string): string {
  if (!baseMint || !quoteMint) return 'Select a pair';
  return `${baseMint.slice(0, 4)}...${baseMint.slice(-4)} / ${quoteMint.slice(0, 4)}...${quoteMint.slice(-4)}`;
}

function getChartErrorMessage(error: unknown): string {
  if (error instanceof ApiHttpError && error.code === 'PROVIDER_UNAVAILABLE') {
    return 'Provider unavailable';
  }
  return error instanceof Error ? error.message : 'Unable to load chart candles';
}

export function TerminalChartPanel({
  baseMint,
  quoteMint,
  timeframe = '1m',
}: TerminalChartPanelProps) {
  const [candles, setCandles] = useState<ChartCandle[]>([]);
  const [status, setStatus] = useState<ChartLoadStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const pairLabel = useMemo(() => formatPairLabel(baseMint, quoteMint), [baseMint, quoteMint]);

  useEffect(() => {
    if (!baseMint || !quoteMint) {
      setCandles([]);
      setStatus('idle');
      setError(null);
      return;
    }

    let cancelled = false;
    setStatus('loading');
    setError(null);

    chartCandleService
      .getCandles({
        mint: baseMint,
        quoteMint,
        timeframe,
        limit: 168,
      })
      .then((nextCandles) => {
        if (cancelled) return;
        setCandles(nextCandles);
        setStatus(nextCandles.length > 0 ? 'ready' : 'empty');
      })
      .catch((loadError) => {
        if (cancelled) return;
        setCandles([]);
        setError(getChartErrorMessage(loadError));
        setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [baseMint, quoteMint, timeframe]);

  return (
    <ChartPanel
      candles={candles}
      status={status}
      error={error}
      pairLabel={pairLabel}
      timeframe={timeframe}
    />
  );
}
