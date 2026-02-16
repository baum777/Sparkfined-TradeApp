import { useEffect } from 'react';
import { useTerminalStore } from '@/lib/state/terminalStore';
import { useToast } from '@/hooks/use-toast';
import { ExternalLink, CheckCircle2, XCircle } from 'lucide-react';

const EXPLORER_BASE_URL = 'https://solscan.io/tx/';

export function TxStatusToast() {
  const tx = useTerminalStore((s) => s.tx);
  const clearTx = useTerminalStore((s) => s.clearTx);
  const { toast } = useToast();

  useEffect(() => {
    if (tx.status === 'confirmed' && tx.signature) {
      toast({
        title: 'Transaction Confirmed',
        description: (
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <span>Swap completed successfully</span>
            <a
              href={`${EXPLORER_BASE_URL}${tx.signature}`}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-2 inline-flex items-center gap-1 text-primary hover:underline"
            >
              View on Explorer
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        ),
        duration: 10000,
      });
      // Clear tx state after showing toast
      setTimeout(() => clearTx(), 1000);
    } else if (tx.status === 'failed' && tx.error) {
      toast({
        title: 'Transaction Failed',
        description: (
          <div className="flex items-center gap-2">
            <XCircle className="h-4 w-4 text-destructive" />
            <span>{tx.error}</span>
          </div>
        ),
        variant: 'destructive',
        duration: 10000,
      });
      // Clear tx state after showing toast
      setTimeout(() => clearTx(), 1000);
    }
  }, [tx.status, tx.signature, tx.error, toast, clearTx]);

  return null;
}

