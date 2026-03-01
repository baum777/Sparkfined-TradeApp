import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';
import { pageTestId } from './testids';

/**
 * Standardized Navigation Patterns
 *
 * Use these utilities instead of manual waits and navigation.
 * Ensures consistent URL-first, then anchor pattern.
 *
 * Readiness Modes (via E2E_READINESS_MODE env var):
 * - strict: data-app-ready marker is required (default)
 * - fallback: tries marker for half-time budget, then continues with anchor wait
 * - off: skips marker wait entirely (anchor wait still applies)
 */

export type ReadinessMode = 'strict' | 'fallback' | 'off';

const DEFAULT_TIMEOUT_MS = 15_000;
const READY_SELECTOR = 'html[data-app-ready="1"]';

// Prevent noisy logs across multiple navigations/tests
const warned = new Set<string>();

function warnOnce(key: string, message: string) {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(message);
}

function getReadinessMode(override?: ReadinessMode): ReadinessMode {
  if (override) return override;

  const raw = (process.env.E2E_READINESS_MODE ?? 'strict').toLowerCase();
  if (raw === 'strict' || raw === 'fallback' || raw === 'off') return raw;

  warnOnce(
    'nav.invalid_mode',
    `[nav] Invalid E2E_READINESS_MODE="${process.env.E2E_READINESS_MODE}". Falling back to "strict".`,
  );
  return 'strict';
}

/**
 * Wait for SPA readiness marker.
 * - strict: marker is required, throws on timeout
 * - fallback: tries marker for half-time, then continues (anchor wait will still enforce correctness)
 * - off: skips marker wait entirely (anchor wait still applies)
 */
async function waitForAppReadyMarker(page: Page, timeoutMs: number, mode: ReadinessMode) {
  if (mode === 'off') return;

  if (mode === 'strict') {
    await page.waitForSelector(READY_SELECTOR, { timeout: timeoutMs });
    return;
  }

  // fallback mode
  const budget = Math.max(250, Math.floor(timeoutMs / 2));
  try {
    await page.waitForSelector(READY_SELECTOR, { timeout: budget });
  } catch {
    warnOnce(
      'nav.ready_missing_fallback',
      `[nav] data-app-ready marker not found within ${budget}ms (fallback mode). Continuing with anchor wait.`,
    );
  }
}

export interface NavOptions {
  /** Maximum time budget for navigation-related waits (ms). */
  timeout?: number;
  /** Override readiness mode; otherwise uses process.env.E2E_READINESS_MODE or defaults to 'strict'. */
  readinessMode?: ReadinessMode;
}

/**
 * Navigate to URL and wait for expected route + page anchor
 *
 * @param page - Playwright page
 * @param url - URL to navigate to
 * @param expectedUrlRegex - Regex to match expected final URL
 * @param expectedPageTestId - Page test ID to wait for (e.g., 'dashboard')
 * @param options - Optional timeout and readiness mode
 */
export async function gotoAndWait(
  page: Page,
  url: string,
  expectedUrlRegex: RegExp | string,
  expectedPageTestId: keyof typeof import('./testids').PAGE_TESTIDS,
  options?: NavOptions
): Promise<void> {
  const urlRegex = typeof expectedUrlRegex === 'string'
    ? new RegExp(expectedUrlRegex)
    : expectedUrlRegex;

  const timeout = options?.timeout ?? DEFAULT_TIMEOUT_MS;
  const mode = getReadinessMode(options?.readinessMode);

  // CI Stability Baseline v1.0
  // Timeout explicitly forwarded to page.goto to prevent Firefox navigation failures.
  // 1) Navigate without waiting for full load/network idle.
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout });

  // 2) Wait for final URL (handles redirects + client-side routing).
  await expect(page).toHaveURL(urlRegex, { timeout });

  // 3) Wait for SPA bootstrap readiness marker (mode-dependent).
  await waitForAppReadyMarker(page, timeout, mode);

  // 4) Then wait for page anchor (always enforced).
  const selector = pageTestId(expectedPageTestId);
  await expect(page.locator(selector)).toBeVisible({ timeout });
}

/**
 * Click navigation element and wait for expected route + page anchor
 *
 * @param page - Playwright page
 * @param navSelector - Selector for navigation element (e.g., '[data-testid="tab-dashboard"]')
 * @param expectedUrlRegex - Regex to match expected final URL
 * @param expectedPageTestId - Page test ID to wait for
 * @param options - Optional timeout and readiness mode
 */
export async function clickNavAndWait(
  page: Page,
  navSelector: string | Locator,
  expectedUrlRegex: RegExp | string,
  expectedPageTestId: keyof typeof import('./testids').PAGE_TESTIDS,
  options?: NavOptions
): Promise<void> {
  const urlRegex = typeof expectedUrlRegex === 'string'
    ? new RegExp(expectedUrlRegex)
    : expectedUrlRegex;

  const timeout = options?.timeout ?? DEFAULT_TIMEOUT_MS;
  const mode = getReadinessMode(options?.readinessMode);
  const navLocator = typeof navSelector === 'string'
    ? page.locator(navSelector)
    : navSelector;

  await navLocator.click();
  await expect(page).toHaveURL(urlRegex, { timeout });

  // Wait for SPA bootstrap readiness marker (mode-dependent).
  await waitForAppReadyMarker(page, timeout, mode);

  // Anchor is always enforced.
  const selector = pageTestId(expectedPageTestId);
  await expect(page.locator(selector)).toBeVisible({ timeout });
}

/**
 * Wait for app to be ready (URL + readiness marker + page anchor)
 *
 * @param page - Playwright page
 * @param expectedUrlRegex - Regex to match expected URL
 * @param expectedPageTestId - Page test ID to wait for
 * @param options - Optional timeout and readiness mode
 */
export async function waitForAppReady(
  page: Page,
  expectedUrlRegex: RegExp | string,
  expectedPageTestId: keyof typeof import('./testids').PAGE_TESTIDS,
  options?: NavOptions
): Promise<void> {
  const urlRegex = typeof expectedUrlRegex === 'string'
    ? new RegExp(expectedUrlRegex)
    : expectedUrlRegex;

  const timeout = options?.timeout ?? DEFAULT_TIMEOUT_MS;
  const mode = getReadinessMode(options?.readinessMode);

  await expect(page).toHaveURL(urlRegex, { timeout });

  // Wait for SPA bootstrap readiness marker (mode-dependent).
  await waitForAppReadyMarker(page, timeout, mode);

  // Anchor is always enforced.
  const selector = pageTestId(expectedPageTestId);
  await expect(page.locator(selector)).toBeVisible({ timeout });
}

/**
 * Get URL parts (pathname + searchParams)
 */
export function getUrlParts(raw: string): { pathname: string; searchParams: URLSearchParams; hash?: string } {
  const url = new URL(raw);
  return { 
    pathname: url.pathname, 
    searchParams: url.searchParams,
    hash: url.hash,
  };
}

