import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import type { Connection } from '@solana/web3.js';
import type { WalletContextState } from '@solana/wallet-adapter-react';
import { useTerminalStore } from '@/lib/state/terminalStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { QuickAmountButtons } from './QuickAmountButtons';
import { SlippageSelectorCompact } from './SlippageSelectorCompact';
import { PriorityFeeToggle } from './PriorityFeeToggle';
import { FeePreviewInline } from './FeePreviewInline';
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
import { ArrowUpDown, Loader2, Settings2 } from 'lucide-react';
import { BalanceDisplay } from './BalanceDisplay';

interface OrderFormProps {
  wallet: WalletContextState;
  connection: Connection;
}

// Sprint 3: P0-1 - Granular selectors to minimize re-renders
// Each selector extracts only the needed primitive value
export function OrderForm({ wallet, connection }: OrderFormProps) {
  // Granular store selections - only re-render when these specific fields change
  const side = useTerminalStore((s) => s.side);
  const amountValue = useTerminalStore((s) => s.amount.value);
  const quoteStatus = useTerminalStore((s) => s.quote.status);
  const quoteData = useTerminalStore((s) => s.quote.data);
  const quoteError = useTerminalStore((s) => s.quote.error);
  const txStatus = useTerminalStore((s) => s.tx.status);
  const txError = useTerminalStore((s) => s.tx.error);
  const pair = useTerminalStore((s) => s.pair);
  const baseBalance = useTerminalStore((s) => s.balances.base);
  const quoteBalance = useTerminalStore((s) => s.balances.quote);
  const balancesLoading = useTerminalStore((s) => s.balances.loading);

  // Stable action selectors (functions don't change identity)
  const setSide = useTerminalStore((s) => s.setSide);
  const setAmountValue = useTerminalStore((s) => s.setAmountValue);
  const executeSwap = useTerminalStore((s) => s.executeSwap);
  const fetchBalances = useTerminalStore((s) => s.fetchBalances);
  const setMaxAmount = useTerminalStore((s) => s.setMaxAmount);

  const [isExecuting, setIsExecuting] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const amountInputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const forceAuditQuoteError = useMemo(() => {
    if (!import.meta.env.DEV || typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('auditQuote') === 'error';
  }, []);
  const effectiveQuoteStatus = forceAuditQuoteError ? 'error' : quoteStatus;
  const effectiveQuoteError = forceAuditQuoteError
    ? 'Audit: forced quote error state'
    : quoteError;

  // Sprint 3.1 PATCH 2: Robust editable target detection
  const isEditableTarget = useCallback((target: EventTarget | null): boolean => {
    if (!(target instanceof HTMLElement)) return false;
    const tagName = target.tagName.toUpperCase();
    // Check direct tag names
    if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') return true;
    // Check contenteditable
    if (target.isContentEditable) return true;
    // Check if inside editable container
    if (target.closest('input, textarea, select, [contenteditable="true"]') !== null) return true;
    return false;
  }, []);

  // Memoized derived state to prevent recalculation
  const isWalletConnected = useMemo(() => wallet.publicKey !== null, [wallet.publicKey]);

  const isAmountValid = useMemo(
    () => amountValue.trim() !== '' && Number(amountValue) > 0,
    [amountValue]
  );

  const isQuoteReady = useMemo(
    () => effectiveQuoteStatus === 'success' && quoteData !== undefined,
    [effectiveQuoteStatus, quoteData]
  );

  const isQuoteLoading = effectiveQuoteStatus === 'loading';
  const isTxInProgress = txStatus === 'signing' || txStatus === 'sending';

  // Memoized canExecute to prevent child re-renders
  const canExecute = useMemo(
    () => isWalletConnected && isAmountValid && isQuoteReady && !isTxInProgress && !isExecuting,
    [isWalletConnected, isAmountValid, isQuoteReady, isTxInProgress, isExecuting]
  );

  // Sprint 3: P1-2 - Disabled reason microcopy
  const disabledReason = useMemo(() => {
    if (!isWalletConnected) return 'Connect wallet to trade';
    if (!isAmountValid) return 'Enter amount to get quote';
    if (!isQuoteReady) return 'Waiting for quote...';
    return null;
  }, [isWalletConnected, isAmountValid, isQuoteReady]);

  // Stable callbacks to prevent child re-renders
  const handleSetSide = useCallback(
    (value: string) => {
      if (value === 'buy' || value === 'sell') {
        setSide(value);
      }
    },
    [setSide]
  );

  const handleSetAmount = useCallback(
    (value: string) => {
      setAmountValue(value);
    },
    [setAmountValue]
  );

  const handleSwap = useCallback(() => {
    if (!canExecute) return;
    setIsConfirmOpen(true);
  }, [canExecute]);

  const handleConfirmSwap = useCallback(async () => {
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
  }, [canExecute, wallet.publicKey, wallet.signTransaction, executeSwap, connection]);

  // Sprint 3.1 PATCH 1: Container-scoped keyboard handler (replaces global window listener)
  const handleContainerKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const root = rootRef.current;
      if (!root || !root.contains(document.activeElement)) return;

      if (isEditableTarget(e.target)) return;

      if (e.key === 'Enter' && !isConfirmOpen) {
        if (canExecute) {
          e.preventDefault();
          setIsConfirmOpen(true);
        }
        return;
      }

      if (e.key === 'Enter' && isConfirmOpen && canExecute) {
        e.preventDefault();
        void handleConfirmSwap();
        return;
      }

      if (e.key === 'Escape' && isConfirmOpen) {
        e.preventDefault();
        setIsConfirmOpen(false);
      }
    },
    [canExecute, isConfirmOpen, handleConfirmSwap, isEditableTarget]
  );

  // Fetch balances only when necessary deps change
  useEffect(() => {
    void fetchBalances({ wallet: { publicKey: wallet.publicKey }, connection });
  }, [wallet.publicKey, connection, pair?.baseMint, pair?.quoteMint, fetchBalances]);

  return (
    <div
      ref={rootRef}
      onKeyDown={handleContainerKeyDown}
      className="space-y-3"
      tabIndex={-1}
      aria-label="Trading order form"
    >
      {/* Side Toggle */}
      <div>
        <Label>Side</Label>
        <ToggleGroup
          type="single"
          value={side}
          onValueChange={handleSetSide}
          className="mt-2"
        >
          <ToggleGroupItem
            value="buy"
            aria-label="Buy"
            className="focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Buy
          </ToggleGroupItem>
          <ToggleGroupItem
            value="sell"
            aria-label="Sell"
            className="focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
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
            ref={amountInputRef}
            id="amount"
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            value={amountValue}
            onChange={(e) => handleSetAmount(e.target.value)}
            disabled={isTxInProgress}
            className="focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            aria-label="Trade amount"
          />
          {isWalletConnected && (
            <BalanceDisplay
              label="Balance"
              balance={side === 'buy' ? quoteBalance : baseBalance}
              symbol={side === 'buy' ? (pair?.quoteSymbol ?? 'USDC') : (pair?.baseSymbol ?? 'SOL')}
              onMax={setMaxAmount}
              loading={balancesLoading}
            />
          )}
          <QuickAmountButtons />
        </div>
      </div>

      {/* Fee Preview - Inline at decision moment */}
      <FeePreviewInline />

      {/* Swap Button - Elevated primary action */}
      <Button
        onClick={handleSwap}
        disabled={!canExecute}
        className="h-12 w-full mt-4 shadow-lg shadow-brand/20 hover:shadow-xl hover:shadow-brand/30 active:scale-[0.98] transition-all duration-150 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        size="lg"
        aria-label={side === 'buy' ? 'Buy token' : 'Sell token'}
      >
        {isExecuting || isTxInProgress ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {txStatus === 'signing' && 'Signing...'}
            {txStatus === 'sending' && 'Sending...'}
            {!txStatus || (txStatus === 'idle' && isExecuting) && 'Processing...'}
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

      {/* Sprint 3: P1-2 - Disabled reason microcopy */}
      {disabledReason && (
        <p className="text-xs text-muted-foreground text-center">
          {disabledReason}
        </p>
      )}

      {/* Advanced Settings - Collapsed by default with visible summary chips */}
      <AdvancedSettingsAccordion />

      {/* Error Messages - Sprint 3: Use granular error selectors */}
      {effectiveQuoteStatus === 'error' && effectiveQuoteError && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {effectiveQuoteError}
        </div>
      )}

      {txStatus === 'failed' && txError && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          Transaction failed: {txError}
        </div>
      )}

      {/* Sprint 3.1 PATCH 1: Updated hint - only works when Terminal is focused */}
      <p className="hidden md:block text-[10px] text-muted-foreground/60 text-center">
        Focus Terminal, then press <kbd className="px-1 py-0.5 rounded bg-muted">Enter</kbd> to trade
      </p>

      <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        {/* Sprint 3.1 PATCH 1: Dialog-level Enter handler for confirmation */}
        <AlertDialogContent
          data-testid="swap-confirm-dialog"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && canExecute && !isExecuting && !isTxInProgress) {
              e.preventDefault();
              void handleConfirmSwap();
            }
            if (e.key === 'Escape') {
              e.preventDefault();
              setIsConfirmOpen(false);
            }
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm swap</AlertDialogTitle>
            <AlertDialogDescription>
              {side === 'buy' ? 'Buy' : 'Sell'} {amountValue || '0'}{' '}
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

