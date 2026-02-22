import { useEffect, useState } from 'react';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ArrowUpDown, Loader2 } from 'lucide-react';
import { BalanceDisplay } from './BalanceDisplay';

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
  const fetchBalances = useTerminalStore((s) => s.fetchBalances);
  const setMaxAmount = useTerminalStore((s) => s.setMaxAmount);
  const pair = useTerminalStore((s) => s.pair);
  const balances = useTerminalStore((s) => s.balances);

  const [isExecuting, setIsExecuting] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

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

  useEffect(() => {
    void fetchBalances({ wallet: { publicKey: wallet.publicKey }, connection });
  }, [wallet.publicKey, connection, pair, fetchBalances]);

  const handleSwap = () => {
    if (!canExecute) return;
    setIsConfirmOpen(true);
  };

  const handleConfirmSwap = async () => {
    if (!canExecute || !wallet.publicKey || !wallet.signTransaction) {
      return;
    }

    setIsConfirmOpen(false);
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
          Amount ({side === 'buy' ? pair?.quoteSymbol ?? 'USDC' : pair?.baseSymbol ?? 'SOL'})
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
          {isWalletConnected && (
            <BalanceDisplay
              label="Balance"
              balance={side === 'buy' ? balances.quote : balances.base}
              symbol={side === 'buy' ? (pair?.quoteSymbol ?? 'USDC') : (pair?.baseSymbol ?? 'SOL')}
              onMax={setMaxAmount}
              loading={balances.loading}
            />
          )}
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
            {!isWalletConnected
              ? 'Connect wallet to swap'
              : side === 'buy'
                ? 'Buy'
                : 'Sell'}
          </>
        )}
      </Button>

      {!isWalletConnected && (
        <p className="text-xs text-muted-foreground">
          Wallet connection is required before swap execution.
        </p>
      )}

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

      <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <AlertDialogContent data-testid="swap-confirm-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm swap</AlertDialogTitle>
            <AlertDialogDescription>
              {side === 'buy' ? 'Buy' : 'Sell'} {amount.value || '0'}{' '}
              {side === 'buy' ? pair?.quoteSymbol || 'USDC' : pair?.baseSymbol || 'TOKEN'} for{' '}
              {side === 'buy' ? pair?.baseSymbol || 'TOKEN' : pair?.quoteSymbol || 'USDC'}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleConfirmSwap();
              }}
              disabled={isExecuting || isTxInProgress}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

