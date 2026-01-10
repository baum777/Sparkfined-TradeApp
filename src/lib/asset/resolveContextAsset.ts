/**
 * Resolve the "current context asset" from existing app behavior.
 *
 * Priority (all already persisted elsewhere in the app):
 * - Research MarketsBanner recents: sparkfined_recent_markets_v1 (string[])
 * - GlobalSearchBar recents: sparkfined_recent_searches_v1 (string[])
 * - Quick Actions SymbolPicker recents: sparkfined_symbol_recents_v1 ({ symbol: string }[])
 */

function readJsonFromStorage(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function firstNonEmptyString(value: unknown): string | null {
  if (!Array.isArray(value)) return null;
  for (const v of value) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

export function resolveContextAsset(): string | null {
  const fromMarkets = firstNonEmptyString(readJsonFromStorage("sparkfined_recent_markets_v1"));
  if (fromMarkets) return fromMarkets;

  const fromSearch = firstNonEmptyString(readJsonFromStorage("sparkfined_recent_searches_v1"));
  if (fromSearch) return fromSearch;

  const symbolRecents = readJsonFromStorage("sparkfined_symbol_recents_v1");
  if (Array.isArray(symbolRecents)) {
    for (const item of symbolRecents) {
      const sym = (item as any)?.symbol;
      if (typeof sym === "string" && sym.trim()) return sym.trim();
    }
  }

  return null;
}

