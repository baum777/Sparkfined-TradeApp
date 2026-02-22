import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

interface BalanceDisplayProps {
  label: string;
  balance: string | null;
  symbol: string;
  onMax?: () => void;
  loading?: boolean;
}

export function BalanceDisplay({ label, balance, symbol, onMax, loading }: BalanceDisplayProps) {
  return (
    <div className="flex items-center justify-between text-sm" data-testid="balance-display">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        {loading ? (
          <Skeleton className="h-4 w-16" data-testid="balance-skeleton" />
        ) : (
          <span className="font-medium">
            {balance != null ? `${balance} ${symbol}` : '--'}
          </span>
        )}
        {onMax != null && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={onMax}
            disabled={loading || balance == null || balance === ''}
            data-testid="balance-max-button"
          >
            Max
          </Button>
        )}
      </div>
    </div>
  );
}
