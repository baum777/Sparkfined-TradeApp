import { z } from 'zod';
import type { InputCandle, SolTimeframe } from '../../domain/solChart/types.js';

export const chartCandleTimeframeSchema = z.enum(['15s', '30s', '1m', '5m', '15m', '30m', '1h', '4h']);

export const chartCandlesQuerySchema = z.object({
  mint: z.string().min(1, 'mint is required'),
  quoteMint: z.string().min(1, 'quoteMint is required'),
  timeframe: chartCandleTimeframeSchema,
  limit: z.coerce.number().int().min(1).max(500).default(168),
});

export const chartInputCandleSchema = z.object({
  ts: z.number().int().nonnegative(),
  open: z.number().finite(),
  high: z.number().finite(),
  low: z.number().finite(),
  close: z.number().finite(),
  volume: z.number().finite().nonnegative(),
});

export const chartCandlesResponseDataSchema = z.object({
  candles: z.array(chartInputCandleSchema),
});

export type ChartCandlesQuery = z.infer<typeof chartCandlesQuerySchema> & {
  timeframe: SolTimeframe;
};

export type ChartCandlesResponseData = {
  candles: InputCandle[];
};
