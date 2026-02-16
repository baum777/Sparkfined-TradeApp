import { useMemo } from 'react';
import { useDiscoverStore } from '@/lib/state/discoverStore';
import { useDiscoverFilters } from '@/features/discover/ui/useDiscoverFilters';
import { useDiscoverRanking } from '@/features/discover/ui/useDiscoverRanking';
import { evaluateToken } from '@/features/discover/filter/engine';
import type { Tab, Token, Decision } from '@/features/discover/filter/types';
import { DiscoverTokenCard } from './DiscoverTokenCard';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';

interface DiscoverTokenListProps {
  tab: Tab;
}

export function DiscoverTokenList({ tab }: DiscoverTokenListProps) {
  const tokens = useDiscoverStore((s) => s.tokens);
  const filters = useDiscoverStore((s) => s.filters);
  const selectedPreset = useDiscoverStore((s) => s.selectedPreset[tab]);
  const isLoading = useDiscoverStore((s) => s.isLoading);

  // Filter and evaluate tokens
  const filteredTokens = useMemo(() => {
    let filtered: Token[] = [...tokens];

    // Apply search filter
    if (filters.searchQuery.trim()) {
      const query = filters.searchQuery.toLowerCase();
      filtered = filtered.filter(
        (token) =>
          token.symbol.toLowerCase().includes(query) ||
          token.name.toLowerCase().includes(query) ||
          token.mint.toLowerCase().includes(query)
      );
    }

    // Apply launchpad filter
    if (filters.launchpads.length > 0) {
      filtered = filtered.filter((token) =>
        filters.launchpads.includes(token.launchpad)
      );
    }

    // Apply min liquidity filter
    if (filters.minLiquiditySol !== null && filters.minLiquiditySol > 0) {
      filtered = filtered.filter(
        (token) => (token.liquidity.liq_sol ?? 0) >= filters.minLiquiditySol!
      );
    }

    // Evaluate each token with filter engine
    const evaluated = filtered.map((token) => {
      const decision = evaluateToken({
        token,
        tab,
        preset: selectedPreset,
      });
      return { token, decision };
    });

    // Filter out rejected tokens
    const allowed = evaluated.filter((item) => item.decision.action !== 'reject');

    // Sort: allow > downrank, then by score (if ranked)
    const sorted = allowed.sort((a, b) => {
      if (a.decision.action !== b.decision.action) {
        return a.decision.action === 'allow' ? -1 : 1;
      }
      if (tab === 'ranked') {
        const scoreA = a.decision.score ?? 0;
        const scoreB = b.decision.score ?? 0;
        return scoreB - scoreA;
      }
      return 0;
    });

    return sorted;
  }, [tokens, filters, tab, selectedPreset]);

  if (isLoading) {
    return (
      <ScrollArea className="h-full">
        <div className="space-y-2 p-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </ScrollArea>
    );
  }

  if (filteredTokens.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <div className="text-center">
          <p className="text-lg font-medium">No tokens found</p>
          <p className="text-sm">Try adjusting your filters</p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-2 p-2">
        {filteredTokens.map((item) => (
          <DiscoverTokenCard
            key={item.token.mint}
            token={item.token}
            decision={item.decision}
            tab={tab}
          />
        ))}
      </div>
    </ScrollArea>
  );
}

