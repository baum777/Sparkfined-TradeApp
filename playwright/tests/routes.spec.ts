import { test, expect } from "@playwright/test";

/**
 * Route contract smoke tests (tabs + secondary deep links)
 */

// These specs are routing/redirect focused; disable video to avoid platform-specific artifact issues.
test.use({ video: "off" });

function getUrlParts(raw: string) {
  const url = new URL(raw);
  return { pathname: url.pathname, searchParams: url.searchParams, hash: url.hash };
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

async function stubApi(page: import("@playwright/test").Page) {
  // IMPORTANT: Match only real API calls at /api/... (not source modules under /src/**/api/**)
  await page.route(/^https?:\/\/[^/]+\/api\//, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;
    const nowIso = new Date().toISOString();

    // Journal
    if (path === "/api/journal" && req.method() === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { items: [] }, status: 200 }),
      });
    }

    // Feed endpoints
    if (path === "/api/feed/pulse" && req.method() === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            assetResolved: {
              input: url.searchParams.get("asset") ?? "SOL",
              kind: "ticker",
              symbol: "SOL",
              address: "So11111111111111111111111111111111111111112",
            },
            snapshot: null,
            history: [],
            updatedAt: nowIso,
          },
          status: 200,
        }),
      });
    }
    if (path.startsWith("/api/feed/") && req.method() === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: [], status: 200 }),
      });
    }

    // Unified signals
    if (path === "/api/signals/unified" && req.method() === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { user: [], market: [], asOf: nowIso }, status: 200 }),
      });
    }

    // Daily bias
    if (path === "/api/market/daily-bias" && req.method() === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { card: stubFeedCard(), asOf: nowIso }, status: 200 }),
      });
    }

    // Default: succeed fast with empty JSON for routing tests.
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: {}, status: 200 }),
    });
  });
}

test.describe("Secondary Routes", () => {
  test("sollte alle Secondary Routes direkt öffnen können", async ({ page }) => {
    await stubApi(page);
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
      await page.goto(r.url, { waitUntil: "domcontentloaded" });
      await expect(page.locator(`[data-testid="${r.testId}"]`)).toBeVisible({ timeout: 15000 });
    }
  });
});

test("legacy /chart redirectet zur canonical research route", async ({ page }) => {
  await stubApi(page);
  await page.goto("/chart?q=SOL");
  await expect(page.locator('[data-testid="page-research"]')).toBeVisible({ timeout: 15000 });
  const { pathname, searchParams } = getUrlParts(page.url());
  expect(pathname).toBe("/research");
  expect(searchParams.get("view")).toBe("chart");
  expect(searchParams.get("q")).toBe("SOL");
});

test("legacy /replay redirectet zur canonical research route mit replay flag", async ({ page }) => {
  await stubApi(page);
  await page.goto("/replay");
  await expect(page.locator('[data-testid="page-research"]')).toBeVisible({ timeout: 15000 });
  const { pathname, searchParams } = getUrlParts(page.url());
  expect(pathname).toBe("/research");
  expect(searchParams.get("view")).toBe("chart");
  expect(searchParams.get("replay")).toBe("true");
});

test("legacy /journal?entry=123 redirectet zu /journal/123", async ({ page }) => {
  await stubApi(page);
  await page.goto("/journal?entry=123");
  await expect(page.locator('[data-testid="page-journal-entry"]')).toBeVisible({ timeout: 15000 });
  const { pathname } = getUrlParts(page.url());
  expect(pathname).toBe("/journal/123");
});

test("/journal/123 rendert die Detail Route", async ({ page }) => {
  await stubApi(page);
  await page.goto("/journal/123");
  await expect(page.locator('[data-testid="page-journal-entry"]')).toBeVisible({ timeout: 15000 });
});

test("/journal?view=pending rendert die List Route", async ({ page }) => {
  await stubApi(page);
  await page.goto("/journal?view=pending");
  const { pathname, searchParams } = getUrlParts(page.url());
  expect(pathname).toBe("/journal");
  expect(searchParams.get("view")).toBe("pending");
  await expect(page.locator('[data-testid="page-journal"]')).toBeVisible({ timeout: 15000 });
});

