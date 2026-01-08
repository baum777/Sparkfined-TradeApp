import { test, expect } from '@playwright/test';

/**
 * Navigation Tests
 * 
 * Testet die grundlegende Navigation in der Anwendung
 */

// These specs are navigation/routing focused; disable video to avoid platform-specific artifact issues.
test.use({ video: 'off' });

function getUrlParts(raw: string) {
  const url = new URL(raw);
  return { pathname: url.pathname, searchParams: url.searchParams };
}

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

async function stubApi(page: import('@playwright/test').Page) {
  // IMPORTANT: Match only real API calls at /api/... (not source modules under /src/**/api/**)
  await page.route(/^https?:\/\/[^/]+\/api\//, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;

    if (path === '/api/journal' && req.method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [] }),
      });
    }

    if (path.startsWith('/api/feed/') && req.method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    }

    if (path === '/api/signals/unified' && req.method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ user: [], market: [], asOf: new Date().toISOString() }),
      });
    }

    if (path === '/api/market/daily-bias' && req.method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ card: stubFeedCard(), asOf: new Date().toISOString() }),
      });
    }

    if (path === '/api/grok-pulse/meta/last-run' && req.method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ lastRun: null }),
      });
    }
    if (path.startsWith('/api/grok-pulse/snapshot/') && req.method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ snapshot: null }),
      });
    }
    if (path.startsWith('/api/grok-pulse/history/') && req.method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ history: [] }),
      });
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({}),
    });
  });
}

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await stubApi(page);
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
  });

  test('sollte Root auf /dashboard redirecten', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-testid="page-dashboard"]')).toBeVisible({ timeout: 15000 });
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator('[data-testid="page-dashboard"]')).toBeVisible();
  });

  test('sollte alle Primary Tabs navigierbar machen', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    const tabs = [
      { tab: 'tab-dashboard', url: '/dashboard', page: 'page-dashboard' },
      { tab: 'tab-journal', url: '/journal', page: 'page-journal' },
      { tab: 'tab-research', url: '/research', page: 'page-research' },
      { tab: 'tab-insights', url: '/insights', page: 'page-insights' },
      { tab: 'tab-alerts', url: '/alerts', page: 'page-alerts' },
      { tab: 'tab-settings', url: '/settings', page: 'page-settings' },
    ] as const;

    const sidebar = page.locator('aside');

    for (const t of tabs) {
      await sidebar.locator(`[data-testid="${t.tab}"]`).click();

      // Canonical URLs may include query params; assert on pathname + required params where needed.
      const { pathname, searchParams } = getUrlParts(page.url());
      expect(pathname).toBe(t.url);
      if (t.tab === "tab-research") {
        expect(searchParams.get("view")).toBe("chart");
      }
      if (t.tab === "tab-journal") {
        expect(searchParams.get("view")).toBe("pending");
      }

      // Give UI a moment to render while keeping routing tests robust.
      await page.waitForTimeout(250);
      if (errors.length > 0) {
        throw new Error(`Console/Page errors:\n- ${errors.join('\n- ')}`);
      }
      await expect(page.locator(`[data-testid="${t.page}"]`)).toBeVisible({ timeout: 15000 });
    }
  });
});

test.describe('Mobile Navigation', () => {
  test.use({ viewport: { width: 375, height: 667 } }); // iPhone SE size

  test.beforeEach(async ({ page }) => {
    await stubApi(page);
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
  });

  test('sollte Bottom Navigation anzeigen auf Mobile', async ({ page }) => {
    // Desktop Sidebar sollte versteckt sein
    const sidebar = page.locator('aside');
    await expect(sidebar).not.toBeVisible();

    // Bottom Nav sollte sichtbar sein (implizit durch Navigation-Items)
    const bottomNav = page.getByRole('navigation', { name: 'Main navigation' });
    const dashboardNav = bottomNav.locator('[data-testid="tab-dashboard"]');
    await expect(dashboardNav).toBeVisible();
  });

  test('sollte mobile Navigation funktionieren', async ({ page }) => {
    const bottomNav = page.getByRole('navigation', { name: 'Main navigation' });
    // Navigiere zu Journal
    await bottomNav.locator('[data-testid="tab-journal"]').click();
    {
      const { pathname, searchParams } = getUrlParts(page.url());
      expect(pathname).toBe('/journal');
      expect(searchParams.get('view')).toBe('pending');
    }

    // Navigiere zu Research
    await bottomNav.locator('[data-testid="tab-research"]').click();
    {
      const { pathname, searchParams } = getUrlParts(page.url());
      expect(pathname).toBe('/research');
      expect(searchParams.get('view')).toBe('chart');
    }

    // Navigiere zu Alerts
    await bottomNav.locator('[data-testid="tab-alerts"]').click();
    await expect(page).toHaveURL('/alerts');
  });
});

test.describe('Active Route Highlighting', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await stubApi(page);
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
  });

  test('sollte aktive Route highlighten', async ({ page }) => {
    // Navigiere zu Journal
    const sidebar = page.locator('aside');
    await sidebar.locator('[data-testid="tab-journal"]').click();
    
    // Prüfe ob Journal-Link die active Klasse hat
    const journalLink = sidebar.locator('[data-testid="tab-journal"]');
    await expect(journalLink).toHaveClass(/nav-item-active/);
  });

  test('sollte Dashboard als aktiv markieren bei /dashboard', async ({ page }) => {
    await stubApi(page);
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });

    const dashboardLink = page.locator('aside').locator('[data-testid="tab-dashboard"]');
    await expect(dashboardLink).toHaveClass(/nav-item-active/);
  });
});

test.describe('Responsive Sidebar', () => {
  test('sollte Sidebar auf Desktop anzeigen', async ({ page }) => {
    // Desktop Viewport
    await page.setViewportSize({ width: 1280, height: 720 });
    await stubApi(page);
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });

    const sidebar = page.locator('aside');
    await expect(sidebar).toBeVisible();
  });

  test('sollte Sidebar collapse funktionieren', async ({ page }) => {
    // Desktop Viewport
    await page.setViewportSize({ width: 1280, height: 720 });
    await stubApi(page);
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });

    // Finde Collapse Button (ChevronLeft icon)
    const collapseButton = page.locator('aside button[aria-label*="sidebar"]').first();
    await expect(collapseButton).toBeVisible();

    // Klicke Collapse
    await collapseButton.click();
    
    // Warte für Animation
    await page.waitForTimeout(300);

    // Sidebar sollte jetzt collapsed sein (schmaler)
    const sidebar = page.locator('aside');
    const sidebarBox = await sidebar.boundingBox();
    expect(sidebarBox?.width).toBeLessThan(100); // Collapsed width ~64px
  });
});

test.describe('404', () => {
  test('unbekannte Route sollte NotFound anzeigen', async ({ page }) => {
    await stubApi(page);
    await page.goto('/this-route-does-not-exist');
    await expect(page.locator('[data-testid="page-notfound"]')).toBeVisible();
  });
});
