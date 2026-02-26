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
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-background p-4">
        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
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
      <div className="flex flex-1 flex-col gap-4 overflow-hidden p-4 lg:flex-row">
        {/* Chart Panel: full width on mobile, flex-1 on desktop */}
        <div className="h-[50vh] min-h-[200px] shrink-0 lg:h-auto lg:min-h-0 lg:flex-1">
          <ChartPanel baseMint={pair?.baseMint} quoteMint={pair?.quoteMint} />
        </div>

        {/* Execution Panel: full width on mobile, fixed 384px on desktop */}
        <div className="w-full shrink-0 lg:w-96">
          <ExecutionPanel wallet={wallet} connection={connection} />
        </div>
      </div>

      {/* TX Status Toast */}
      <TxStatusToast />
    </div>
  );
}

