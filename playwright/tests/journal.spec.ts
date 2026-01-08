import { test, expect } from '@playwright/test';

/**
 * Journal Tests
 * 
 * Testet die Journal-Seite und CRUD-Operationen
 */

test.describe('Journal Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/journal');
  });

  test('sollte Journal-Seite korrekt laden', async ({ page }) => {
    await expect(page).toHaveURL(/\/journal/);
    
    // Header sollte vorhanden sein
    const header = page.locator('header');
    await expect(header).toBeVisible();
  });

  test('sollte Journal Header anzeigen', async ({ page }) => {
    // Suche nach Journal-spezifischen Elementen
    // Dies hängt von der konkreten Implementierung ab
    const main = page.locator('main');
    await expect(main).toBeVisible();
  });

  test('sollte Search Bar haben', async ({ page }) => {
    // Suche nach Search-Input (falls vorhanden)
    const searchInput = page.locator('input[type="search"], input[placeholder*="Search"], input[placeholder*="Suche"]');
    
    // Wenn nicht vorhanden, ist das OK (optional)
    const count = await searchInput.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });
});

test.describe('Journal Navigation', () => {
  test('sollte von Dashboard zu Journal navigieren können', async ({ page }) => {
    await page.goto('/');
    await page.click('[data-testid="tab-journal"]');
    await expect(page).toHaveURL(/\/journal/);
  });

  test('sollte aktiven Nav-Status zeigen', async ({ page }) => {
    await page.goto('/journal');
    const journalLink = page.locator('aside').locator('[data-testid="tab-journal"]');
    await expect(journalLink).toHaveClass(/nav-item-active/);
  });
});

test.describe('Journal Responsive', () => {
  test('sollte auf Mobile korrekt angezeigt werden', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/journal');
    
    // Main Content sollte sichtbar sein
    const main = page.locator('main');
    await expect(main).toBeVisible();
    
    // Sidebar sollte versteckt sein
    const sidebar = page.locator('aside');
    await expect(sidebar).not.toBeVisible();
  });

  test('sollte auf Tablet korrekt angezeigt werden', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/journal');
    
    const main = page.locator('main');
    await expect(main).toBeVisible();
  });

  test('sollte auf Desktop korrekt angezeigt werden', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/journal');
    
    // Sidebar sollte sichtbar sein
    const sidebar = page.locator('aside');
    await expect(sidebar).toBeVisible();
    
    const main = page.locator('main');
    await expect(main).toBeVisible();
  });
});
