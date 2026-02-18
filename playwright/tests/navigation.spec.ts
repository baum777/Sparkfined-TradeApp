import { test, expect } from '@playwright/test';
import { stubApi } from '../fixtures';
import { pageTestId, navTestId, PAGE_TESTIDS, NAV_TESTIDS } from '../utils/testids';
import { clickNavAndWait, getUrlParts } from '../utils/nav';

/**
 * Navigation Tests
 * 
 * Testet die grundlegende Navigation in der Anwendung
 */

// These specs are navigation/routing focused; disable video to avoid platform-specific artifact issues.
test.use({ video: 'off' });

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await stubApi(page);
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
  });

  test('sollte Root auf /dashboard redirecten', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator(pageTestId('dashboard'))).toBeVisible({ timeout: 15000 });
  });

  test('sollte alle Primary Tabs navigierbar machen', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    const tabs = [
      { tab: 'dashboard' as const, url: '/dashboard', page: 'dashboard' as const, expectedParams: {} },
      { tab: 'journal' as const, url: '/journal', page: 'journal' as const, expectedParams: { view: 'pending' } },
      { tab: 'research' as const, url: '/research', page: 'research' as const, expectedParams: { view: 'chart' } },
      { tab: 'insights' as const, url: '/insights', page: 'insights' as const, expectedParams: {} },
      { tab: 'alerts' as const, url: '/alerts', page: 'alerts' as const, expectedParams: {} },
      { tab: 'settings' as const, url: '/settings', page: 'settings' as const, expectedParams: {} },
    ] as const;

    const sidebar = page.locator('aside');

    for (const t of tabs) {
      // Use standardized navigation pattern
      await clickNavAndWait(
        page,
        sidebar.locator(navTestId(t.tab)),
        new RegExp(`^.*${t.url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
        t.page
      );

      // Verify URL and query params
      const { pathname, searchParams } = getUrlParts(page.url());
      expect(pathname).toBe(t.url);
      for (const [key, value] of Object.entries(t.expectedParams)) {
        expect(searchParams.get(key)).toBe(value);
      }

      // Check for console errors
      if (errors.length > 0) {
        throw new Error(`Console/Page errors:\n- ${errors.join('\n- ')}`);
      }
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
    const dashboardNav = bottomNav.locator(navTestId('dashboard'));
    await expect(dashboardNav).toBeVisible();
  });

  test('sollte mobile Navigation funktionieren', async ({ page }) => {
    const bottomNav = page.getByRole('navigation', { name: 'Main navigation' });
    
    // Navigiere zu Journal
    await clickNavAndWait(page, bottomNav.locator(navTestId('journal')), /\/journal/, 'journal');
    {
      const { pathname, searchParams } = getUrlParts(page.url());
      expect(pathname).toBe('/journal');
      expect(searchParams.get('view')).toBe('pending');
    }

    // Navigiere zu Research
    await clickNavAndWait(page, bottomNav.locator(navTestId('research')), /\/research/, 'research');
    {
      const { pathname, searchParams } = getUrlParts(page.url());
      expect(pathname).toBe('/research');
      expect(searchParams.get('view')).toBe('chart');
    }

    // Navigiere zu Alerts
    await clickNavAndWait(page, bottomNav.locator(navTestId('alerts')), /\/alerts/, 'alerts');
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
    await clickNavAndWait(page, sidebar.locator(navTestId('journal')), /\/journal/, 'journal');
    
    // Prüfe ob Journal-Link die active Klasse hat
    const journalLink = sidebar.locator(navTestId('journal'));
    await expect(journalLink).toHaveClass(/nav-item-active/);
  });

  test('sollte Dashboard als aktiv markieren bei /dashboard', async ({ page }) => {
    await stubApi(page);
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await expect(page.locator(pageTestId('dashboard'))).toBeVisible();

    const dashboardLink = page.locator('aside').locator(navTestId('dashboard'));
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
    await page.goto('/this-route-does-not-exist', { waitUntil: 'domcontentloaded' });
    await expect(page.locator(pageTestId('notFound'))).toBeVisible();
  });
});
