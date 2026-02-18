import { test, expect } from "@playwright/test";
import { pageTestId } from "../utils/testids";
import { getUrlParts } from "../utils/nav";

test.describe("Research chart search validation (strict + escape hatch)", () => {
  test("invalid input shows inline error and 'Search anyway' navigates with raw trimmed", async ({
    page,
  }) => {
    await page.goto("/dashboard");

    const input = page.getByLabel("Search token or contract");
    await input.fill("hello$");

    await page.getByRole("button", { name: "Search", exact: true }).click();

    await expect(page.getByText("Invalid query:", { exact: false })).toBeVisible();
    await expect(page.getByRole("button", { name: "Search anyway" })).toBeVisible();

    // Still on dashboard until escape hatch is used
    expect(getUrlParts(page.url()).pathname).toBe("/dashboard");

    await page.getByRole("button", { name: "Search anyway" }).click();

    const { pathname, searchParams } = getUrlParts(page.url());
    expect(pathname).toBe("/research");
    expect(searchParams.get("view")).toBe("chart");
    expect(searchParams.get("q")).toBe("hello$");
    await expect(page.locator(pageTestId('research'))).toBeVisible();
  });

  test("valid ticker normalizes to uppercase and navigates via canonical research route", async ({
    page,
  }) => {
    await page.goto("/dashboard");

    const input = page.getByLabel("Search token or contract");
    await input.fill("sol");
    await page.getByRole("button", { name: "Search", exact: true }).click();

    const { pathname, searchParams } = getUrlParts(page.url());
    expect(pathname).toBe("/research");
    expect(searchParams.get("view")).toBe("chart");
    expect(searchParams.get("q")).toBe("SOL");
    await expect(page.locator(pageTestId('research'))).toBeVisible();
  });
});


