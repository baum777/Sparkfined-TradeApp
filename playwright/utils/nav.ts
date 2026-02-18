import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';
import { pageTestId, type PageTestId } from './testids';

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
    waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
  }
): Promise<void> {
  const urlRegex = typeof expectedUrlRegex === 'string' 
    ? new RegExp(expectedUrlRegex) 
    : expectedUrlRegex;
  
  const timeout = options?.timeout ?? 30000;
  const waitUntil = options?.waitUntil ?? 'domcontentloaded';

  // Navigate and wait for URL in parallel
  await Promise.all([
    page.goto(url, { waitUntil, timeout }),
    page.waitForURL(urlRegex, { timeout }),
  ]);

  // Then wait for page anchor
  const selector = pageTestId(expectedPageTestId);
  await expect(page.locator(selector)).toBeVisible({ timeout: 15000 });
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
  
  const timeout = options?.timeout ?? 30000;
  const navLocator = typeof navSelector === 'string' 
    ? page.locator(navSelector) 
    : navSelector;

  // Click and wait for URL in parallel
  await Promise.all([
    navLocator.click(),
    page.waitForURL(urlRegex, { timeout }),
  ]);

  // Then wait for page anchor
  const selector = pageTestId(expectedPageTestId);
  await expect(page.locator(selector)).toBeVisible({ timeout: 15000 });
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
  
  const timeout = options?.timeout ?? 30000;

  // Wait for URL first
  await page.waitForURL(urlRegex, { timeout });

  // Then wait for page anchor
  const selector = pageTestId(expectedPageTestId);
  await expect(page.locator(selector)).toBeVisible({ timeout: 15000 });
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

