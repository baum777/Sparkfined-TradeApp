import React, { useCallback, useMemo } from 'react';
import { useTerminalStore } from '@/lib/state/terminalStore';
import { Button } from '@/components/ui/button';

const QUICK_PERCENTAGES = [25, 50, 75, 100] as const;

interface QuickAmountButtonsProps {
  walletConnected?: boolean;
}

function formatAmount(value: number): string {
  if (!Number.isFinite(value)) return '';
  return value.toFixed(6).replace(/\.?0+$/, '');
}

// Sprint 3: P0-1 - Memoized component to prevent re-render cascades
export const QuickAmountButtons = React.memo(function QuickAmountButtons({
  walletConnected = true,
}: QuickAmountButtonsProps) {
  // Sprint 3: Granular selectors - only re-render when these specific values change
  const side = useTerminalStore((s) => s.side);
  const baseBalance = useTerminalStore((s) => s.balances.base);
  const quoteBalance = useTerminalStore((s) => s.balances.quote);
  const balancesLoading = useTerminalStore((s) => s.balances.loading);
  const setAmountValue = useTerminalStore((s) => s.setAmountValue);

  const spendableBalance = useMemo(() => {
    return side === 'buy' ? quoteBalance : baseBalance;
  }, [side, quoteBalance, baseBalance]);

  const spendableBalanceValue = useMemo(() => {
    if (!spendableBalance) return null;
    const parsed = Number(spendableBalance);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return parsed;
  }, [spendableBalance]);

  const isDisabled = !walletConnected || balancesLoading || spendableBalanceValue === null;

  // Sprint 3: Stable callback using useCallback
  const handleQuickAmount = useCallback(
    (percentage: number) => {
      if (spendableBalanceValue === null) return;
      const amount = (spendableBalanceValue * percentage) / 100;
      setAmountValue(formatAmount(amount));
    },
    [setAmountValue, spendableBalanceValue]
  );

  // Sprint 3: Memoized buttons array to prevent inline object creation
  const buttons = useMemo(() => {
    return QUICK_PERCENTAGES.map((pct) => (
      <QuickAmountButton
        key={pct}
        percentage={pct}
        onClick={handleQuickAmount}
        disabled={isDisabled}
      />
    ));
  }, [handleQuickAmount, isDisabled]);

  return (
    <div className="space-y-1">
      <div className="flex gap-2" role="group" aria-label="Quick amount selection">
        {buttons}
      </div>
      {isDisabled && (
        <p className="text-[10px] text-muted-foreground text-center">Balance unavailable</p>
      )}
    </div>
  );
});

// Sprint 3: P0-1 - Individual memoized button component
interface QuickAmountButtonProps {
  percentage: number;
  onClick: (percentage: number) => void;
  disabled: boolean;
}

const QuickAmountButton = React.memo(function QuickAmountButton({
  percentage,
  onClick,
  disabled,
}: QuickAmountButtonProps) {
  // Stable handler that doesn't recreate on every render
  const handleClick = useCallback(() => {
    if (disabled) return;
    onClick(percentage);
  }, [onClick, percentage, disabled]);

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={disabled}
      className="flex-1 h-8 px-2 text-xs focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      aria-label={`Set amount to ${percentage}%`}
    >
      {percentage}%
    </Button>
  );
});
