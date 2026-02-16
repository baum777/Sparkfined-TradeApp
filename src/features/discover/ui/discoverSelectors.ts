import type { DiscoverFilters } from '@/lib/state/discoverStore';
import { evaluateToken } from '@/features/discover/filter/engine';
import type { Decision, PresetId, Tab, Token } from '@/features/discover/filter/types';

export interface EvaluatedTokenRow {
  token: Token;
  decision: Decision;
}

export interface DiscoverSelectorInput {
  tokens: Token[];
  filters: DiscoverFilters;
  tab: Tab;
  preset: PresetId;
}

const DISCOVER_WORKER_ENABLED = false;

function getWindowVolume(token: Token, timeWindow: DiscoverFilters['timeWindow']): number {
  switch (timeWindow) {
    case '5m':
      return token.trading.volume_usd_5m;
    case '15m':
      return token.trading.volume_usd_15m;
    case '60m':
      return token.trading.volume_usd_60m;
    case 'all':
    default:
      return token.trading.volume_usd_60m;
  }
}

function runSelectorPipeline(input: DiscoverSelectorInput): EvaluatedTokenRow[] {
  const { tokens, filters, tab, preset } = input;
  let filtered: Token[] = tokens;

  if (filters.searchQuery.trim()) {
    const query = filters.searchQuery.toLowerCase();
    filtered = filtered.filter(
      (token) =>
        token.symbol.toLowerCase().includes(query) ||
        token.name.toLowerCase().includes(query) ||
        token.mint.toLowerCase().includes(query)
    );
  }

  if (filters.launchpads.length > 0) {
    filtered = filtered.filter((token) => filters.launchpads.includes(token.launchpad));
  }

  const minLiquiditySol = filters.minLiquiditySol;
  if (minLiquiditySol != null && minLiquiditySol > 0) {
    filtered = filtered.filter((token) => (token.liquidity.liq_sol ?? 0) >= minLiquiditySol);
  }

  if (filters.timeWindow !== 'all') {
    filtered = filtered.filter((token) => getWindowVolume(token, filters.timeWindow) > 0);
  }

  const evaluated = filtered
    .map((token) => ({
      token,
      decision: evaluateToken({
        token,
        tab,
        preset,
      }),
    }))
    .filter((item) => item.decision.action !== 'reject');

  evaluated.sort((a, b) => {
    if (a.decision.action !== b.decision.action) {
      return a.decision.action === 'allow' ? -1 : 1;
    }
    if (tab === 'ranked') {
      return (b.decision.score ?? 0) - (a.decision.score ?? 0);
    }
    return 0;
  });

  return evaluated;
}

function buildFilterKey(filters: DiscoverFilters): string {
  return [
    filters.searchQuery.trim().toLowerCase(),
    filters.timeWindow,
    filters.minLiquiditySol ?? 'none',
    [...filters.launchpads].sort().join(','),
  ].join('|');
}

/**
 * Memoized selector factory.
 * Keeps evaluation/scoring outside UI components and avoids rework
 * if token reference + active filter state are unchanged.
 */
export function createDiscoverTokenSelector() {
  let lastTokensRef: Token[] | null = null;
  let lastKey = '';
  let lastResult: EvaluatedTokenRow[] = [];

  return (input: DiscoverSelectorInput): EvaluatedTokenRow[] => {
    const nextKey = `${input.tab}|${input.preset}|${buildFilterKey(input.filters)}`;
    if (lastTokensRef === input.tokens && lastKey === nextKey) {
      return lastResult;
    }

    lastTokensRef = input.tokens;
    lastKey = nextKey;
    lastResult = runSelectorPipeline(input);
    return lastResult;
  };
}

/**
 * Future-proof async adapter for optional Worker offloading.
 * For now we keep deterministic in-thread execution.
 */
export async function evaluateDiscoverTokensAsync(input: DiscoverSelectorInput): Promise<EvaluatedTokenRow[]> {
  if (DISCOVER_WORKER_ENABLED) {
    // Worker path placeholder for future scaling beyond pre-launch requirements.
  }
  return runSelectorPipeline(input);
}
