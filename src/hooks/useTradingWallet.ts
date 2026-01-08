/**
 * Trading Wallet Hook
 * 
 * Manages the user's Solana trading wallet address used for
 * data-flow enrichment (trade detection, portfolio tracking).
 * 
 * Persists to localStorage with key: sparkfined_trading_wallet_v1
 */

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'sparkfined_trading_wallet_v1';

// Solana Base58 address validation (32-44 characters, alphanumeric without 0/O/I/l)
const SOLANA_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function isValidSolanaAddress(address: string): boolean {
  if (!address || typeof address !== 'string') return false;
  return SOLANA_ADDRESS_REGEX.test(address.trim());
}

export interface UseTradingWalletReturn {
  /** Current saved wallet address (null if not set) */
  walletAddress: string | null;
  /** Set and persist a new wallet address */
  setWalletAddress: (address: string) => void;
  /** Clear the saved wallet address */
  clearWalletAddress: () => void;
  /** Whether the store has been hydrated from localStorage */
  isHydrated: boolean;
}

export function useTradingWallet(): UseTradingWalletReturn {
  const [walletAddress, setWalletAddressState] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  // Hydrate from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed.address === 'string' && isValidSolanaAddress(parsed.address)) {
          setWalletAddressState(parsed.address);
        }
      }
    } catch (err) {
      console.error('[useTradingWallet] Failed to hydrate from localStorage:', err);
    }
    setIsHydrated(true);
  }, []);

  const setWalletAddress = useCallback((address: string) => {
    const trimmed = address.trim();
    if (!isValidSolanaAddress(trimmed)) {
      console.warn('[useTradingWallet] Invalid Solana address:', trimmed);
      return;
    }
    
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ address: trimmed, savedAt: Date.now() }));
      setWalletAddressState(trimmed);
    } catch (err) {
      console.error('[useTradingWallet] Failed to persist wallet:', err);
    }
  }, []);

  const clearWalletAddress = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      setWalletAddressState(null);
    } catch (err) {
      console.error('[useTradingWallet] Failed to clear wallet:', err);
    }
  }, []);

  return {
    walletAddress,
    setWalletAddress,
    clearWalletAddress,
    isHydrated,
  };
}
