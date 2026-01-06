/**
 * Trading Wallet Section
 * 
 * Settings UI for entering and managing the user's Solana trading wallet.
 * Used as the data-flow wallet for trade detection and journal enrichment.
 */

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SettingsRow } from './SettingsRow';
import { useTradingWallet, isValidSolanaAddress } from '@/hooks/useTradingWallet';
import { toast } from '@/hooks/use-toast';
import { Wallet, Copy, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export function TradingWalletSection() {
  const { walletAddress, setWalletAddress, clearWalletAddress, isHydrated } = useTradingWallet();
  
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Hydrate input from saved wallet
  useEffect(() => {
    if (isHydrated && walletAddress) {
      setInputValue(walletAddress);
    }
  }, [isHydrated, walletAddress]);

  // Validate on input change
  const handleInputChange = (value: string) => {
    setInputValue(value);
    setError(null);
    
    if (value.trim() && !isValidSolanaAddress(value.trim())) {
      setError('Invalid Solana address. Must be 32-44 Base58 characters.');
    }
  };

  // Check if save should be enabled
  const isValidInput = inputValue.trim() && isValidSolanaAddress(inputValue.trim());
  const hasChanged = inputValue.trim() !== (walletAddress || '');
  const canSave = isValidInput && hasChanged;

  const handleSave = () => {
    if (!canSave) return;
    
    setWalletAddress(inputValue.trim());
    toast({
      title: 'Wallet saved',
      description: 'Your trading wallet has been saved.',
    });
  };

  const handleClear = () => {
    clearWalletAddress();
    setInputValue('');
    setError(null);
    toast({
      title: 'Wallet removed',
      description: 'Your trading wallet has been disconnected.',
    });
  };

  const handleCopy = async () => {
    if (!walletAddress) return;
    
    try {
      await navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: 'Copied',
        description: 'Wallet address copied to clipboard.',
      });
    } catch {
      toast({
        title: 'Copy failed',
        description: 'Could not copy to clipboard.',
        variant: 'destructive',
      });
    }
  };

  // Truncate address for display
  const truncatedAddress = walletAddress
    ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
    : null;

  return (
    <div className="space-y-4">
      {/* Status row */}
      <SettingsRow
        label="Wallet status"
        description={walletAddress ? 'Your trading wallet is connected' : 'No wallet connected'}
      >
        <Badge variant={walletAddress ? 'default' : 'secondary'}>
          {walletAddress ? 'Connected' : 'Not set'}
        </Badge>
      </SettingsRow>

      {/* Current wallet display (when connected) */}
      {walletAddress && (
        <div className="flex items-center gap-2 p-3 rounded-md bg-muted/50">
          <Wallet className="h-4 w-4 text-muted-foreground shrink-0" />
          <code className="text-sm font-mono text-foreground flex-1 truncate">
            {truncatedAddress}
          </code>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={handleCopy}
            aria-label="Copy wallet address"
          >
            {copied ? (
              <Check className="h-4 w-4 text-primary" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>
      )}

      {/* Input field */}
      <div className="space-y-2">
        <Input
          type="text"
          placeholder="Enter Solana wallet address"
          value={inputValue}
          onChange={(e) => handleInputChange(e.target.value)}
          className={cn(
            'font-mono text-sm',
            error && 'border-destructive focus-visible:ring-destructive'
          )}
          data-testid="trading-wallet-input"
        />
        {error && (
          <p className="text-xs text-destructive">{error}</p>
        )}
        <p className="text-xs text-muted-foreground">
          Used as your data-flow wallet to detect trades and enrich journal entries.
        </p>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={handleSave}
          disabled={!canSave}
          data-testid="trading-wallet-save"
        >
          <Wallet className="mr-2 h-4 w-4" />
          Save wallet
        </Button>
        {walletAddress && (
          <Button
            variant="outline"
            className="border-destructive/50 text-destructive hover:bg-destructive/10"
            onClick={handleClear}
            data-testid="trading-wallet-clear"
          >
            <X className="mr-2 h-4 w-4" />
            Remove
          </Button>
        )}
      </div>
    </div>
  );
}
