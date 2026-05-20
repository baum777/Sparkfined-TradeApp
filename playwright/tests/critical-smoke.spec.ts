import { test, expect, type Locator, type Page } from '@playwright/test';
import { stubApi } from '../fixtures';
import { PAGE_TESTIDS, pageTestId } from '../utils/testids';
import { gotoAndWait } from '../utils/nav';

/**
 * Critical surface smoke matrix.
 *
 * Goal: catch blank routes, broken lazy chunks, wrong Vercel rewrites, and
 * dead first-screen controls before deeper feature specs run.
 */

test.use({ video: 'off' });

type PageKey = keyof typeof PAGE_TESTIDS;

type SurfaceCheck = {
  name: string;
  locator: (page: Page) => Locator;
};

type CriticalSurface = {
  name: string;
  url: string;
  expectedUrl: RegExp;
  page: PageKey;
  anchors: SurfaceCheck[];
  interaction?: (page: Page) => Promise<void>;
};

const routeReadyTimeoutMs = process.env.PLAYWRIGHT_SYSTEM_CHROME === '1' ? 20_000 : 15_000;

const criticalSurfaces: CriticalSurface[] = [
  {
    name: 'Dashboard',
    url: '/dashboard',
    expectedUrl: /\/dashboard/,
    page: 'dashboard',
    anchors: [
      { name: 'action strip', locator: (page) => page.locator('[data-testid="dashboard-action-strip"]') },
      { name: 'work queue', locator: (page) => page.locator('[data-testid="dashboard-work-queue"]') },
    ],
  },
  {
    name: 'Research',
    url: '/research',
    expectedUrl: /\/research/,
    page: 'research',
    anchors: [
      { name: 'chart canvas', locator: (page) => page.locator('[data-testid="chart-canvas-container"]') },
      { name: 'watchlist toggle', locator: (page) => page.locator('[data-testid="research-watchlist-toggle"]') },
    ],
  },
  {
    name: 'Journal',
    url: '/journal?view=pending',
    expectedUrl: /\/journal/,
    page: 'journal',
    anchors: [
      { name: 'journal search', locator: (page) => page.locator('[data-testid="journal-search"]') },
      { name: 'journal mode toggle', locator: (page) => page.locator('[data-testid="journal-mode-toggle"]') },
    ],
    interaction: async (page) => {
      const search = page.locator('[data-testid="journal-search"]');
      await search.fill('SOL');
      await expect(search).toHaveValue('SOL');
    },
  },
  {
    name: 'Journal detail',
    url: '/journal/entry-1',
    expectedUrl: /\/journal\/entry-1/,
    page: 'journalEntry',
    anchors: [
      { name: 'detail heading', locator: (page) => page.getByRole('heading', { name: 'Journal Entry' }) },
      { name: 'back to journal', locator: (page) => page.getByRole('link', { name: 'Zurück zum Journal' }) },
    ],
  },
  {
    name: 'Insights',
    url: '/insights',
    expectedUrl: /\/insights/,
    page: 'insights',
    anchors: [
      { name: 'unified signals', locator: (page) => page.locator('[data-testid="unified-signals-view"]') },
      { name: 'insight search', locator: (page) => page.getByPlaceholder('Search insights...') },
    ],
    interaction: async (page) => {
      const search = page.getByPlaceholder('Search insights...');
      await search.fill('momentum');
      await expect(search).toHaveValue('momentum');
    },
  },
  {
    name: 'Alerts',
    url: '/alerts',
    expectedUrl: /\/alerts/,
    page: 'alerts',
    anchors: [
      { name: 'create alert', locator: (page) => page.getByRole('button', { name: 'Create alert' }) },
      { name: 'all filter', locator: (page) => page.getByRole('radio', { name: 'Show all alerts' }) },
    ],
    interaction: async (page) => {
      await page.getByRole('button', { name: 'Create alert' }).click();
      await expect(page.getByLabel('Symbol or Address')).toBeVisible({ timeout: routeReadyTimeoutMs });
    },
  },
  {
    name: 'Terminal',
    url: '/terminal',
    expectedUrl: /\/terminal/,
    page: 'terminal',
    anchors: [
      { name: 'terminal shell', locator: (page) => page.locator('[data-testid="terminal-shell"]') },
      { name: 'trade amount', locator: (page) => page.locator('[aria-label="Trade amount"]') },
    ],
  },
  {
    name: 'Settings',
    url: '/settings',
    expectedUrl: /\/settings/,
    page: 'settings',
    anchors: [
      {
        name: 'tier budgets',
        locator: (page) =>
          page.locator('[data-testid="settings-tier-budgets"]').or(
            page.getByRole('button', { name: 'Tier & Budgets API limits and usage quotas' }),
          ),
      },
      {
        name: 'usage counters',
        locator: (page) =>
          page.locator('[data-testid="settings-usage-counters"]').or(
            page.getByRole('button', { name: 'Usage & Counters API call statistics' }),
          ),
      },
      { name: 'export settings', locator: (page) => page.locator('[data-testid="btn-export-settings"]') },
    ],
  },
];

async function installCriticalSmokeGuards(page: Page) {
  await page.addInitScript(() => {
    (window as Window & { __E2E_WALLET_MOCK__?: boolean }).__E2E_WALLET_MOCK__ = true;
    try {
      window.localStorage.setItem('walletName', JSON.stringify('E2E Mock Wallet'));
      window.localStorage.setItem('sparkfined_recent_markets_v1', JSON.stringify(['SOL']));
    } catch {
      // ignore storage access issues in constrained browser contexts
    }
  });

  await page.route('**/*', (route, request) => {
    const url = new URL(request.url());

    if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') {
      return route.fallback();
    }

    return route.fulfill({
      status: 200,
      contentType: 'text/plain',
      body: '',
    });
  });
}

function collectRuntimeErrors(page: Page) {
  const errors: string[] = [];

  page.on('pageerror', (error) => {
    errors.push(error.message);
  });

  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(message.text());
    }
  });

  return errors;
}

test.describe('@critical-smoke Critical UI surfaces', () => {
  test('root redirect reaches Dashboard surface', async ({ page }) => {
    await installCriticalSmokeGuards(page);
    await stubApi(page);

    const runtimeErrors = collectRuntimeErrors(page);
    await gotoAndWait(page, '/', /\/dashboard/, 'dashboard', { timeout: routeReadyTimeoutMs });

    await expect(page.locator('main')).toBeVisible({ timeout: routeReadyTimeoutMs });
    expect(runtimeErrors).toEqual([]);
  });

  for (const surface of criticalSurfaces) {
    test(`${surface.name} renders first screen and critical anchors`, async ({ page }) => {
      test.setTimeout(routeReadyTimeoutMs * 3);

      await installCriticalSmokeGuards(page);
      await stubApi(page);

      const runtimeErrors = collectRuntimeErrors(page);
      await gotoAndWait(page, surface.url, surface.expectedUrl, surface.page, { timeout: routeReadyTimeoutMs });

      await expect(page.locator('main')).toBeVisible({ timeout: routeReadyTimeoutMs });
      await expect(page.locator(pageTestId(surface.page))).toBeVisible({ timeout: routeReadyTimeoutMs });

      for (const anchor of surface.anchors) {
        await expect(anchor.locator(page), `${surface.name}: ${anchor.name}`).toBeVisible({
          timeout: routeReadyTimeoutMs,
        });
      }

      if (surface.interaction) {
        await surface.interaction(page);
      }

      expect(runtimeErrors).toEqual([]);
    });
  }
});
