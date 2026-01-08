export type PrimaryTabKey =
  | "dashboard"
  | "research"
  | "journal"
  | "insights"
  | "alerts"
  | "settings";

export interface PrimaryTab {
  key: PrimaryTabKey;
  label: string;
  /** Canonical route */
  route: string;
  /** data-testid for the tab control */
  tabTestId: `tab-${PrimaryTabKey}`;
  /** data-testid for the page root */
  pageTestId: string;
  /** Whether to show in mobile bottom nav */
  showInMobileNav?: boolean;
}

export interface SecondaryRoute {
  route: string;
  pageTestId: string;
}

// ---- Validation helpers (frozen contract) ----

// Ticker-like input: ^[A-Z0-9._-]{1,15}$ (case-insensitive)
const TICKER_REGEX = /^[A-Z0-9._-]{1,15}$/i;
// Solana mint/base58: 32–44 chars and matches base58 alphabet (no 0, O, I, l)
const SOLANA_BASE58_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function isValidTickerLike(value: string): boolean {
  return TICKER_REGEX.test(value.trim());
}

export function isValidSolanaBase58(value: string): boolean {
  return SOLANA_BASE58_REGEX.test(value.trim());
}

export function isValidChartQuery(value: string): boolean {
  const v = value.trim();
  return isValidTickerLike(v) || isValidSolanaBase58(v);
}

export function normalizeChartQuery(value: string): string {
  const v = value.trim();
  // For tickers, normalize to uppercase; for base58, preserve original
  if (isValidTickerLike(v)) return v.toUpperCase();
  return v;
}

// ---- Primary tabs (consolidated navigation) ----

export const primaryTabs: PrimaryTab[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    route: "/dashboard",
    tabTestId: "tab-dashboard",
    pageTestId: "page-dashboard",
    showInMobileNav: true,
  },
  {
    key: "research",
    label: "Research",
    route: "/research",
    tabTestId: "tab-research",
    pageTestId: "page-research",
    showInMobileNav: true,
  },
  {
    key: "journal",
    label: "Journal",
    route: "/journal",
    tabTestId: "tab-journal",
    pageTestId: "page-journal",
    showInMobileNav: true,
  },
  {
    key: "insights",
    label: "Insights",
    route: "/insights",
    tabTestId: "tab-insights",
    pageTestId: "page-insights",
    showInMobileNav: true,
  },
  {
    key: "alerts",
    label: "Alerts",
    route: "/alerts",
    tabTestId: "tab-alerts",
    pageTestId: "page-alerts",
    showInMobileNav: true,
  },
  {
    key: "settings",
    label: "Settings",
    route: "/settings",
    tabTestId: "tab-settings",
    pageTestId: "page-settings",
    showInMobileNav: false, // Settings not in mobile bottom nav
  },
];

// ---- Secondary routes ----

export const secondaryRoutes: SecondaryRoute[] = [
  // Journal deep-links (mode via URL params)
  { route: "/journal/:entryId", pageTestId: "page-journal-entry" },

  // Insights deep-links
  { route: "/insights/:insightId", pageTestId: "page-insights-detail" },

  // Research workspace with asset
  { route: "/research/:assetId", pageTestId: "page-research-asset" },
];

// ---- URL builders ----

function encodePathSegment(value: string): string {
  return encodeURIComponent(value);
}

export const routeHelpers = {
  dashboard: () => "/dashboard",
  
  // Research workspace (consolidated from chart, watchlist, replay, asset)
  research: (opts?: { q?: string; panel?: string; replay?: boolean }) => {
    const sp = new URLSearchParams();
    if (opts?.q?.trim()) sp.set("q", opts.q.trim());
    if (opts?.panel) sp.set("panel", opts.panel);
    if (opts?.replay) sp.set("replay", "true");
    const qs = sp.toString();
    return qs ? `/research?${qs}` : "/research";
  },
  researchAsset: (assetId: string) => `/research/${encodePathSegment(assetId)}`,
  
  // Journal with mode params
  journal: (opts?: { mode?: "timeline" | "inbox" | "learn" | "playbook"; entry?: string }) => {
    const sp = new URLSearchParams();
    if (opts?.mode && opts.mode !== "timeline") sp.set("mode", opts.mode);
    if (opts?.entry) sp.set("entry", opts.entry);
    const qs = sp.toString();
    return qs ? `/journal?${qs}` : "/journal";
  },
  journalEntry: (entryId: string) => `/journal/${encodePathSegment(entryId)}`,
  
  // Insights (consolidated from oracle)
  insights: (opts?: { filter?: string; mode?: string }) => {
    const sp = new URLSearchParams();
    if (opts?.filter) sp.set("filter", opts.filter);
    if (opts?.mode) sp.set("mode", opts.mode);
    const qs = sp.toString();
    return qs ? `/insights?${qs}` : "/insights";
  },
  insightDetail: (insightId: string) => `/insights/${encodePathSegment(insightId)}`,
  
  alerts: () => "/alerts",
  
  // Settings with section params
  settings: (opts?: { section?: "providers" | "data" | "experiments" | "privacy" }) => {
    if (opts?.section) {
      return `/settings?section=${opts.section}`;
    }
    return "/settings";
  },

  // Legacy route helpers (for compatibility during migration)
  /** @deprecated Use routeHelpers.research() */
  chart: (opts?: { q?: string }) => routeHelpers.research({ q: opts?.q }),
  /** @deprecated Use routeHelpers.research({ panel: 'watchlist' }) */
  watchlist: () => routeHelpers.research({ panel: "watchlist" }),
  /** @deprecated Use routeHelpers.research({ replay: true }) */
  replay: () => routeHelpers.research({ replay: true }),
  /** @deprecated Use routeHelpers.insights() */
  oracle: () => routeHelpers.insights(),
  /** @deprecated Use routeHelpers.journal({ mode: 'learn' }) */
  learn: () => routeHelpers.journal({ mode: "learn" }),
  /** @deprecated Use routeHelpers.journal({ mode: 'playbook' }) */
  handbook: () => routeHelpers.journal({ mode: "playbook" }),
};
