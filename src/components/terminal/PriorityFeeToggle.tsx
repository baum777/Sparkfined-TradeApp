import { useTerminalStore } from '@/lib/state/terminalStore';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

export function PriorityFeeToggle() {
  const priorityFee = useTerminalStore((s) => s.priorityFee);
  const setPriorityFeeEnabled = useTerminalStore((s) => s.setPriorityFeeEnabled);

  return (
    <div className="flex items-center justify-between">
      <div className="space-y-0.5">
        <Label htmlFor="priority-fee">Priority Fee</Label>
        <p className="text-xs text-muted-foreground">
          {priorityFee.enabled
            ? `${((priorityFee.microLamports || 5000) / 1000).toFixed(2)} SOL`
            : 'Disabled'}
        </p>
      </div>
      <Switch
        id="priority-fee"
        checked={priorityFee.enabled}
        onCheckedChange={setPriorityFeeEnabled}
      />
    </div>
  );
}

