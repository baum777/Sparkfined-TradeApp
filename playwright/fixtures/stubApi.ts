import type { Page } from '@playwright/test';

/**
 * Central API Stub Fixture
 * 
 * Provides consistent API stubbing for E2E tests.
 * Default envelope format: { status: "ok", data }
 */

export interface StubApiOptions {
  /**
   * Custom route handlers (optional)
   * If not provided, uses default handlers
   */
  routes?: Record<string, (req: import('@playwright/test').Route, url: URL) => Promise<void>>;
}

/**
 * Stub feed card for testing
 */
function stubFeedCard() {
  return {
    id: "stub-1",
    kind: "oracle",
    scope: "market",
    title: "Stub",
    why: "Stubbed for routing tests",
    impact: "low",
    asOf: new Date().toISOString(),
    freshness: { status: "fresh", ageSec: 0 },
    confidence: 0.5,
  } as const;
}

/**
 * Default API stub handlers
 */
async function defaultRouteHandler(
  route: import('@playwright/test').Route,
  req: import('@playwright/test').Request,
  url: URL
): Promise<void> {
  const path = url.pathname;
  const nowIso = new Date().toISOString();

  // Journal
  if (path === '/api/journal' && req.method() === 'GET') {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ok', data: { items: [] } }),
    });
  }

  // Feed pulse
  if (path === '/api/feed/pulse' && req.method() === 'GET') {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'ok',
        data: {
          assetResolved: {
            input: url.searchParams.get('asset') ?? 'SOL',
            kind: 'ticker',
            symbol: 'SOL',
            address: 'So11111111111111111111111111111111111111112',
          },
          snapshot: null,
          history: [],
          updatedAt: nowIso,
        },
      }),
    });
  }

  // Feed (generic)
  if (path.startsWith('/api/feed/') && req.method() === 'GET') {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ok', data: [] }),
    });
  }

  // Unified signals
  if (path === '/api/signals/unified' && req.method() === 'GET') {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ok', data: { user: [], market: [], asOf: nowIso } }),
    });
  }

  // Market daily bias
  if (path === '/api/market/daily-bias' && req.method() === 'GET') {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ok', data: { card: stubFeedCard(), asOf: nowIso } }),
    });
  }

  // Default: succeed with empty data
  return route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ status: 'ok', data: {} }),
  });
}

/**
 * Stub API calls for E2E tests
 * 
 * @param page - Playwright page
 * @param options - Optional custom route handlers
 * 
 * @example
 * ```ts
 * await stubApi(page);
 * await page.goto('/dashboard');
 * ```
 */
export async function stubApi(page: Page, options?: StubApiOptions): Promise<void> {
  // IMPORTANT: Match only real API calls at /api/... (not source modules under /src/**/api/**)
  await page.route(/^https?:\/\/[^/]+\/api\//, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;

    // Use custom handler if provided, otherwise use default
    if (options?.routes && options.routes[path]) {
      await options.routes[path](route, url);
    } else {
      await defaultRouteHandler(route, req, url);
    }
  });
}

