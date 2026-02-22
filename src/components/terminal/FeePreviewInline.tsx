import React, { useMemo } from 'react';
import { useTerminalStore } from '@/lib/state/terminalStore';
import { Skeleton } from '@/components/ui/skeleton';
import { formatBaseUnitsToUi } from '../../../shared/trading/fee/feeEngine';

// Label constants to match FeePreviewCard and confirm dialog
const LABELS = {
  expected: (side: 'buy' | 'sell') => `Expected ${side === 'buy' ? 'Receive' : 'Pay'}`,
  minimum: (side: 'buy' | 'sell') => `Minimum ${side === 'buy' ? 'Receive' : 'Pay'}`,
  fee: 'Fee',
  priceImpact: 'Price Impact',
  quotePlaceholder: 'Enter amount to see quote',
} as const;

// Sprint 3: P0-1 - Memoized component with granular selectors
// Only re-renders when quote-related fields change, not when unrelated store fields update
export const FeePreviewInline = React.memo(function FeePreviewInline() {
  // Sprint 3: Granular selectors - extract only primitive values needed
  const quoteStatus = useTerminalStore((s) => s.quote.status);
  const quoteData = useTerminalStore((s) => s.quote.data);
  const quoteError = useTerminalStore((s) => s.quote.error);
  const side = useTerminalStore((s) => s.side);
  const slippageBps = useTerminalStore((s) => s.slippageBps);

  // Sprint 3: Memoized slippage label to prevent recalculation
  const slippageLabel = useMemo(() => `${(slippageBps / 100).toFixed(1)}%`, [slippageBps]);

  if (quoteStatus === 'loading') {
    return (
      <div className="space-y-2 py-2 px-3 bg-muted/50 rounded-md" aria-live="polite" aria-busy="true">
        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-24" />
        </div>
        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
    );
  }

  if (quoteStatus === 'error' || !quoteData) {
    return (
      <div className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-md text-xs text-muted-foreground">
        <span>{LABELS.quotePlaceholder}</span>
        <span className="tabular-nums">Slippage {slippageLabel}</span>
      </div>
    );
  }

  // Sprint 3: Destructure only once quoteData is confirmed present
  const { expectedOut, minOut, feeBps, feeAmountEstimate, meta } = quoteData;
  const priceImpact = meta?.priceImpactPct ?? 0;

  // Sprint 3: Memoized formatting to prevent repeated BigInt conversions
  const {
    minOutFormatted,
    expectedOutFormatted,
    feeFormatted,
    hasMeaningfulMinimum,
  } = useMemo(() => {
    const min = formatBaseUnitsToUi(BigInt(minOut.amountBaseUnits), minOut.decimals, 6);
    const exp = formatBaseUnitsToUi(BigInt(expectedOut.amountBaseUnits), expectedOut.decimals, 6);
    const fee = formatBaseUnitsToUi(BigInt(feeAmountEstimate.amountBaseUnits), feeAmountEstimate.decimals, 6);
    return {
      minOutFormatted: min,
      expectedOutFormatted: exp,
      feeFormatted: fee,
      hasMeaningfulMinimum: min !== exp,
    };
  }, [minOut, expectedOut, feeAmountEstimate]);

  // Memoized fee percentage to prevent toFixed recalculation
  const feePercent = useMemo(() => `${(feeBps / 100).toFixed(2)}%`, [feeBps]);

  return (
    <div className="space-y-1.5 py-2 px-3 bg-muted/50 rounded-md" aria-live="polite">
      {/* Row 1: Expected Receive/Pay */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{LABELS.expected(side)}</span>
        <span className="font-medium tabular-nums">
          {expectedOutFormatted} {expectedOut.symbol || 'TOKEN'}
        </span>
      </div>

      {/* Row 2: Minimum Receive/Pay (only if differs from expected) */}
      {hasMeaningfulMinimum ? (
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">{LABELS.minimum(side)}</span>
          <span className="font-medium tabular-nums text-muted-foreground">
            {minOutFormatted} {minOut.symbol || 'TOKEN'}
          </span>
        </div>
      ) : (
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">{LABELS.minimum(side)}</span>
          <span className="font-medium tabular-nums text-muted-foreground/50">—</span>
        </div>
      )}

      {/* Row 3: Fee (matches FeePreviewCard format: % + amount) */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">
          {LABELS.fee} ({feePercent})
        </span>
        <span className="font-medium tabular-nums">
          {feeFormatted} {feeAmountEstimate.symbol || 'TOKEN'}
        </span>
      </div>

      {/* Row 4: Price Impact (if present) */}
      {priceImpact > 0 && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">{LABELS.priceImpact}</span>
          <span className={`font-medium tabular-nums ${priceImpact > 1 ? 'text-amber-500' : ''}`}>
            {priceImpact.toFixed(2)}%
          </span>
        </div>
      )}
    </div>
  );
});
