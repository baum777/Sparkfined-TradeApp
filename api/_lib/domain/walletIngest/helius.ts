import { z } from 'zod';

// Minimal Schema for Helius Enhanced Transaction
// We only validate what we need to avoid breaking on extra fields

const tokenTransferSchema = z.object({
  fromUserAccount: z.string().optional(),
  toUserAccount: z.string().optional(),
  mint: z.string(),
  tokenAmount: z.number(),
});

const nativeTransferSchema = z.object({
  fromUserAccount: z.string().optional(),
  toUserAccount: z.string().optional(),
  amount: z.number(),
});

const swapEventSchema = z.object({
  nativeInput: z.object({ amount: z.string() }).optional(),
  nativeOutput: z.object({ amount: z.string() }).optional(),
  tokenInputs: z.array(z.object({ mint: z.string(), rawTokenAmount: z.object({ tokenAmount: z.string() }) })).optional(),
  tokenOutputs: z.array(z.object({ mint: z.string(), rawTokenAmount: z.object({ tokenAmount: z.string() }) })).optional(),
});

export const heliusEnhancedTxSchema = z.object({
  signature: z.string(),
  timestamp: z.number(), // Unix seconds
  type: z.string(),
  tokenTransfers: z.array(tokenTransferSchema).optional(),
  nativeTransfers: z.array(nativeTransferSchema).optional(),
  events: z.object({
    swap: swapEventSchema.optional(),
  }).optional(),
  accountData: z.array(z.object({
    account: z.string(),
    nativeBalanceChange: z.number(),
    tokenBalanceChanges: z.array(z.object({
      mint: z.string(),
      rawTokenAmount: z.object({ tokenAmount: z.string() }),
    })).optional(),
  })).optional(),
  source: z.string().optional(),
});

export const heliusWebhookPayloadSchema = z.array(heliusEnhancedTxSchema);

export type HeliusEnhancedTx = z.infer<typeof heliusEnhancedTxSchema>;