// Sprint 3: P0-1 - Memoized subcomponent to prevent parent re-render cascades
const AdvancedSettingsAccordion = React.memo(function AdvancedSettingsAccordion() {
  // Sprint 3: Granular selectors - only re-render when these specific values change
  const slippageBps = useTerminalStore((s) => s.slippageBps);
  const priorityEnabled = useTerminalStore((s) => s.priorityFee.enabled);
  const priorityMicroLamports = useTerminalStore((s) => s.priorityFee.microLamports);

  // Sprint 3: Memoized label computation
  const slippageLabel = useMemo(() => `${(slippageBps / 100).toFixed(1)}%`, [slippageBps]);

  // Sprint 3: Memoized priority tier label
  const { priorityLabel, priorityDetail } = useMemo(() => {
    if (!priorityEnabled) return { priorityLabel: 'Off', priorityDetail: undefined };
    const µL = priorityMicroLamports ?? 5_000;
    let label: string;
    if (µL === 0) label = 'Auto';
    else if (µL <= 1_000) label = 'Low';
    else if (µL <= 10_000) label = 'Medium';
    else label = 'High';
    return { priorityLabel: label, priorityDetail: `${µL} µL/CU` };
  }, [priorityEnabled, priorityMicroLamports]);

  return (
    <Accordion type="single" collapsible className="w-full">
      <AccordionItem value="advanced" className="border-0">
        <AccordionTrigger
          className="text-sm text-muted-foreground hover:no-underline py-2 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded"
          aria-label="Advanced settings (slippage and priority fee)"
        >
          <div className="flex items-center gap-2 flex-wrap">
            <Settings2 className="h-3 w-3 shrink-0" />
            <span>Advanced</span>
            {/* Summary chips - visible without expanding */}
            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] bg-muted border text-muted-foreground">
              Slippage {slippageLabel}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] bg-muted border text-muted-foreground">
              Priority {priorityLabel}
              {priorityDetail && (
                <span className="text-[9px] opacity-70">({priorityDetail})</span>
              )}
            </span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="space-y-3 pt-2">
          <SlippageSelectorCompact />
          <PriorityFeeToggle />
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
});

