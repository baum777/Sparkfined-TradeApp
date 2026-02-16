import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useTerminalStore } from '@/lib/state/terminalStore';
import { useDiscoverStore } from '@/lib/state/discoverStore';
import { ChartPanel } from './ChartPanel';
import { ExecutionPanel } from './ExecutionPanel';
import { PairSelector } from './PairSelector';
import { TxStatusToast } from './TxStatusToast';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';

export function TerminalShell() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const pair = useTerminalStore((s) => s.pair);
  const openDiscover = useDiscoverStore((s) => s.openOverlay);

  return (
    <div className="flex h-full flex-col" data-testid="terminal-shell">
      {/* Top Bar: Wallet + Pair Selector */}
      <div className="flex items-center justify-between border-b bg-background p-4">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold">Terminal</h1>
          <PairSelector />
          <Button variant="outline" size="sm" onClick={openDiscover}>
            <Sparkles className="mr-2 h-4 w-4" />
            Discover
          </Button>
        </div>
        <WalletMultiButton />
      </div>

      {/* Main Content: Chart + Execution */}
      <div className="flex flex-1 gap-4 overflow-hidden p-4">
        {/* Left: Chart Panel */}
        <div className="flex-1">
          <ChartPanel baseMint={pair?.baseMint} quoteMint={pair?.quoteMint} />
        </div>

        {/* Right: Execution Panel */}
        <div className="w-96">
          <ExecutionPanel wallet={wallet} connection={connection} />
        </div>
      </div>

      {/* TX Status Toast */}
      <TxStatusToast />
    </div>
  );
}

