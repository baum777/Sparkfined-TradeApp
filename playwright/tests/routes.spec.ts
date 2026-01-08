import { test, expect } from "@playwright/test";

/**
 * Route contract smoke tests (tabs + secondary deep links)
 */

test.describe("Secondary Routes", () => {
  test("sollte alle Secondary Routes direkt öffnen können", async ({ page }) => {
    const routes = [
      { url: "/journal?mode=inbox&view=pending", testId: "page-journal" },
      { url: "/journal?mode=learn&view=pending", testId: "page-journal" },
      { url: "/journal/entry-1", testId: "page-journal-entry" },

      { url: "/oracle/inbox", testId: "page-oracle-inbox" },
      { url: "/oracle/oracle-1", testId: "page-oracle-insight" },
      { url: "/oracle/status", testId: "page-oracle-status" },

      { url: "/settings/providers", testId: "page-settings-providers" },
      { url: "/settings/data", testId: "page-settings-data" },
      { url: "/settings/experiments", testId: "page-settings-experiments" },
      { url: "/settings/privacy", testId: "page-settings-privacy" },

      // Valid Solana base58 mint (wSOL)
      { url: "/asset/So11111111111111111111111111111111111111112", testId: "page-asset" },
    ] as const;

    for (const r of routes) {
      await page.goto(r.url);
      await expect(page.locator(`[data-testid="${r.testId}"]`)).toBeVisible();
    }
  });
});

test("legacy /chart redirectet zur canonical research route", async ({ page }) => {
  await page.goto("/chart?q=SOL");
  await expect(page).toHaveURL("/research?view=chart&q=SOL");
  await expect(page.locator('[data-testid="page-research"]')).toBeVisible();
});

test("legacy /replay redirectet zur canonical research route mit replay flag", async ({ page }) => {
  await page.goto("/replay");
  await expect(page).toHaveURL("/research?view=chart&replay=true");
  await expect(page.locator('[data-testid="page-research"]')).toBeVisible();
});

