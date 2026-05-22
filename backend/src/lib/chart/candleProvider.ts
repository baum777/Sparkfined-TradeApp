import type { InputCandle } from '../../domain/solChart/types.js';
import {
  chartCandlesResponseDataSchema,
  type ChartCandlesQuery,
} from './candleSchemas.js';

export class ChartCandleProviderUnavailableError extends Error {
  readonly provider: string;

  constructor(message = 'Chart candle provider unavailable', provider = 'chart-candles') {
    super(message);
    this.name = 'ChartCandleProviderUnavailableError';
    this.provider = provider;
  }
}

export interface ChartCandleProvider {
  getCandles(query: ChartCandlesQuery): Promise<InputCandle[]>;
}

const unavailableProvider: ChartCandleProvider = {
  async getCandles() {
    throw new ChartCandleProviderUnavailableError();
  },
};

let activeProvider: ChartCandleProvider = unavailableProvider;

export async function getChartCandles(query: ChartCandlesQuery): Promise<InputCandle[]> {
  const candles = await activeProvider.getCandles(query);
  const parsed = chartCandlesResponseDataSchema.safeParse({ candles });

  if (!parsed.success) {
    throw new ChartCandleProviderUnavailableError('Chart candle provider returned invalid candle payload');
  }

  return parsed.data.candles;
}

export function setChartCandleProviderForTesting(provider: ChartCandleProvider): void {
  activeProvider = provider;
}

export function resetChartCandleProviderForTesting(): void {
  activeProvider = unavailableProvider;
}
