import { test, expect } from "@playwright/test";

/**
 * Route contract smoke tests (tabs + secondary deep links)
 */

function getUrlParts(raw: string) {
  const url = new URL(raw);
  return { pathname: url.pathname, searchParams: url.searchParams, hash: url.hash };
}

test.describe("Secondary Routes", () => {
  test("sollte alle Secondary Routes direkt öffnen können", async ({ page }) => {
    const routes = [
      { url: "/journal?mode=inbox&view=pending", testId: "page-journal" },
      { url: "/journal?mode=learn&view=pending", testId: "page-journal" },
      { url: "/journal/entry-1", testId: "page-journal-entry" },

      // Legacy oracle routes redirect into Insights
      { url: "/oracle/inbox", testId: "page-insights" },
      { url: "/oracle/oracle-1", testId: "page-insights-detail" },
      { url: "/oracle/status", testId: "page-insights" },

      // Legacy settings routes redirect into Settings (section param)
      { url: "/settings/providers", testId: "page-settings" },
      { url: "/settings/data", testId: "page-settings" },
      { url: "/settings/experiments", testId: "page-settings" },
      { url: "/settings/privacy", testId: "page-settings" },

      // Valid Solana base58 mint (wSOL)
      { url: "/asset/So11111111111111111111111111111111111111112", testId: "page-research" },
    ] as const;

    for (const r of routes) {
      await page.goto(r.url);
      await expect(page.locator(`[data-testid="${r.testId}"]`)).toBeVisible();
    }
  });
});

test("legacy /chart redirectet zur canonical research route", async ({ page }) => {
  await page.goto("/chart?q=SOL");
  const { pathname, searchParams } = getUrlParts(page.url());
  expect(pathname).toBe("/research");
  expect(searchParams.get("view")).toBe("chart");
  expect(searchParams.get("q")).toBe("SOL");
  await expect(page.locator('[data-testid="page-research"]')).toBeVisible();
});

test("legacy /replay redirectet zur canonical research route mit replay flag", async ({ page }) => {
  await page.goto("/replay");
  const { pathname, searchParams } = getUrlParts(page.url());
  expect(pathname).toBe("/research");
  expect(searchParams.get("view")).toBe("chart");
  expect(searchParams.get("replay")).toBe("true");
  await expect(page.locator('[data-testid="page-research"]')).toBeVisible();
});

test("legacy /journal?entry=123 redirectet zu /journal/123", async ({ page }) => {
  await page.goto("/journal?entry=123");
  const { pathname } = getUrlParts(page.url());
  expect(pathname).toBe("/journal/123");
  await expect(page.locator('[data-testid="page-journal-entry"]')).toBeVisible();
});

test("/journal/123 rendert die Detail Route", async ({ page }) => {
  await page.goto("/journal/123");
  await expect(page.locator('[data-testid="page-journal-entry"]')).toBeVisible();
});

test("/journal?view=pending rendert die List Route", async ({ page }) => {
  await page.goto("/journal?view=pending");
  const { pathname, searchParams } = getUrlParts(page.url());
  expect(pathname).toBe("/journal");
  expect(searchParams.get("view")).toBe("pending");
  await expect(page.locator('[data-testid="page-journal"]')).toBeVisible();
});

