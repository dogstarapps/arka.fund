import { expect, test, type Page } from "@playwright/test";
import {
  fixtureArkasPage,
  resolveCatalogFixture,
} from "../src/lib/catalog/testFixtures";
import {
  buildCatalogDerivedMetrics,
  normalizeVaultSortMetric,
  normalizeVaultSortOrder,
  pickDerivedMetricsForEntries,
  rankVaultLeaderboardEntries,
} from "../src/lib/catalog/leaderboardArkas";

async function mockCatalogApi(page: Page) {
  await page.route("**/api/leaderboard/source", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        source: "deployments",
        metrics: {
          ranking: "catalog_rank",
          nav: "catalog_nav",
          profit: "catalog_profit_or_activity",
          volume: "catalog_volume_or_activity",
          activityFallbackWindowEvents: 60,
        },
        oracle: {
          mode: "oracle_guard",
          validatedAt: "2026-04-16",
          network: "testnet",
          rpcUrl: "https://soroban-testnet.stellar.org",
          oracleGuard: "CORACLEGUARD7RTH9KLMNOPQ2UVWX3YZ56789ABCDEFGHJKLMNPRSTUV",
          primaryOracle: "CPRIMARY07RTH9KLMNOPQ2UVWX3YZ56789ABCDEFGHJKLMNPRSTUV",
          secondaryOracle: "CSECONDAR7RTH9KLMNOPQ2UVWX3YZ56789ABCDEFGHJKLMNPRSTUV",
          primaryProvider: "reflector",
          secondaryProvider: "twap_guard",
          provider: "twap_guard",
          validationAsset: "CASSET0007RTH9KLMNOPQ2UVWX3YZ56789ABCDEFGHJKLMNPRSTUV",
          selectedSourceUnderDivergence: 2,
          source: "deployments",
        },
        deployment: {
          targetNetwork: "testnet",
          deploymentsPath: "/tmp/deployments.testnet.json",
          pathSource: "env_path",
          fileFound: true,
          networkMismatch: false,
          readError: null,
        },
      }),
    });
  });

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

  await page.route("**/api/leaderboard/arkas**", async (route) => {
    const url = new URL(route.request().url());
    const sortMetric = normalizeVaultSortMetric(url.searchParams.get("sortMetric"));
    const sortOrder = normalizeVaultSortOrder(
      sortMetric,
      url.searchParams.get("sortOrder"),
    );
    const parsedLimit = Number.parseInt(url.searchParams.get("limit") ?? "24", 10);
    const parsedOffset = Number.parseInt(url.searchParams.get("offset") ?? "0", 10);
    const limit = Number.isFinite(parsedLimit) ? parsedLimit : 24;
    const offset = Number.isFinite(parsedOffset) ? parsedOffset : 0;
    const curatedOnly = url.searchParams.get("curatedOnly");
    const pageData = fixtureArkasPage({
      search: url.searchParams.get("search") ?? undefined,
      curated:
        curatedOnly === "false" || curatedOnly === "0" ? undefined : true,
      limit: 24,
    });
    const metrics = buildCatalogDerivedMetrics(pageData.items);
    const rankedItems = rankVaultLeaderboardEntries(
      pageData.items,
      sortMetric,
      sortOrder,
      metrics,
    );
    const pagedItems = rankedItems.slice(offset, offset + limit);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        source: "api_vault_leaderboard",
        generatedAt: "2026-04-16T12:00:00.000Z",
        query: {
          search: url.searchParams.get("search"),
          curatedOnly:
            curatedOnly === "false" || curatedOnly === "0" ? false : true,
          sortMetric,
          sortOrder,
          limit,
          offset,
          activityFallbackLimit: 60,
        },
        page: {
          total: rankedItems.length,
          offset,
          limit,
          items: pagedItems,
        },
        derivedMetrics: pickDerivedMetricsForEntries(pagedItems, metrics),
      }),
    });
  });
}

