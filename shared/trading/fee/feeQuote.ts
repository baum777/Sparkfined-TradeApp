import type { TerminalQuoteData, UiTokenAmount } from '../types';
import { computeFeeAmountBaseUnits, formatBaseUnitsToUi } from './feeEngine';

export interface JupiterQuoteResponseLike {
  outAmount: string; // integer string
  otherAmountThreshold: string; // integer string (min out after slippage)
  priceImpactPct?: string | number;
  routePlan?: unknown;
  platformFee?: {
    amount?: string; // integer string (in output mint base units)
    feeBps?: number;
  };
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

/**
 * Merge a provider (Jupiter) quote into a UI-ready preview.
 *
 * Notes:
 * - Jupiter `outAmount` / `otherAmountThreshold` represent user-received output amounts.
 * - Platform fee, when present, is taken from the output token.
 */
export function feeQuoteFromJupiter(params: {
  feeBps: number;
  outputMint: string;
  outputSymbol?: string;
  outputDecimals: number;
  quote: JupiterQuoteResponseLike;
}): Pick<TerminalQuoteData, 'expectedOut' | 'minOut' | 'feeBps' | 'feeAmountEstimate' | 'meta' | 'provider'> {
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

