/**
 * EmbeddedTerminal
 * 
 * Terminal wrapper for embedding in Research tab (or other pages).
 * 
 * Differences from TerminalShell:
 * - No topbar (Wallet, PairSelector, Discover button)
 * - Responsive layout (flex-col on mobile, flex-row on desktop)
 * - Uses same terminalStore and execution logic as standalone Terminal
 */

import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useTerminalStore } from '@/lib/state/terminalStore';
import { ChartPanel } from './ChartPanel';
import { ExecutionPanel } from './ExecutionPanel';
import { TxStatusToast } from './TxStatusToast';
import { useIsMobile } from '@/hooks/use-mobile';

export function EmbeddedTerminal() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const pair = useTerminalStore((s) => s.pair);
  const isMobile = useIsMobile();

  return (
    <div className="flex flex-col gap-4" data-testid="embedded-terminal">
      {/* Main Content: Chart + Execution */}
      <div className={isMobile ? 'flex flex-col gap-4' : 'flex gap-4'}>
        {/* Chart Panel */}
        <div className={isMobile ? 'w-full' : 'flex-1'}>
          <ChartPanel baseMint={pair?.baseMint} quoteMint={pair?.quoteMint} />
        </div>

        {/* Execution Panel */}
        <div className={isMobile ? 'w-full' : 'w-96'}>
          <ExecutionPanel wallet={wallet} connection={connection} />
        </div>
      </div>

      {/* TX Status Toast (global notifications) */}
      <TxStatusToast />
    </div>
  );
}

