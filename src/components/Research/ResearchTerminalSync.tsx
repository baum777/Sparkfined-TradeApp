/**
 * ResearchTerminalSync
 * 
 * One-way sync: Research selectedSymbol → Terminal pair
 * 
 * Rules:
 * - Only syncs Research → Terminal (never Terminal → Research)
 * - If symbol→mint mapping fails, does nothing (no partial behavior)
 * - Guards against redundant setPair calls (same base/quote mint)
 */

import { useEffect, useRef } from 'react';
import { useTerminalStore } from '@/lib/state/terminalStore';
import { resolveSymbolToMint, DEFAULT_QUOTE_MINT, DEFAULT_QUOTE_SYMBOL } from '@/lib/trading/symbolResolver';
import type { TerminalPair } from '../../../shared/trading/types';

interface ResearchTerminalSyncProps {
  selectedSymbol: string | null;
}

export function ResearchTerminalSync({ selectedSymbol }: ResearchTerminalSyncProps) {
  const setPair = useTerminalStore((s) => s.setPair);
  const currentPair = useTerminalStore((s) => s.pair);
  
  // Track last synced symbol to avoid redundant updates
  const lastSyncedSymbolRef = useRef<string | null>(null);

  useEffect(() => {
    // Guard: If no symbol selected, do nothing
    if (!selectedSymbol) {
      lastSyncedSymbolRef.current = null;
      return;
    }

    // Guard: If same symbol already synced, skip
    if (lastSyncedSymbolRef.current === selectedSymbol) {
      return;
    }

    // Resolve symbol to mint
    const baseMint = resolveSymbolToMint(selectedSymbol);
    
    // Guard: If symbol→mint mapping fails, do nothing (no partial behavior)
    if (!baseMint) {
      // Symbol cannot be resolved - silently skip (user can set pair manually)
      return;
    }

    // Guard: If terminal already has same base/quote mint, skip redundant setPair
    if (
      currentPair?.baseMint === baseMint &&
      currentPair?.quoteMint === DEFAULT_QUOTE_MINT
    ) {
      lastSyncedSymbolRef.current = selectedSymbol;
      return;
    }

    // Build pair and sync to terminal
    const pair: TerminalPair = {
      baseMint,
      quoteMint: DEFAULT_QUOTE_MINT,
      baseSymbol: selectedSymbol.toUpperCase(),
      quoteSymbol: DEFAULT_QUOTE_SYMBOL,
    };

    setPair(pair);
    lastSyncedSymbolRef.current = selectedSymbol;
  }, [selectedSymbol, setPair, currentPair]);

  // This component has no UI
  return null;
}

