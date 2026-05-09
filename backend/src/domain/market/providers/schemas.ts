import { z } from 'zod';

const dexSummarySchema = z.object({
  price_usd: z.number().optional(),
  fdv: z.number().optional(),
  liquidity_usd: z.number().optional(),
  ['24h']: z
    .object({
      volume_usd: z.number().optional(),
    })
    .optional(),
});

export const dexTokenResponseSchema = z.object({
  summary: dexSummarySchema.optional(),
});

export const moralisMetadataResponseSchema = z.object({
  holders: z.number().optional(),
});
