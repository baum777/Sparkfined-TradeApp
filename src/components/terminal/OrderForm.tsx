import { useState } from 'react';
import type { Connection } from '@solana/web3.js';
import type { WalletContextState } from '@solana/wallet-adapter-react';
import { useTerminalStore } from '@/lib/state/terminalStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { QuickAmountButtons } from './QuickAmountButtons';
import { SlippageSelector } from './SlippageSelector';
import { PriorityFeeToggle } from './PriorityFeeToggle';
import { ArrowUpDown, Loader2 } from 'lucide-react';

interface OrderFormProps {
  wallet: WalletContextState;
  connection: Connection;
}

export function OrderForm({ wallet, connection }: OrderFormProps) {
  const side = useTerminalStore((s) => s.side);
  const amount = useTerminalStore((s) => s.amount);
  const quote = useTerminalStore((s) => s.quote);
  const tx = useTerminalStore((s) => s.tx);
  const setSide = useTerminalStore((s) => s.setSide);
  const setAmountValue = useTerminalStore((s) => s.setAmountValue);
  const executeSwap = useTerminalStore((s) => s.executeSwap);

  const [isExecuting, setIsExecuting] = useState(false);

  const isWalletConnected = wallet.publicKey !== null;
  const isAmountValid = amount.value.trim() !== '' && Number(amount.value) > 0;
  const isQuoteReady = quote.status === 'success' && quote.data !== undefined;
  const isQuoteLoading = quote.status === 'loading';
  const isTxInProgress = tx.status === 'signing' || tx.status === 'sending';

  const canExecute =
    isWalletConnected &&
    isAmountValid &&
    isQuoteReady &&
    !isTxInProgress &&
    !isExecuting;

  const handleSwap = async () => {
    if (!canExecute || !wallet.publicKey || !wallet.signTransaction) {
      return;
    }

    setIsExecuting(true);
    try {
      await executeSwap({
        wallet: {
          publicKey: wallet.publicKey,
          signTransaction: wallet.signTransaction,
        },
        connection,
      });
    } catch (error) {
      console.error('Swap execution error:', error);
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Side Toggle */}
      <div>
        <Label>Side</Label>
        <ToggleGroup
          type="single"
          value={side}
          onValueChange={(value) => {
            if (value === 'buy' || value === 'sell') {
              setSide(value);
            }
          }}
          className="mt-2"
        >
          <ToggleGroupItem value="buy" aria-label="Buy">
            Buy
          </ToggleGroupItem>
          <ToggleGroupItem value="sell" aria-label="Sell">
            Sell
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* Amount Input */}
      <div>
        <Label htmlFor="amount">
          Amount ({side === 'buy' ? 'USDC' : 'SOL'})
        </Label>
        <div className="mt-2 space-y-2">
          <Input
            id="amount"
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            value={amount.value}
            onChange={(e) => setAmountValue(e.target.value)}
            disabled={isTxInProgress}
          />
          <QuickAmountButtons />
        </div>
      </div>

      {/* Slippage */}
      <SlippageSelector />

      {/* Priority Fee */}
      <PriorityFeeToggle />

      {/* Swap Button */}
      <Button
        onClick={handleSwap}
        disabled={!canExecute}
        className="w-full"
        size="lg"
      >
        {isExecuting || isTxInProgress ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {tx.status === 'signing' && 'Signing...'}
            {tx.status === 'sending' && 'Sending...'}
            {!tx.status || (tx.status === 'idle' && isExecuting) && 'Processing...'}
          </>
        ) : (
          <>
            <ArrowUpDown className="mr-2 h-4 w-4" />
            {side === 'buy' ? 'Buy' : 'Sell'}
          </>
        )}
      </Button>

      {/* Error Messages */}
      {quote.status === 'error' && quote.error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {quote.error}
        </div>
      )}

      {tx.status === 'failed' && tx.error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          Transaction failed: {tx.error}
        </div>
      )}
    </div>
  );
}

