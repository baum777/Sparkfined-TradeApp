import { useTerminalStore } from '@/lib/state/terminalStore';
import { Button } from '@/components/ui/button';

const QUICK_PERCENTAGES = [25, 50, 75, 100] as const;

export function QuickAmountButtons() {
  const side = useTerminalStore((s) => s.side);
  const amount = useTerminalStore((s) => s.amount);
  const setAmountValue = useTerminalStore((s) => s.setAmountValue);

  // In a real implementation, you would fetch wallet balance
  // For now, we'll use placeholder logic
  const handleQuickAmount = (percentage: number) => {
    // Placeholder: would calculate based on wallet balance
    // For MVP, we'll just set a placeholder value
    const placeholderAmount = (percentage / 100) * 100; // 100 as placeholder max
    setAmountValue(placeholderAmount.toFixed(2));
  };

  return (
    <div className="flex gap-2">
      {QUICK_PERCENTAGES.map((pct) => (
        <Button
          key={pct}
          variant="outline"
          size="sm"
          onClick={() => handleQuickAmount(pct)}
          className="flex-1"
        >
          {pct}%
        </Button>
      ))}
    </div>
  );
}

