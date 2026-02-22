import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';
import { pageTestId } from './testids';

/**
 * Standardized Navigation Patterns
 * 
 * Use these utilities instead of manual waits and navigation.
 * Ensures consistent URL-first, then anchor pattern.
 */

/**
 * Navigate to URL and wait for expected route + page anchor
 * 
 * @param page - Playwright page
 * @param url - URL to navigate to
 * @param expectedUrlRegex - Regex to match expected final URL
 * @param expectedPageTestId - Page test ID to wait for (e.g., 'dashboard')
 * @param options - Optional timeout and wait strategy
 */
export async function gotoAndWait(
  page: Page,
  url: string,
  expectedUrlRegex: RegExp | string,
  expectedPageTestId: keyof typeof import('./testids').PAGE_TESTIDS,
  options?: {
    timeout?: number;
  }
): Promise<void> {
  const urlRegex = typeof expectedUrlRegex === 'string' 
    ? new RegExp(expectedUrlRegex) 
    : expectedUrlRegex;
  
  const timeout = options?.timeout ?? 15_000;

  // CI Stability Baseline v1.0
  // Timeout explicitly forwarded to page.goto to prevent Firefox navigation failures.
  // 1) Navigate without waiting for full load/network idle.
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout });

  // 2) Wait for final URL (handles redirects + client-side routing).
  await expect(page).toHaveURL(urlRegex, { timeout });

  // 3) Wait for SPA bootstrap readiness marker.
  await page.waitForSelector('html[data-app-ready="1"]', { timeout });

  // 4) Then wait for page anchor.
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
 * @param options - Optional timeout
 */
export async function clickNavAndWait(
  page: Page,
  navSelector: string | Locator,
  expectedUrlRegex: RegExp | string,
  expectedPageTestId: keyof typeof import('./testids').PAGE_TESTIDS,
  options?: {
    timeout?: number;
  }
): Promise<void> {
  const urlRegex = typeof expectedUrlRegex === 'string' 
    ? new RegExp(expectedUrlRegex) 
    : expectedUrlRegex;
  
  const timeout = options?.timeout ?? 15_000;
  const navLocator = typeof navSelector === 'string' 
    ? page.locator(navSelector) 
    : navSelector;

  await navLocator.click();
  await expect(page).toHaveURL(urlRegex, { timeout });
  await page.waitForSelector('html[data-app-ready="1"]', { timeout });

  const selector = pageTestId(expectedPageTestId);
  await expect(page.locator(selector)).toBeVisible({ timeout });
}

/**
 * Wait for app to be ready (URL + page anchor)
 * 
 * @param page - Playwright page
 * @param expectedUrlRegex - Regex to match expected URL
 * @param expectedPageTestId - Page test ID to wait for
 * @param options - Optional timeout
 */
export async function waitForAppReady(
  page: Page,
  expectedUrlRegex: RegExp | string,
  expectedPageTestId: keyof typeof import('./testids').PAGE_TESTIDS,
  options?: {
    timeout?: number;
  }
): Promise<void> {
  const urlRegex = typeof expectedUrlRegex === 'string' 
    ? new RegExp(expectedUrlRegex) 
    : expectedUrlRegex;
  
  const timeout = options?.timeout ?? 15_000;

  await expect(page).toHaveURL(urlRegex, { timeout });
  await page.waitForSelector('html[data-app-ready="1"]', { timeout });

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

