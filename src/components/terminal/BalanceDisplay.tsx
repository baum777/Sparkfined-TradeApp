import React, { useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

interface BalanceDisplayProps {
  label: string;
  balance: string | null;
  symbol: string;
  onMax?: () => void;
  loading?: boolean;
}

// Sprint 3: P0-1 - Memoized component prevents re-render when parent updates
export const BalanceDisplay = React.memo(function BalanceDisplay({
  label,
  balance,
  symbol,
  onMax,
  loading,
}: BalanceDisplayProps) {
  // Sprint 3: Memoized disabled state computation
  const isDisabled = useMemo(
    () => loading || balance == null || balance === '',
    [loading, balance]
  );

  // Sprint 3: Stable callback prevents button re-render
  const handleMaxClick = useCallback(() => {
    onMax?.();
  }, [onMax]);

  // Sprint 3: Memoized balance text to prevent string reconstruction
  const balanceText = useMemo(() => {
    return balance != null ? `${balance} ${symbol}` : '--';
  }, [balance, symbol]);

  return (
    <div className="flex items-center justify-between text-sm" data-testid="balance-display">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        {loading ? (
          <Skeleton className="h-4 w-16" data-testid="balance-skeleton" />
        ) : (
          <span className="font-medium tabular-nums">{balanceText}</span>
        )}
        {onMax != null && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            onClick={handleMaxClick}
            disabled={isDisabled}
            data-testid="balance-max-button"
            aria-label="Set maximum amount"
          >
            Max
          </Button>
        )}
      </div>
    </div>
  );
});
