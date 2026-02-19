import { useTerminalStore } from '@/lib/state/terminalStore';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { AlertTriangle } from 'lucide-react';

const PRIORITY_FEE_WARNING_THRESHOLD = 50_000; // microLamports

export function PriorityFeeToggle() {
  const priorityFee = useTerminalStore((s) => s.priorityFee);
  const setPriorityFeeEnabled = useTerminalStore((s) => s.setPriorityFeeEnabled);

  const microLamports = priorityFee.microLamports || 5000;
  const showWarning = priorityFee.enabled && microLamports > PRIORITY_FEE_WARNING_THRESHOLD;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label htmlFor="priority-fee">Priority Fee</Label>
          <p className="text-xs text-muted-foreground">
            {priorityFee.enabled
              ? `${(microLamports / 1000).toFixed(2)} SOL`
              : 'Disabled'}
          </p>
        </div>
        <Switch
          id="priority-fee"
          checked={priorityFee.enabled}
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
              Priority fee of {(microLamports / 1000).toFixed(2)} SOL is very high. This will significantly increase transaction costs.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

