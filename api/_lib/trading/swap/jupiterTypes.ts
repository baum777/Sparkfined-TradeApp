import type { JupiterQuoteResponseLike } from '../../../../shared/trading/fee/feeQuote';

export interface JupiterSwapResponseLike {
  swapTransaction: string;
  lastValidBlockHeight?: number;
  prioritizationFeeLamports?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isJupiterQuoteResponseLike(value: unknown): value is JupiterQuoteResponseLike {
  return isRecord(value) && typeof value.outAmount === 'string';
}

export function parseJupiterSwapResponse(value: unknown): JupiterSwapResponseLike | null {
  if (!isRecord(value)) return null;

  const swapTransaction = value.swapTransaction;
  if (typeof swapTransaction !== 'string' || swapTransaction.length === 0) {
    return null;
  }

  return {
    swapTransaction,
    lastValidBlockHeight: typeof value.lastValidBlockHeight === 'number' ? value.lastValidBlockHeight : undefined,
    prioritizationFeeLamports:
      typeof value.prioritizationFeeLamports === 'number' ? value.prioritizationFeeLamports : undefined,
  };
}
