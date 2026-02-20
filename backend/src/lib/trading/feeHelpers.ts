/**
 * Fee helpers for trading (canonical backend)
 * Mirrors shared/trading/fee logic to avoid rootDir constraints.
 */

export function computeFeeAmountBaseUnits(notionalBaseUnits: bigint, feeBps: number): bigint {
  if (feeBps <= 0) return 0n;
  if (notionalBaseUnits <= 0n) return 0n;
  return (notionalBaseUnits * BigInt(feeBps)) / 10000n;
}

export function formatBaseUnitsToUi(amountBaseUnits: bigint, decimals: number, maxFractionDigits = 6): string {
  if (decimals < 0 || !Number.isFinite(decimals)) return amountBaseUnits.toString();

  const negative = amountBaseUnits < 0n;
  const a = negative ? -amountBaseUnits : amountBaseUnits;

  const base = 10n ** BigInt(decimals);
  const whole = a / base;
  const frac = a % base;

  if (decimals === 0) return `${negative ? '-' : ''}${whole.toString()}`;

  const fracStrFull = frac.toString().padStart(decimals, '0');
  const fracStrTrimmed = fracStrFull.replace(/0+$/, '');
  const fracStr = (maxFractionDigits >= 0 ? fracStrTrimmed.slice(0, maxFractionDigits) : fracStrTrimmed).replace(
    /0+$/,
    ''
  );

  if (!fracStr.length) return `${negative ? '-' : ''}${whole.toString()}`;
  return `${negative ? '-' : ''}${whole.toString()}.${fracStr}`;
}

/**
 * Parse UI decimal string to base units (integer) without floating point.
 */
export function parseUiAmountToBaseUnits(amountUi: string, decimals: number): bigint {
  const raw = amountUi.trim();
  if (!raw.length) return 0n;
  if (!/^\d+(\.\d+)?$/.test(raw)) return 0n;

  const [wholeStr, fracStr = ''] = raw.split('.');
  const whole = BigInt(wholeStr || '0');
  const fracPadded = (fracStr + '0'.repeat(decimals)).slice(0, decimals);
  const frac = fracPadded.length ? BigInt(fracPadded) : 0n;
  const base = 10n ** BigInt(decimals);
  return whole * base + frac;
}

export interface JupiterQuoteResponseLike {
  outAmount: string;
  otherAmountThreshold: string;
  priceImpactPct?: string | number;
  routePlan?: unknown;
  platformFee?: {
    amount?: string;
    feeBps?: number;
  };
}

interface UiTokenAmount {
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

/**
 * Merge a provider (Jupiter) quote into a UI-ready preview.
 */
export function feeQuoteFromJupiter(params: {
  feeBps: number;
  outputMint: string;
  outputSymbol?: string;
  outputDecimals: number;
  quote: JupiterQuoteResponseLike;
}) {
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
      name: 'jupiter' as const,
      quoteResponse: params.quote as unknown,
      feeMechanism: 'jupiter-platform-fee' as const,
    },
  };
}
