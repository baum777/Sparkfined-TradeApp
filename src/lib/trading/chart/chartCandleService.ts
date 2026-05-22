import { apiClient } from '@/services/api/client';
import type { SolTimeframe } from '../../../../shared/contracts/sol-chart-ta-journal';

export interface ChartCandle {
  ts: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface GetChartCandlesParams {
  mint: string;
  quoteMint: string;
  timeframe: SolTimeframe;
  limit?: number;
}

interface ChartCandlesResponse {
  candles: ChartCandle[];
}

export const chartCandleService = {
  async getCandles(params: GetChartCandlesParams): Promise<ChartCandle[]> {
    const sp = new URLSearchParams();
    sp.set('mint', params.mint);
    sp.set('quoteMint', params.quoteMint);
    sp.set('timeframe', params.timeframe);
    if (params.limit !== undefined) {
      sp.set('limit', String(params.limit));
    }

    const response = await apiClient.get<ChartCandlesResponse>(`/chart/candles?${sp.toString()}`);
    if (!Array.isArray(response.candles)) {
      throw new Error('Invalid chart candle payload');
    }
    return response.candles;
  },
};
