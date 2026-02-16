import { useMemo } from 'react';
import type { Token, Decision } from '../filter/types';
import { evaluateToken } from '../filter/engine';
import { filterSpec } from '../filter/spec';

/**
 * Hook für Discover Ranking
 * Sortiert und filtert Tokens für ranked Tab
 */
export function useDiscoverRanking(tokens: Token[]) {
  const rankedTokens = useMemo(() => {
    // Evaluiere alle Tokens
    const evaluated = tokens.map((token) => {
      const decision = evaluateToken({
        token,
        tab: 'ranked',
        preset: filterSpec.ui.overlay_tabs.ranked.default_preset,
      });
      return { token, decision };
    });

    // Filtere nur allowed/downranked (keine rejects)
    const filtered = evaluated.filter(
      (item) => item.decision.action !== 'reject'
    );

    // Sortiere nach Score (höher = besser)
    const sorted = filtered.sort((a, b) => {
      const scoreA = a.decision.score ?? 0;
      const scoreB = b.decision.score ?? 0;

      // Score zuerst
      if (scoreA !== scoreB) {
        return scoreB - scoreA;
      }

      // Dann nach Action (allow > downrank)
      if (a.decision.action !== b.decision.action) {
        return a.decision.action === 'allow' ? -1 : 1;
      }

      return 0;
    });

    return sorted;
  }, [tokens]);

  return {
    rankedTokens,
  };
}

