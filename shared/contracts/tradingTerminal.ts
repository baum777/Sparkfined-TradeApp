/**
 * Trading Terminal API contract schemas (Zod)
 * Used for response shape validation in tests.
 */

import { z } from 'zod';

export const uiTokenAmountSchema = z.object({
  mint: z.string(),
  symbol: z.string().optional(),
  decimals: z.number(),
  amountBaseUnits: z.string(),
  amountUi: z.string(),
});

export const terminalQuoteDataSchema = z.object({
  expectedOut: uiTokenAmountSchema,
  minOut: uiTokenAmountSchema,
  feeBps: z.number(),
  feeAmountEstimate: uiTokenAmountSchema,
  meta: z
    .object({
      priceImpactPct: z.number().optional(),
      routeLabel: z.string().optional(),
    })
    .optional(),
  provider: z.object({
    name: z.literal('jupiter'),
    quoteResponse: z.unknown(),
    feeMechanism: z.enum(['jupiter-platform-fee', 'unknown']),
  }),
});

export const swapTxResultSchema = z.object({
  swapTransactionBase64: z.string(),
  lastValidBlockHeight: z.number().optional(),
  prioritizationFeeLamports: z.number().optional(),
});
