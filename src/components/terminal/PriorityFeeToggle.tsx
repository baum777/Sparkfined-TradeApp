import React, { useMemo } from 'react';
import { useTerminalStore } from '@/lib/state/terminalStore';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { AlertTriangle } from 'lucide-react';

const PRIORITY_FEE_WARNING_THRESHOLD = 50_000; // microLamports

// Sprint 3: P0-1 - Memoized component with granular selectors
export const PriorityFeeToggle = React.memo(function PriorityFeeToggle() {
  // Sprint 3: Granular selectors - only subscribe to needed fields
  const priorityEnabled = useTerminalStore((s) => s.priorityFee.enabled);
  const microLamports = useTerminalStore((s) => s.priorityFee.microLamports);
  const setPriorityFeeEnabled = useTerminalStore((s) => s.setPriorityFeeEnabled);

  // Sprint 3: Memoized derived values
  const effectiveMicroLamports = microLamports || 5000;
  const showWarning = priorityEnabled && effectiveMicroLamports > PRIORITY_FEE_WARNING_THRESHOLD;

  // Sprint 3: Memoized label text to prevent recalculation
  const statusLabel = useMemo(() => {
    return priorityEnabled
      ? `${(effectiveMicroLamports / 1000).toFixed(2)} SOL`
      : 'Disabled';
  }, [priorityEnabled, effectiveMicroLamports]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label htmlFor="priority-fee">Priority Fee</Label>
          <p className="text-xs text-muted-foreground">{statusLabel}</p>
        </div>
        <Switch
          id="priority-fee"
          checked={priorityEnabled}
          onCheckedChange={setPriorityFeeEnabled}
        />
      </div>

      {/* Safety Warning: High Priority Fee */}
      {showWarning && (
        <div className="flex items-start gap-2 rounded-md bg-yellow-500/10 p-2 text-sm text-yellow-600 dark:text-yellow-500">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">High priority fee</p>
            <p className="text-xs">
              Priority fee of {(effectiveMicroLamports / 1000).toFixed(2)} SOL is very high. This will significantly increase transaction costs.
            </p>
          </div>
        </div>
      )}
    </div>
  );
});

