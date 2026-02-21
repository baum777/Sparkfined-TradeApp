/**
 * Fee engine helpers (backend-local mirror of shared/trading/fee/feeEngine)
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