test("vault leaderboard separates product profile from live ops", async ({ page }) => {
  await mockCatalogApi(page);

  await page.goto("/vaults");

  await expect(page.getByRole("heading", { name: /arkas leaderboard/i })).toBeVisible();
  await expect(page.getByTestId("vaults-leaderboard-table")).toBeVisible();
  await expect(page.getByTestId("vaults-leaderboard-panel")).toHaveClass(
    /vaults-leaderboard-panel-cutover/,
  );
  await expect(page.getByTestId("vaults-leaderboard-table")).toHaveClass(
    /vaults-leaderboard-table-cutover/,
  );
  await expect(
    page.getByTestId("vaults-leaderboard-table").getByTestId("vault-leaderboard-card").first(),
  ).toHaveClass(/vault-leaderboard-card-cutover/);
  await expect(
    page.getByTestId("vaults-leaderboard-table").getByTestId("vault-leaderboard-card").first(),
  ).toHaveAttribute("data-row-containment", "bounded");
  await expect(page.getByTestId("vault-row-arka-id").first()).toHaveAttribute(
    "title",
    /CA7ALPHA/,
  );
  await expect(page.getByTestId("vault-row-actions").first()).toBeVisible();
  await expect(page.getByTestId("vaults-leaderboard-panel")).toContainText("CA7ALPHA");
  await expect(page.getByTestId("vaults-public-metric-deck")).toContainText("TVL");
  await expect(page.getByTestId("vaults-public-metric-deck")).toContainText("Arkas");
  await expect(page.getByTestId("vaults-listing-toolbar")).toBeVisible();
  await expect(page.getByTestId("vaults-listing-toolbar")).toHaveClass(
    /vaults-listing-toolbar-cutover/,
  );
  await expect(page.getByTestId("vaults-window-strip")).toBeVisible();
  await expect(page.getByTestId("vaults-leaderboard-table")).not.toContainText("of listed TVL");
  await expect(page.getByTestId("vaults-leaderboard-table")).toContainText("Portfolio");
  await expect(page.getByTestId("vault-base-asset-cell").first()).toContainText("USDC");
  await expect(page.getByTestId("vaults-leaderboard-table")).not.toContainText("Risk 1/5");

  const toolbarBox = await page.getByTestId("vaults-listing-toolbar").boundingBox();
  const windowBox = await page.getByTestId("vaults-window-strip").boundingBox();
  if (!toolbarBox || !windowBox) {
    throw new Error("Vault listing toolbar or window selector is not measurable.");
  }
  expect(toolbarBox.y).toBeGreaterThan(windowBox.y + windowBox.height - 1);

  const hasHorizontalOverflow = await page.getByTestId("vaults-leaderboard-table").evaluate((element) => {
    return element.scrollWidth > element.clientWidth + 1;
  });
  expect(hasHorizontalOverflow).toBeFalsy();

  await page.getByTestId("vaults-sort-metric").selectOption("profit");
  await expect(page.getByTestId("vaults-sort-metric")).toHaveValue("profit");
  await expect(page.getByTestId("vaults-leaderboard-table").getByTestId("vault-leaderboard-card").first()).toContainText(
    "CA7BETA",
  );
  await page.getByTestId("vaults-sort-metric").selectOption("volume");
  await expect(page.getByTestId("vaults-sort-metric")).toHaveValue("volume");
  await expect(page.getByTestId("vaults-leaderboard-table").getByTestId("vault-leaderboard-card").first()).toContainText(
    "CA7ALPHA",
  );
  await page.getByTestId("vaults-featured-tab-profit").click();
  await expect(page.getByTestId("vaults-sort-metric")).toHaveValue("profit");
  await expect(page.getByTestId("vaults-leaderboard-table")).toContainText("P/L");
  await page.getByTestId("vaults-search-input").fill("beta");
  await expect(page.getByTestId("vaults-leaderboard-panel")).toContainText("CA7BETA");
  await expect(page.getByTestId("vault-open-ops-link").first()).toHaveAttribute(
    "href",
    /\/arkas\/CA7BETAQFK2MZKJY4R5S8N2P1T6V9W3X7Y2Z5ABCD1EFGH2345678IJ$/,
  );
});

test("vault leaderboard stays responsive without horizontal overflow on mobile", async ({ page }) => {
  await mockCatalogApi(page);
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto("/vaults");

  await expect(page.getByRole("heading", { name: /arkas leaderboard/i })).toBeVisible();
  await expect(page.getByTestId("vaults-listing-toolbar")).toBeVisible();
  await expect(page.getByTestId("vaults-window-strip")).toBeVisible();
  await expect(page.getByTestId("vaults-leaderboard-table")).toBeVisible();

  const panelOverflow = await page.getByTestId("vaults-leaderboard-panel").evaluate((element) => {
    return element.scrollWidth > element.clientWidth + 1;
  });
  expect(panelOverflow).toBeFalsy();
  await expect(page.getByTestId("vault-leaderboard-card").first()).toHaveAttribute(
    "data-row-containment",
    "bounded",
  );

  const listingOverflow = await page.getByTestId("vaults-listing-toolbar").evaluate((element) => {
    return element.scrollWidth > element.clientWidth + 1;
  });
  expect(listingOverflow).toBeFalsy();

});

test("Arkas index opens the selected Arka actions", async ({ page }) => {
  await mockCatalogApi(page);
  await page.goto("/arkas");

  await expect(
    page.getByRole("heading", { name: /arkas leaderboard/i }),
  ).toBeVisible();
  const actionLink = page.getByTestId("vault-open-ops-link").first();
  await expect(actionLink).toHaveAttribute("href", /\/arkas\/CA7ALPHA/);
  await actionLink.click();
  await expect(page).toHaveURL(/\/arkas\/CA7ALPHA/);
  await expect(page.getByTestId("arka-stage-panel")).toBeVisible();
});
