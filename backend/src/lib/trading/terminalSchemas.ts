/**
 * Zod schemas for terminal/swap API validation
 */

import { z } from 'zod';

const solanaAddressRegex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function isValidSolanaAddress(value: string): boolean {
  return solanaAddressRegex.test(value);
}

export const quoteQuerySchema = z.object({
  baseMint: z.string().min(32),
  quoteMint: z.string().min(32),
  side: z.enum(['buy', 'sell']),
  amount: z.string().min(1),
  amountMode: z.enum(['quote', 'base']),
  slippageBps: z.coerce.number().int().min(0).max(5000).default(50),
  feeBps: z.coerce.number().int().min(0).max(5000).default(65),
  priorityFeeEnabled: z.string().optional(),
  priorityFeeMicroLamports: z.coerce.number().int().min(0).max(500_000).optional(),
});

export const swapBodySchema = z.object({
  publicKey: z.string().min(32),
  baseMint: z.string().min(32),
  quoteMint: z.string().min(32),
  side: z.enum(['buy', 'sell']),
  amount: z.string().min(1),
  amountMode: z.enum(['quote', 'base']),
  slippageBps: z.number().int().min(0).max(5000),
  feeBps: z.number().int().min(0).max(5000),
  priorityFee: z
    .object({
      enabled: z.boolean(),
      microLamports: z.number().int().min(0).max(500_000).optional(),
    })
    .optional(),
  providerQuote: z.unknown().optional(),
});

export const discoverTokensQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(600).optional(),
  cursor: z.coerce.number().int().min(0).optional(),
});
