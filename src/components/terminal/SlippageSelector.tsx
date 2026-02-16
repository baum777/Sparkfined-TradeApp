import { useTerminalStore } from '@/lib/state/terminalStore';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const SLIPPAGE_OPTIONS = [
  { label: '0.1%', value: 10 },
  { label: '0.5%', value: 50 },
  { label: '1.0%', value: 100 },
  { label: 'Custom', value: 'custom' },
] as const;

export function SlippageSelector() {
  const slippageBps = useTerminalStore((s) => s.slippageBps);
  const setSlippageBps = useTerminalStore((s) => s.setSlippageBps);

  const currentOption = SLIPPAGE_OPTIONS.find((opt) => opt.value === slippageBps) || {
    label: 'Custom',
    value: 'custom' as const,
  };

  return (
    <div>
      <Label>Slippage Tolerance</Label>
      <Select
        value={currentOption.value === 'custom' ? 'custom' : String(currentOption.value)}
        onValueChange={(value) => {
          if (value !== 'custom') {
            setSlippageBps(Number(value));
          }
        }}
      >
        <SelectTrigger className="mt-2">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SLIPPAGE_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={String(opt.value)}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {currentOption.value === 'custom' && (
        <p className="mt-1 text-xs text-muted-foreground">
          Current: {(slippageBps / 100).toFixed(2)}%
        </p>
      )}
    </div>
  );
}

