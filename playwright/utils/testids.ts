/**
 * Test ID Constants - Single Source of Truth
 * 
 * All data-testid values used in E2E tests.
 * Use these constants instead of hardcoded strings.
 */

/**
 * Page root test IDs (required on every page)
 */
export const PAGE_TESTIDS = {
  dashboard: 'page-dashboard',
  journal: 'page-journal',
  journalEntry: 'page-journal-entry',
  research: 'page-research',
  insights: 'page-insights',
  insightsDetail: 'page-insights-detail',
  alerts: 'page-alerts',
  terminal: 'trading-terminal',
  settings: 'page-settings',
  notFound: 'page-notfound',
} as const;

/**
 * Navigation test IDs
 */
export const NAV_TESTIDS = {
  // Primary tabs (sidebar + bottom nav)
  dashboard: 'tab-dashboard',
  journal: 'tab-journal',
  research: 'tab-research',
  insights: 'tab-insights',
  alerts: 'tab-alerts',
  terminal: 'tab-terminal',
  settings: 'tab-settings',
} as const;

/**
 * Helper: Get page test ID selector
 * @example pageTestId('dashboard') → '[data-testid="page-dashboard"]'
 */
export function pageTestId(page: keyof typeof PAGE_TESTIDS): string {
  return `[data-testid="${PAGE_TESTIDS[page]}"]`;
}

/**
 * Helper: Get nav test ID selector
 * @example navTestId('dashboard') → '[data-testid="tab-dashboard"]'
 */
export function navTestId(nav: keyof typeof NAV_TESTIDS): string {
  return `[data-testid="${NAV_TESTIDS[nav]}"]`;
}

/**
 * Type-safe page test ID values
 */
export type PageTestId = typeof PAGE_TESTIDS[keyof typeof PAGE_TESTIDS];

/**
 * Type-safe nav test ID values
 */
export type NavTestId = typeof NAV_TESTIDS[keyof typeof NAV_TESTIDS];

