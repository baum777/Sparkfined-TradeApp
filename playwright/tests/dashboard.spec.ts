import { test, expect } from '@playwright/test';
import { stubApi } from '../fixtures';
import { pageTestId } from '../utils/testids';

/**
 * Dashboard Tests
 * 
 * Testet die Dashboard-Seite und ihre Komponenten
 */

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await stubApi(page);
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  });

  test('sollte Dashboard-Seite korrekt laden', async ({ page }) => {
    // Warte darauf, dass die Seite geladen ist
    await expect(page).toHaveURL('/dashboard');
    
    // Prüfe ob Header vorhanden ist
    const header = page.getByRole('banner');
    await expect(header).toBeVisible();
    
    // Prüfe ob main content vorhanden ist
    const main = page.locator('main');
    await expect(main).toBeVisible();
  });

  test('sollte Header mit Notification und User Icons anzeigen', async ({ page }) => {
    // Notification entry is a navigation link to Alerts.
    const notificationLink = page.getByRole('link', { name: 'Notifications' });
    await expect(notificationLink).toBeVisible();

    // User Menu Button
    const userButton = page.locator('button[aria-label="User menu"]');
    await expect(userButton).toBeVisible();
  });

  test('sollte keine JavaScript-Fehler haben', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => {
      errors.push(error.message);
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    expect(errors).toHaveLength(0);
  });

  test('sollte responsive sein', async ({ page }) => {
    await stubApi(page);
    // Desktop
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');
    await expect(page.locator('aside')).toBeVisible(); // Sidebar visible

    // Mobile - need to wait for viewport change to take effect
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(100); // Allow CSS media queries to update
    await expect(page.locator('aside')).not.toBeVisible(); // Sidebar hidden
  });
});

test.describe('Dashboard Content', () => {
  test.beforeEach(async ({ page }) => {
    await stubApi(page);
    await page.goto('/');
  });

  test('sollte Dashboard-Header mit Logo anzeigen', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 }); // Mobile
    const logo = page.locator('header').getByText('TradeApp');
    await expect(logo).toBeVisible();
  });
});

test.describe('Dashboard Performance', () => {
  test('sollte schnell laden (unter 10 Sekunden)', async ({ page }) => {
    await stubApi(page);
    const loadBudgetMs = process.env.PLAYWRIGHT_SYSTEM_CHROME === '1' ? 13_000 : 10_000;
    const startTime = Date.now();
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    // Wait for dashboard page to be visible (functional readiness, not networkidle)
    await expect(page.locator(pageTestId('dashboard'))).toBeVisible();
    const loadTime = Date.now() - startTime;

    // Performance assertion: page should be functionally ready in < 10s
    // On unsupported Playwright browser platforms we use an explicit System-Chrome fallback
    // that has higher startup overhead; use a dedicated budget for that path.
    expect(loadTime).toBeLessThan(loadBudgetMs);
  });

  test('sollte keine blockierenden Requests haben', async ({ page }) => {
    await stubApi(page);
    const blockedRequests: string[] = [];
    
    page.on('request', (request) => {
      if (request.timing()?.responseEnd && request.timing()!.responseEnd > 2000) {
        blockedRequests.push(request.url());
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    expect(blockedRequests).toHaveLength(0);
  });
});
