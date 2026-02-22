import React, { useCallback, useMemo } from 'react';
import { useTerminalStore } from '@/lib/state/terminalStore';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { AlertTriangle } from 'lucide-react';

const SLIPPAGE_OPTIONS = [
  { label: '0.1%', value: 10 },
  { label: '0.5%', value: 50 },
  { label: '1%', value: 100 },
  { label: '3%', value: 300 },
] as const;

// Sprint 3: P0-1 - Precomputed option values to avoid map/filter in render
const SLIPPAGE_VALUES = SLIPPAGE_OPTIONS.map((opt) => opt.value);

// Sprint 3: P0-1 - Memoized component to prevent unnecessary re-renders
export const SlippageSelectorCompact = React.memo(function SlippageSelectorCompact() {
  const slippageBps = useTerminalStore((s) => s.slippageBps);
  const setSlippageBps = useTerminalStore((s) => s.setSlippageBps);

  // Sprint 3: Memoized custom detection - only recalculate when slippageBps changes
  const { isCustom, currentValue } = useMemo(() => {
    const custom = !SLIPPAGE_VALUES.some((val) => val === slippageBps);
    return {
      isCustom: custom,
      currentValue: slippageBps,
    };
  }, [slippageBps]);

  // Sprint 3: Stable callback for toggle changes
  const handleValueChange = useCallback(
    (value: string) => {
      if (value) {
        setSlippageBps(Number(value));
      }
    },
    [setSlippageBps]
  );

  // Sprint 3: Memoized formatted custom value
  const customLabel = useMemo(() => {
    return `${(slippageBps / 100).toFixed(2)}%`;
  }, [slippageBps]);

  return (
    <div className="space-y-2">
      {/* Header: Label only (custom pill shown inline to reduce noise) */}
      <Label className="text-xs text-muted-foreground">Slippage Tolerance</Label>

      {/* Preset toggle group + custom indicator */}
      <div className="flex items-center gap-2 flex-wrap">
        <ToggleGroup
          type="single"
          value={isCustom ? '' : String(currentValue)}
          onValueChange={handleValueChange}
          className="justify-start gap-1"
        >
          {SLIPPAGE_OPTIONS.map((opt) => (
            <ToggleGroupItem
              key={opt.value}
              value={String(opt.value)}
              size="sm"
              aria-label={`Set slippage to ${opt.label}`}
              className="h-7 px-2 text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98] transition-all duration-150"
            >
              {opt.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        {/* Custom pill inline only (reduces noise vs header + inline) */}
        {isCustom && (
          <span className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs bg-primary/10 border border-primary/30 text-primary font-medium">
            {customLabel}
          </span>
        )}
      </div>

      {/* Safety Warning: High Slippage */}
      {slippageBps > 500 && (
        <div className="flex items-start gap-1.5 rounded-md bg-amber-500/10 p-2 text-xs text-amber-600 dark:text-amber-500">
          <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
          <span>High slippage may result in unfavorable execution</span>
        </div>
      )}
    </div>
  );
});
