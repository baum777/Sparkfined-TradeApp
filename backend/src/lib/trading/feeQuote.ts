/**
 * Fee quote from Jupiter (backend-local mirror of shared/trading/fee/feeQuote)
 */

import type { JupiterQuoteResponseLike } from './jupiterTypes.js';
import { computeFeeAmountBaseUnits, formatBaseUnitsToUi } from './feeEngine.js';

export interface UiTokenAmount {
  mint: string;
  symbol?: string;
  decimals: number;
  amountBaseUnits: string;
  amountUi: string;
}

function toUiTokenAmount(params: {
  mint: string;
  symbol?: string;
  decimals: number;
  amountBaseUnits: bigint;
}): UiTokenAmount {
  return {
    mint: params.mint,
    symbol: params.symbol,
    decimals: params.decimals,
    amountBaseUnits: params.amountBaseUnits.toString(),
    amountUi: formatBaseUnitsToUi(params.amountBaseUnits, params.decimals, 8),
  };
}

function parsePriceImpactPct(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

export interface TerminalQuoteDataPreview {
  expectedOut: UiTokenAmount;
  minOut: UiTokenAmount;
  feeBps: number;
  feeAmountEstimate: UiTokenAmount;
  meta?: { priceImpactPct?: number; routeLabel?: string };
  provider: {
    name: 'jupiter';
    quoteResponse: unknown;
    feeMechanism: 'jupiter-platform-fee' | 'unknown';
  };
}

export function feeQuoteFromJupiter(params: {
  feeBps: number;
  outputMint: string;
  outputSymbol?: string;
  outputDecimals: number;
  quote: JupiterQuoteResponseLike;
}): TerminalQuoteDataPreview {
  const outAmount = BigInt(params.quote.outAmount);
  const minOut = BigInt(params.quote.otherAmountThreshold);

  const platformFeeAmountBaseUnits =
    params.quote.platformFee?.amount && /^\d+$/.test(params.quote.platformFee.amount)
      ? BigInt(params.quote.platformFee.amount)
      : computeFeeAmountBaseUnits(outAmount, params.feeBps);

  const expectedOut = toUiTokenAmount({
    mint: params.outputMint,
    symbol: params.outputSymbol,
    decimals: params.outputDecimals,
    amountBaseUnits: outAmount,
  });

  const minOutAmount = toUiTokenAmount({
    mint: params.outputMint,
    symbol: params.outputSymbol,
    decimals: params.outputDecimals,
    amountBaseUnits: minOut,
  });

  const feeAmountEstimate = toUiTokenAmount({
    mint: params.outputMint,
    symbol: params.outputSymbol,
    decimals: params.outputDecimals,
    amountBaseUnits: platformFeeAmountBaseUnits,
  });

  const priceImpactPct = parsePriceImpactPct(params.quote.priceImpactPct);

  return {
    expectedOut,
    minOut: minOutAmount,
    feeBps: params.feeBps,
    feeAmountEstimate,
    meta: priceImpactPct !== undefined ? { priceImpactPct } : undefined,
    provider: {
      name: 'jupiter',
      quoteResponse: params.quote as unknown,
      feeMechanism: 'jupiter-platform-fee',
    },
  };
}
