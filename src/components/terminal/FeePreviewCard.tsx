import { useTerminalStore } from '@/lib/state/terminalStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatBaseUnitsToUi } from '../../../shared/trading/fee/feeEngine';

export function FeePreviewCard() {
  const quote = useTerminalStore((s) => s.quote);
  const side = useTerminalStore((s) => s.side);

  if (quote.status === 'loading') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Fee Preview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </CardContent>
      </Card>
    );
  }

  if (quote.status === 'error' || !quote.data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Fee Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {quote.status === 'error' ? 'Quote error' : 'Enter amount to see quote'}
          </p>
        </CardContent>
      </Card>
    );
  }

  const { expectedOut, minOut, feeBps, feeAmountEstimate } = quote.data;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fee Preview</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Expected {side === 'buy' ? 'Receive' : 'Pay'}</span>
          <span className="font-medium">
            {formatBaseUnitsToUi(
              BigInt(expectedOut.amountBaseUnits),
              expectedOut.decimals,
              6
            )}{' '}
            {expectedOut.symbol || 'TOKEN'}
          </span>
        </div>

        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Minimum {side === 'buy' ? 'Receive' : 'Pay'}</span>
          <span className="font-medium">
            {formatBaseUnitsToUi(
              BigInt(minOut.amountBaseUnits),
              minOut.decimals,
              6
            )}{' '}
            {minOut.symbol || 'TOKEN'}
          </span>
        </div>

        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Fee</span>
          <span className="font-medium">
            {(feeBps / 100).toFixed(2)}% (
            {formatBaseUnitsToUi(
              BigInt(feeAmountEstimate.amountBaseUnits),
              feeAmountEstimate.decimals,
              6
            )}{' '}
            {feeAmountEstimate.symbol || 'TOKEN'})
          </span>
        </div>

        {quote.data.meta?.priceImpactPct && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Price Impact</span>
            <span className="font-medium">
              {quote.data.meta.priceImpactPct.toFixed(2)}%
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

