import React, { useCallback, useMemo } from 'react';
import { useTerminalStore } from '@/lib/state/terminalStore';
import { Button } from '@/components/ui/button';

const QUICK_PERCENTAGES = [25, 50, 75, 100] as const;

// Sprint 3: P0-1 - Memoized component to prevent re-render cascades
export const QuickAmountButtons = React.memo(function QuickAmountButtons() {
  // Sprint 3: Granular selectors - only re-render when these specific values change
  const setAmountValue = useTerminalStore((s) => s.setAmountValue);

  // Sprint 3: Stable callback using useCallback
  const handleQuickAmount = useCallback((percentage: number) => {
    // Placeholder: would calculate based on wallet balance
    const placeholderAmount = (percentage / 100) * 100; // 100 as placeholder max
    setAmountValue(placeholderAmount.toFixed(2));
  }, [setAmountValue]);

  // Sprint 3: Memoized buttons array to prevent inline object creation
  const buttons = useMemo(() => {
    return QUICK_PERCENTAGES.map((pct) => (
      <QuickAmountButton
        key={pct}
        percentage={pct}
        onClick={handleQuickAmount}
      />
    ));
  }, [handleQuickAmount]);

  return (
    <div className="flex gap-2" role="group" aria-label="Quick amount selection">
      {buttons}
    </div>
  );
});

// Sprint 3: P0-1 - Individual memoized button component
interface QuickAmountButtonProps {
  percentage: number;
  onClick: (percentage: number) => void;
}

const QuickAmountButton = React.memo(function QuickAmountButton({
  percentage,
  onClick,
}: QuickAmountButtonProps) {
  // Stable handler that doesn't recreate on every render
  const handleClick = useCallback(() => {
    onClick(percentage);
  }, [onClick, percentage]);

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      className="flex-1 h-8 px-2 text-xs focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      aria-label={`Set amount to ${percentage}%`}
    >
      {percentage}%
    </Button>
  );
});

