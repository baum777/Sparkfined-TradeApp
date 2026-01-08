export type PrimaryTabKey =
  | "dashboard"
  | "journal"
  | "research"
  | "alerts"
  | "watchlist"
  | "oracle"
  | "learn"
  | "handbook"
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

// ---- Primary tabs (frozen) ----

export const primaryTabs: PrimaryTab[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    route: "/dashboard",
    tabTestId: "tab-dashboard",
    pageTestId: "page-dashboard",
  },
  {
    key: "journal",
    label: "Journal",
    route: "/journal",
    tabTestId: "tab-journal",
    pageTestId: "page-journal",
  },
  {
    key: "research",
    label: "Research",
    route: "/research",
    tabTestId: "tab-research",
    pageTestId: "page-research",
  },
  {
    key: "alerts",
    label: "Alerts",
    route: "/alerts",
    tabTestId: "tab-alerts",
    pageTestId: "page-alerts",
  },
  {
    key: "watchlist",
    label: "Watchlist",
    route: "/watchlist",
    tabTestId: "tab-watchlist",
    pageTestId: "page-watchlist",
  },
  {
    key: "oracle",
    label: "Oracle",
    route: "/oracle",
    tabTestId: "tab-oracle",
    pageTestId: "page-oracle",
  },
  {
    key: "learn",
    label: "Learn",
    route: "/learn",
    tabTestId: "tab-learn",
    pageTestId: "page-learn",
  },
  {
    key: "handbook",
    label: "Handbook",
    route: "/handbook",
    tabTestId: "tab-handbook",
    pageTestId: "page-handbook",
  },
  {
    key: "settings",
    label: "Settings",
    route: "/settings",
    tabTestId: "tab-settings",
    pageTestId: "page-settings",
  },
];

// ---- Secondary routes (frozen additions) ----

export const secondaryRoutes: SecondaryRoute[] = [
  // Journal deep-links
  { route: "/journal/:entryId", pageTestId: "page-journal-entry" },
  { route: "/journal/review", pageTestId: "page-journal-review" },
  { route: "/journal/insights", pageTestId: "page-journal-insights" },

  // Oracle deep-links
  { route: "/oracle/inbox", pageTestId: "page-oracle-inbox" },
  { route: "/oracle/:insightId", pageTestId: "page-oracle-insight" },
  { route: "/oracle/status", pageTestId: "page-oracle-status" },

  // Settings segmentation
  { route: "/settings/providers", pageTestId: "page-settings-providers" },
  { route: "/settings/data", pageTestId: "page-settings-data" },
  { route: "/settings/experiments", pageTestId: "page-settings-experiments" },
  { route: "/settings/privacy", pageTestId: "page-settings-privacy" },

  // Asset hub (recommended)
  { route: "/asset/:assetId", pageTestId: "page-asset" },
];

// ---- URL builders ----

function encodePathSegment(value: string): string {
  return encodeURIComponent(value);
}

export const routeHelpers = {
  dashboard: () => "/dashboard",
  journal: () => "/journal",
  research: (opts?: { q?: string; replay?: boolean }) => {
    const params = new URLSearchParams();
    params.set("view", "chart");
    const query = opts?.q?.trim();
    if (query) {
      params.set("q", query);
    }
    if (opts?.replay) {
      params.set("replay", "true");
    }
    const qs = params.toString();
    return qs ? `/research?${qs}` : "/research";
  },
  alerts: () => "/alerts",
  watchlist: () => "/watchlist",
  oracle: () => "/oracle",
  learn: () => "/learn",
  handbook: () => "/handbook",
  settings: () => "/settings",

  // Secondary
  journalEntry: (entryId: string) => `/journal/${encodePathSegment(entryId)}`,
  journalReview: () => "/journal/review",
  journalInsights: () => "/journal/insights",

  oracleInbox: () => "/oracle/inbox",
  oracleInsight: (insightId: string) => `/oracle/${encodePathSegment(insightId)}`,
  oracleStatus: () => "/oracle/status",

  settingsProviders: () => "/settings/providers",
  settingsData: () => "/settings/data",
  settingsExperiments: () => "/settings/experiments",
  settingsPrivacy: () => "/settings/privacy",

  asset: (assetId: string) => `/asset/${encodePathSegment(assetId)}`,
};

