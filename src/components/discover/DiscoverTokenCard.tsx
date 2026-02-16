import { useTerminalStore } from '@/lib/state/terminalStore';
import { useDiscoverStore } from '@/lib/state/discoverStore';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Token, Decision, Tab } from '@/features/discover/filter/types';
import { DiscoverReasonChips } from './DiscoverReasonChips';
import { DiscoverScoreBadge } from './DiscoverScoreBadge';
import { formatBaseUnitsToUi } from '../../../shared/trading/fee/feeEngine';

interface DiscoverTokenCardProps {
  token: Token;
  decision: Decision;
  tab: Tab;
}

export function DiscoverTokenCard({ token, decision, tab }: DiscoverTokenCardProps) {
  const setPair = useTerminalStore((s) => s.setPair);
  const closeOverlay = useDiscoverStore((s) => s.closeOverlay);

  const handleClick = () => {
    // Deep-link to Terminal
    setPair({
      baseMint: token.mint,
      quoteMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC default
      baseSymbol: token.symbol,
      quoteSymbol: 'USDC',
    });
    closeOverlay();
  };

  const liqSol = token.liquidity.liq_sol ?? 0;
  const volume5m = token.trading.volume_usd_5m;
  const holderCount = token.holders.holder_count;

  return (
    <Card
      className="cursor-pointer transition-colors hover:bg-accent"
      onClick={handleClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          {/* Left: Token Info */}
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">{token.symbol}</h3>
              <Badge variant="outline" className="text-xs">
                {token.launchpad}
              </Badge>
              {tab === 'ranked' && decision.score !== undefined && (
                <DiscoverScoreBadge score={decision.score} />
              )}
            </div>
            <p className="text-sm text-muted-foreground">{token.name}</p>

            {/* Metrics */}
            <div className="flex flex-wrap gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Liquidity: </span>
                <span className="font-medium">{liqSol.toFixed(2)} SOL</span>
              </div>
              <div>
                <span className="text-muted-foreground">Volume 5m: </span>
                <span className="font-medium">${(volume5m / 1000).toFixed(1)}k</span>
              </div>
              <div>
                <span className="text-muted-foreground">Holders: </span>
                <span className="font-medium">{holderCount}</span>
              </div>
            </div>

            {/* Reason Chips */}
            {decision.reasons.length > 0 && (
              <DiscoverReasonChips reasons={decision.reasons} />
            )}
          </div>

          {/* Right: Action Indicator */}
          <div className="flex flex-col items-end gap-2">
            {decision.action === 'downrank' && (
              <Badge variant="secondary" className="text-xs">
                Downranked
              </Badge>
            )}
            {decision.action === 'allow' && (
              <Badge variant="default" className="text-xs">
                Allowed
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

