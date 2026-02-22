import { test, expect } from "@playwright/test";
import { stubApi } from "../fixtures";
import { pageTestId, PAGE_TESTIDS } from "../utils/testids";
import { gotoAndWait, getUrlParts } from "../utils/nav";

/**
 * Route contract smoke tests (tabs + secondary deep links)
 */

// These specs are routing/redirect focused; disable video to avoid platform-specific artifact issues.
test.use({ video: "off" });

test.describe("Secondary Routes", () => {
  const routes = [
    { url: "/journal?mode=inbox&view=pending", pageTestId: "journal" as const, expectedUrl: /\/journal/ },
    { url: "/journal?mode=learn&view=pending", pageTestId: "journal" as const, expectedUrl: /\/journal/ },
    { url: "/journal/entry-1", pageTestId: "journalEntry" as const, expectedUrl: /\/journal\/entry-1/ },

    // Legacy oracle routes redirect into Insights
    { url: "/oracle/inbox", pageTestId: "insights" as const, expectedUrl: /\/insights/ },
    { url: "/oracle/oracle-1", pageTestId: "insightsDetail" as const, expectedUrl: /\/insights\/oracle-1/ },
    { url: "/oracle/status", pageTestId: "insights" as const, expectedUrl: /\/insights/ },

    // Legacy settings routes redirect into Settings (section param)
    { url: "/settings/providers", pageTestId: "settings" as const, expectedUrl: /\/settings/ },
    { url: "/settings/data", pageTestId: "settings" as const, expectedUrl: /\/settings/ },
    { url: "/settings/experiments", pageTestId: "settings" as const, expectedUrl: /\/settings/ },
    { url: "/settings/privacy", pageTestId: "settings" as const, expectedUrl: /\/settings/ },

    // Valid Solana base58 mint (wSOL)
    { url: "/asset/So11111111111111111111111111111111111111112", pageTestId: "research" as const, expectedUrl: /\/research/ },
  ] as const;

  for (const r of routes) {
    test(`öffnet Secondary Route: ${r.url}`, async ({ page }) => {
      await stubApi(page);
      test.setTimeout(30000);
      await gotoAndWait(page, r.url, r.expectedUrl, r.pageTestId, { timeout: 30000 });
    });
  }
});

test("legacy /chart redirectet zur canonical research route", async ({ page }) => {
  await stubApi(page);
  await gotoAndWait(page, "/chart?q=SOL", /\/research/, "research", { timeout: 30000 });
  await expect(page).toHaveURL(/\/research/);
  const { pathname, searchParams } = getUrlParts(page.url());
  expect(pathname).toBe("/research");
  expect(searchParams.get("view")).toBe("chart");
  expect(searchParams.get("q")).toBe("SOL");
});

test("legacy /replay redirectet zur canonical research route mit replay flag", async ({ page }) => {
  await stubApi(page);
  await gotoAndWait(page, "/replay", /\/research/, "research");
  await expect(page).toHaveURL(/\/research/);
  const { pathname, searchParams } = getUrlParts(page.url());
  expect(pathname).toBe("/research");
  expect(searchParams.get("view")).toBe("chart");
  expect(searchParams.get("replay")).toBe("true");
});

test("legacy /journal?entry=123 redirectet zu /journal/123", async ({ page }) => {
  await stubApi(page);
  await gotoAndWait(page, "/journal?entry=123", /\/journal\/123/, "journalEntry");
  await expect(page).toHaveURL(/\/journal\/123/);
  const { pathname } = getUrlParts(page.url());
  expect(pathname).toBe("/journal/123");
});

test("/journal/123 rendert die Detail Route", async ({ page }) => {
  await stubApi(page);
  await gotoAndWait(page, "/journal/123", /\/journal\/123/, "journalEntry");
});

test("/journal?view=pending rendert die List Route", async ({ page }) => {
  await stubApi(page);
  await gotoAndWait(page, "/journal?view=pending", /\/journal/, "journal");
  const { pathname, searchParams } = getUrlParts(page.url());
  expect(pathname).toBe("/journal");
  expect(searchParams.get("view")).toBe("pending");
});

