/**
 * Trading Wallet Hint
 * 
 * A subtle, non-blocking hint showing the connected trading wallet status.
 * Used for contextual awareness across Journal, Research, Oracle, and Alerts.
 * 
 * This is purely informational - no gating, no errors.
 */

import { Link } from "react-router-dom";
import { Wallet } from "lucide-react";
import { useTradingWallet } from "@/hooks/useTradingWallet";
import { cn } from "@/lib/utils";

interface TradingWalletHintProps {
  className?: string;
  /** Show shorter version for compact layouts */
  compact?: boolean;
}

/**
 * Shortens a Solana address for display: "7xK...3Fb"
 */
function shortenAddress(address: string): string {
  if (address.length <= 8) return address;
  return `${address.slice(0, 4)}...${address.slice(-3)}`;
}

export function TradingWalletHint({ className, compact = false }: TradingWalletHintProps) {
  const { walletAddress, isHydrated } = useTradingWallet();

  // Don't render until hydrated to avoid flicker
  if (!isHydrated) return null;

  if (walletAddress) {
    return (
      <div
        data-testid="trading-wallet-hint"
        className={cn(
          "flex items-center gap-1.5 text-xs text-muted-foreground",
          className
        )}
      >
        <Wallet className="h-3 w-3" />
        <span>
          {compact ? shortenAddress(walletAddress) : `Using wallet: ${shortenAddress(walletAddress)}`}
        </span>
      </div>
    );
  }

  return (
    <div
      data-testid="trading-wallet-hint"
      className={cn(
        "flex items-center gap-1.5 text-xs text-muted-foreground",
        className
      )}
    >
      <Wallet className="h-3 w-3" />
      <span>No trading wallet set</span>
      <Link
        to="/settings"
        data-testid="trading-wallet-settings-link"
        className="text-primary hover:underline"
      >
        {compact ? "Set" : "Set in Settings"}
      </Link>
    </div>
  );
}
