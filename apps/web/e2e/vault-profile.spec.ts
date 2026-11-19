import { expect, test, type Page } from "@playwright/test";
import { resolveCatalogFixture } from "../src/lib/catalog/testFixtures";

async function mockCatalogApi(page: Page) {
  await page.route("**/api/catalog/**", async (route) => {
    const url = new URL(route.request().url());
    const pathname = url.pathname.replace("/api/catalog", "");
    const body = resolveCatalogFixture(pathname, url.searchParams);
    const status = typeof body === "object" && body !== null && "error" in body ? 404 : 200;
    await route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
}

test("vault profile exposes overview, portfolio, activity and policy tabs", async ({ page }) => {
  await mockCatalogApi(page);

  await page.goto("/vaults/CA7ALPHAQFK2MZKJY4R5S8N2P1T6V9W3X7Y2Z5ABCD1EFGH2345678IJ");

  await expect(page.getByTestId("vault-detail-hero")).toContainText("CA7ALPHA");
  await expect(page.getByTestId("vault-detail-public-metric-deck")).toContainText(
    "TVL",
  );
  await expect(page.getByTestId("vault-detail-public-metric-deck")).toHaveClass(
    /public-detail-metric-deck-cutover/,
  );
  await expect(page.getByTestId("vault-detail-nav")).toContainText("$");
  await expect(page.getByTestId("vault-detail-nav")).toHaveClass(
    /public-detail-metric-card-cutover/,
  );
  await expect(page.getByTestId("vault-detail-trend")).toContainText("+4.41%");
  await expect(page.getByTestId("vault-detail-fees")).toContainText(
    "Management 2.00% · Performance 12.00%",
  );
  await expect(page.getByTestId("vault-detail-hero")).toContainText("Manager");
  await expect(page.getByTestId("vault-detail-tabs")).toContainText("Overview");
  await expect(page.getByTestId("vault-overview-tab")).toContainText("Value over time");
  await expect(page.getByTestId("vault-overview-tab")).toHaveClass(
    /vault-detail-tab-panel/,
  );
  await expect(page.getByTestId("vault-overview-tab")).toHaveClass(
    /public-detail-tab-panel-cutover/,
  );
  await expect(page.getByTestId("vault-profile-table")).toContainText("Denomination");
  await expect(page.getByTestId("vault-profile-table")).toContainText("share issuance address");

  await page.getByRole("button", { name: "Portfolio" }).click();
  await expect(page.getByTestId("vault-portfolio-tab")).toHaveClass(
    /vault-detail-tab-panel/,
  );
  await expect(page.getByTestId("vault-portfolio-tab")).toHaveClass(
    /public-detail-tab-panel-cutover/,
  );
  await expect(page.getByTestId("vault-assets-table")).toContainText("value contribution");
  await expect(page.getByTestId("vault-portfolio-panel")).toContainText("1 market");

  await page.getByRole("button", { name: "Activity" }).click();
  await expect(page.getByTestId("vault-activity-tab")).toHaveClass(
    /vault-detail-tab-panel/,
  );
  await expect(page.getByTestId("vault-activity-tab")).toHaveClass(
    /public-detail-tab-panel-cutover/,
  );
  await expect(page.getByTestId("vault-activity-table")).toContainText("deposit");
  await expect(page.getByTestId("vault-activity-summary-panel")).toContainText("Events");

  await page.getByRole("button", { name: "Policies" }).click();
  await expect(page.getByTestId("vault-policies-tab")).toHaveClass(
    /vault-detail-tab-panel/,
  );
  await expect(page.getByTestId("vault-policies-tab")).toHaveClass(
    /public-detail-tab-panel-cutover/,
  );
  await expect(page.getByTestId("vault-policies-table")).toContainText("Management fee");
  await expect(page.getByTestId("vault-whitelist-table")).toContainText("Allowed asset");
});

test("vault profile stays readable across breakpoints", async ({ page }) => {
  await mockCatalogApi(page);

  const route = "/vaults/CA7ALPHAQFK2MZKJY4R5S8N2P1T6V9W3X7Y2Z5ABCD1EFGH2345678IJ";
  const viewports = [
    { label: "desktop", width: 1440, height: 980 },
    { label: "tablet", width: 900, height: 980 },
    { label: "mobile", width: 390, height: 920 },
  ];

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(route);
    await expect(page.getByTestId("vault-detail-hero")).toBeVisible();
    await expect(page.getByTestId("vault-detail-public-metric-deck")).toBeVisible();
    await expect(page.getByTestId("vault-overview-tab")).toBeVisible();

    const report = await page.evaluate(() => {
      return {
        horizontalOverflow: document.documentElement.scrollWidth - window.innerWidth,
        clipped: Array.from(
          document.querySelectorAll<HTMLElement>(
            "[data-testid='vault-detail-public-metric-deck'] strong, [data-testid='vault-detail-tabs'] button",
          ),
        )
          .filter((element) => element.scrollWidth > element.clientWidth + 2)
          .map((element) => element.textContent?.trim() ?? ""),
      };
    });

    expect(report.horizontalOverflow, `${viewport.label} horizontal overflow`).toBeLessThanOrEqual(2);
    expect(report.clipped, `${viewport.label} clipped labels`).toEqual([]);
  }
});

test("vault profile tabs keep product panels stacked and contained", async ({ page }) => {
  await mockCatalogApi(page);

  await page.setViewportSize({ width: 1280, height: 960 });
  await page.goto("/vaults/CA7ALPHAQFK2MZKJY4R5S8N2P1T6V9W3X7Y2Z5ABCD1EFGH2345678IJ");

  const assertActiveTabPanel = async (testId: string) => {
    await expect(page.getByTestId(testId)).toHaveClass(/vault-detail-tab-panel/);
    await expect(page.getByTestId(testId)).toHaveClass(
      /public-detail-tab-panel-cutover/,
    );
    const report = await page.getByTestId(testId).evaluate((node) => {
      const panel = node as HTMLElement;
      const cards = Array.from(
        panel.querySelectorAll<HTMLElement>(
          ".surface-entry-card, .surface-panel, .metric-card",
        ),
      );
      return {
        overflows: panel.scrollWidth > panel.clientWidth + 1,
        width: Math.round(panel.getBoundingClientRect().width),
        tooNarrowCards: cards
          .map((card) => ({
            text: card.textContent?.trim().slice(0, 60) ?? "",
            width: Math.round(card.getBoundingClientRect().width),
          }))
          .filter((card) => card.width > 0 && card.width < 220),
      };
    });

    expect(report.overflows, `${testId} horizontal overflow`).toBe(false);
    expect(report.width, `${testId} visible width`).toBeGreaterThan(700);
    expect(report.tooNarrowCards, `${testId} narrow cards`).toEqual([]);
  };

  await assertActiveTabPanel("vault-overview-tab");

  await page.getByRole("button", { name: "Portfolio" }).click();
  await assertActiveTabPanel("vault-portfolio-tab");

  await page.getByRole("button", { name: "Activity" }).click();
  await assertActiveTabPanel("vault-activity-tab");

  await page.getByRole("button", { name: "Policies" }).click();
  await assertActiveTabPanel("vault-policies-tab");
});
