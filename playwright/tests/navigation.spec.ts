import { test, expect } from '@playwright/test';

/**
 * Navigation Tests
 * 
 * Testet die grundlegende Navigation in der Anwendung
 */

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');
  });

  test('sollte Root auf /dashboard redirecten', async ({ page }) => {
    await expect(page).toHaveURL('/dashboard');
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
      { tab: 'tab-alerts', url: '/alerts', page: 'page-alerts' },
      { tab: 'tab-watchlist', url: '/watchlist', page: 'page-watchlist' },
      { tab: 'tab-oracle', url: '/oracle', page: 'page-oracle' },
      { tab: 'tab-learn', url: '/learn', page: 'page-learn' },
      { tab: 'tab-handbook', url: '/handbook', page: 'page-handbook' },
      { tab: 'tab-settings', url: '/settings', page: 'page-settings' },
    ] as const;

    const sidebar = page.locator('aside');

    for (const t of tabs) {
      await sidebar.locator(`[data-testid="${t.tab}"]`).click();
      if (t.tab === "tab-research") {
        await expect(page).toHaveURL(/\/research/);
      } else {
        await expect(page).toHaveURL(t.url);
      }
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
    await page.goto('/');
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
    await expect(page).toHaveURL('/journal');

    // Navigiere zu Learn
    await bottomNav.locator('[data-testid="tab-learn"]').click();
    await expect(page).toHaveURL('/learn');

    // Navigiere zu Settings
    await bottomNav.locator('[data-testid="tab-settings"]').click();
    await expect(page).toHaveURL('/settings');
  });
});

test.describe('Active Route Highlighting', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');
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
    await page.goto('/dashboard');

    const dashboardLink = page.locator('aside').locator('[data-testid="tab-dashboard"]');
    await expect(dashboardLink).toHaveClass(/nav-item-active/);
  });
});

test.describe('Responsive Sidebar', () => {
  test('sollte Sidebar auf Desktop anzeigen', async ({ page }) => {
    // Desktop Viewport
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');

    const sidebar = page.locator('aside');
    await expect(sidebar).toBeVisible();
  });

  test('sollte Sidebar collapse funktionieren', async ({ page }) => {
    // Desktop Viewport
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');

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
    await page.goto('/this-route-does-not-exist');
    await expect(page.locator('[data-testid="page-notfound"]')).toBeVisible();
  });
});
