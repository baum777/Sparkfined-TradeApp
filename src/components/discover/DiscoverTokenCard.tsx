import React, { useMemo, useCallback } from 'react';
import { useTerminalStore } from '@/lib/state/terminalStore';
import { useDiscoverStore } from '@/lib/state/discoverStore';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Token, Decision, Tab } from '@/features/discover/filter/types';
import { DiscoverReasonChips } from './DiscoverReasonChips';
import { DiscoverScoreBadge } from './DiscoverScoreBadge';

interface DiscoverTokenCardProps {
  token: Token;
  decision: Decision;
  tab: Tab;
}

// Sprint 3.1 PATCH 3: Capped formatter cache to prevent unbounded growth
const MAX_CACHE_SIZE = 500;
const formatCache = new Map<string, string>();

// Simple LRU-style eviction when cache exceeds max size
function setCacheEntry(key: string, value: string): void {
  if (formatCache.size >= MAX_CACHE_SIZE && !formatCache.has(key)) {
    // Evict oldest entry (first in map)
    const firstKey = formatCache.keys().next().value;
    if (firstKey !== undefined) {
      formatCache.delete(firstKey);
    }
  }
  formatCache.set(key, value);
}

function formatLiquidity(value: number): string {
  const key = `liq:${value}`;
  if (!formatCache.has(key)) {
    setCacheEntry(key, `${value.toFixed(1)} SOL`);
  }
  return formatCache.get(key)!;
}

function formatVolume(value: number): string {
  const key = `vol:${value}`;
  if (!formatCache.has(key)) {
    const formatted = value >= 1000 ? `$${(value / 1000).toFixed(1)}k` : `$${value.toFixed(0)}`;
    setCacheEntry(key, formatted);
  }
  return formatCache.get(key)!;
}

function formatHolders(value: number): string {
  const key = `hold:${value}`;
  if (!formatCache.has(key)) {
    setCacheEntry(key, value.toLocaleString());
  }
  return formatCache.get(key)!;
}

// Sprint 3: P0-2 - React.memo prevents re-render when parent list updates but this card's props don't change
export const DiscoverTokenCard = React.memo(function DiscoverTokenCard({
  token,
  decision,
  tab,
}: DiscoverTokenCardProps) {
  const setPair = useTerminalStore((s) => s.setPair);
  const closeOverlay = useDiscoverStore((s) => s.closeOverlay);

  // Sprint 3: P0-2 - Stable callback prevents unnecessary re-renders
  const handleClick = useCallback(() => {
    // Deep-link to Terminal
    setPair({
      baseMint: token.mint,
      quoteMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC default
      baseSymbol: token.symbol,
      quoteSymbol: 'USDC',
    });
    closeOverlay();
  }, [token.mint, token.symbol, setPair, closeOverlay]);

  // Sprint 3: P0-2 - Memoized metrics to prevent recalculation on every render
  const { liqFormatted, volFormatted, holdersFormatted } = useMemo(() => {
    const liqSol = token.liquidity.liq_sol ?? 0;
    const volume24h = token.trading.volume_usd_24h ?? 0;
    const holderCount = token.holders.holder_count ?? 0;

    return {
      liqFormatted: formatLiquidity(liqSol),
      volFormatted: formatVolume(volume24h),
      holdersFormatted: formatHolders(holderCount),
    };
  }, [
    token.liquidity.liq_sol,
    token.trading.volume_usd_24h,
    token.holders.holder_count,
  ]);

  // Sprint 3: P0-2 - Stable key handler for keyboard accessibility
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleClick();
      }
    },
    [handleClick]
  );

  return (
    <Card
      className="cursor-pointer transition-all duration-150 hover:shadow-md hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-label={`${token.symbol} token card`}
    >
      <CardContent className="p-3 relative">
        {/* Score Badge - Absolute top-right */}
        {tab === 'ranked' && decision.score !== undefined && (
          <div className="absolute top-2 right-2">
            <DiscoverScoreBadge score={decision.score} />
          </div>
        )}

        <div className="space-y-2">
          {/* Header: Symbol + Launchpad Badge + Action */}
          <div className="flex items-center gap-2 pr-12">
            <h3 className="font-semibold text-sm">{token.symbol}</h3>
            <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
              {token.launchpad}
            </Badge>
            {decision.action === 'downrank' && (
              <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">
                Downranked
              </Badge>
            )}
            {decision.action === 'allow' && (
              <Badge variant="default" className="text-[10px] px-1 py-0 h-4">
                Allowed
              </Badge>
            )}
          </div>

          {/* Token Name - Single line */}
          <p className="text-xs text-muted-foreground line-clamp-1">{token.name}</p>

          {/* Metrics Grid - 3 columns, compact with cached formatting */}
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div>
              <span className="text-muted-foreground block text-[10px]">Liquidity</span>
              <span className="font-medium tabular-nums">{liqFormatted}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[10px]">Volume 24h</span>
              <span className="font-medium tabular-nums">{volFormatted}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[10px]">Holders</span>
              <span className="font-medium tabular-nums">{holdersFormatted}</span>
            </div>
          </div>

          {/* Reason Chips - Compact */}
          {decision.reasons.length > 0 && (
            <div className="pt-1">
              <DiscoverReasonChips reasons={decision.reasons} />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
});

