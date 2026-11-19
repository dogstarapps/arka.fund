import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  fixtureArkasPage,
  fixtureManagersPage,
  resolveCatalogFixture,
} from "../src/lib/catalog/testFixtures";
import {
  CORE_STELLAR_ASSET_REGISTRY,
  buildCoreStellarAssetMetadata,
} from "../src/lib/catalog/coreStellarAssetRegistry";
import {
  buildCatalogDerivedMetrics,
  normalizeVaultSortMetric,
  normalizeVaultSortOrder,
  pickDerivedMetricsForEntries,
  rankVaultLeaderboardEntries,
} from "../src/lib/catalog/leaderboardArkas";
import {
  normalizeManagerSortMetric,
  normalizeManagerSortOrder,
  rankManagerLeaderboardEntries,
} from "../src/lib/catalog/leaderboardManagers";

const FIXTURE_ASSET_ID =
  "CD25MNVTZDL4Y3XBCPCJXGXATV5WUHHOWMYFF4YBEGU5FCPGMYTVG5JY";

const RESPONSIVE_VIEWPORTS = [
  { label: "desktop", width: 1440, height: 1050 },
  { label: "tablet", width: 834, height: 1120 },
  { label: "mobile", width: 390, height: 900 },
] as const;

type SearchRoute = {
  label: string;
  route: string;
  inputTestId: string;
  value: string;
  panelTestId: string;
  expectedCopy: RegExp;
};

const SEARCH_ROUTES: SearchRoute[] = [
  {
    label: "discover",
    route: "/discover",
    inputTestId: "discover-search-input",
    value: "gamma",
    panelTestId: "discover-public-collection-board",
    expectedCopy: /CA7GAMMA|gamma/i,
  },
  {
    label: "arkas leaderboard",
    route: "/vaults",
    inputTestId: "vaults-search-input",
    value: "beta",
    panelTestId: "vaults-leaderboard-panel",
    expectedCopy: /CA7BETA|beta/i,
  },
  {
    label: "managers leaderboard",
    route: "/managers",
    inputTestId: "managers-search-input",
    value: "alpha",
    panelTestId: "managers-list-panel",
    expectedCopy: /GCAALPHA|alpha/i,
  },
  {
    label: "assets",
    route: "/assets",
    inputTestId: "assets-search-input",
    value: "usdc",
    panelTestId: "assets-list-panel",
    expectedCopy: /USDC/i,
  },
];

async function mockCatalogBackends(page: Page): Promise<void> {
  await page.route("**/api/assets/core-registry", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        generatedAt: "2026-05-03T12:00:00.000Z",
        items: CORE_STELLAR_ASSET_REGISTRY.map((entry) =>
          buildCoreStellarAssetMetadata(entry),
        ),
      }),
    });
  });

  await page.route("**/api/leaderboard/source", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        source: "runtime_leaderboard_source",
        generatedAt: "2026-05-03T12:00:00.000Z",
        oracle: {
          mode: "oracle_guard",
          validatedAt: "2026-05-03",
          network: "testnet",
          primaryProvider: "reflector",
          secondaryProvider: "twap_guard",
          provider: "twap_guard",
          selectedSourceUnderDivergence: 2,
          source: "deployments",
        },
        metrics: {
          ranking: "catalog_rank",
          nav: "catalog_nav",
          profit: "catalog_profit_or_activity",
          volume: "catalog_volume_or_activity",
          activityFallbackWindowEvents: 60,
        },
        deployment: {
          targetNetwork: "testnet",
          deploymentsPath: "/var/arkafund/deployments.testnet.json",
          pathSource: "network_default",
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
    const status =
      typeof body === "object" && body !== null && "error" in body ? 404 : 200;
    await route.fulfill({
      status: pathname.startsWith("/v1/") ? status : 404,
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
      curated: curatedOnly === "false" || curatedOnly === "0" ? undefined : true,
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
        generatedAt: "2026-05-03T12:00:00.000Z",
        query: {
          search: url.searchParams.get("search"),
          curatedOnly: curatedOnly === "false" || curatedOnly === "0" ? false : true,
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

  await page.route("**/api/leaderboard/managers**", async (route) => {
    const url = new URL(route.request().url());
    const sortMetric = normalizeManagerSortMetric(
      url.searchParams.get("sortMetric"),
    );
    const sortOrder = normalizeManagerSortOrder(
      sortMetric,
      url.searchParams.get("sortOrder"),
    );
    const parsedLimit = Number.parseInt(url.searchParams.get("limit") ?? "24", 10);
    const parsedOffset = Number.parseInt(url.searchParams.get("offset") ?? "0", 10);
    const limit = Number.isFinite(parsedLimit) ? parsedLimit : 24;
    const offset = Number.isFinite(parsedOffset) ? parsedOffset : 0;
    const pageData = fixtureManagersPage({
      search: url.searchParams.get("search") ?? undefined,
      limit: 24,
    });
    const rankedItems = rankManagerLeaderboardEntries(
      pageData.items,
      sortMetric,
      sortOrder,
    );
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        source: "api_manager_leaderboard",
        generatedAt: "2026-05-03T12:00:00.000Z",
        query: {
          search: url.searchParams.get("search"),
          sortMetric,
          sortOrder,
          limit,
          offset,
        },
        page: {
          total: rankedItems.length,
          offset,
          limit,
          items: rankedItems.slice(offset, offset + limit),
        },
      }),
    });
  });
}

async function expectNoUnresolvedSurfaceCopy(locator: Locator): Promise<void> {
  const text = await locator.innerText();
  expect(text).not.toMatch(/\b(undefined|null|NaN|TODO|FIXME|lorem|fake|stub|skeleton)\b/i);
}

async function expectNoPageHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    return Math.ceil(root.scrollWidth - root.clientWidth);
  });
  expect(overflow).toBeLessThanOrEqual(2);
}

async function expectNoViewportClippedControls(page: Page): Promise<void> {
  const offenders = await page
    .locator(
      [
        "button",
        "a[href]",
        "input",
        "select",
        "textarea",
        "[role='button']",
      ].join(","),
    )
    .evaluateAll((nodes) => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      return nodes
        .filter((node) => {
          const element = node as HTMLElement;
          const style = window.getComputedStyle(element);
          if (
            style.display === "none" ||
            style.visibility === "hidden" ||
            Number(style.opacity) === 0 ||
            element.getAttribute("aria-hidden") === "true"
          ) {
            return false;
          }
          const rect = element.getBoundingClientRect();
          if (rect.width <= 0 || rect.height <= 0) return false;
          if (rect.bottom < 0 || rect.top > height) return false;
          return rect.left < -2 || rect.right > width + 2;
        })
        .map((node) => {
          const element = node as HTMLElement;
          const rect = element.getBoundingClientRect();
          return {
            testId: element.getAttribute("data-testid"),
            label:
              element.getAttribute("aria-label") ??
              element.getAttribute("title") ??
              element.textContent?.trim().slice(0, 80) ??
              element.tagName,
            rect: {
              left: Math.round(rect.left),
              right: Math.round(rect.right),
              top: Math.round(rect.top),
              bottom: Math.round(rect.bottom),
            },
          };
        })
        .slice(0, 8);
    });

  expect(offenders).toEqual([]);
}

async function typeWithoutLosingFocus(
  page: Page,
  input: Locator,
  value: string,
): Promise<void> {
  await input.click();
  await expect(input).toBeFocused();

  let expectedValue = "";
  for (const character of value) {
    expectedValue += character;
    await page.keyboard.type(character);
    await expect(input).toBeFocused();
    await expect(input).toHaveValue(expectedValue);
  }
}

async function expectCurrentQuery(
  page: Page,
  expected: Record<string, string | null>,
): Promise<void> {
  for (const [key, value] of Object.entries(expected)) {
    if (value === null) {
      await expect
        .poll(() =>
          page.evaluate((key) => new URL(window.location.href).searchParams.get(key), key),
        )
        .toBeNull();
    } else {
      await expect
        .poll(() =>
          page.evaluate((key) => new URL(window.location.href).searchParams.get(key), key),
        )
        .toBe(value);
    }
  }
}

test.describe("public interaction state matrix", () => {
  test.beforeEach(async ({ page }) => {
    await mockCatalogBackends(page);
    await page.addInitScript(() => {
      window.localStorage.setItem(
        "wallet:pubkey",
        "GCFLOW7RTH9KLMNOPQ2UVWX3YZ56789ABCDEFGHJKLMNPRSTUV4WX",
      );
    });
  });

  for (const viewport of RESPONSIVE_VIEWPORTS) {
    test(`keeps search fields focused and filtered at ${viewport.label}`, async ({
      page,
    }) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });

      for (const route of SEARCH_ROUTES) {
        await test.step(route.label, async () => {
          await page.goto(route.route);
          await expect(page.getByTestId(route.panelTestId)).toBeVisible({
            timeout: 30_000,
          });
          const input = page.getByTestId(route.inputTestId);
          await typeWithoutLosingFocus(page, input, route.value);
          await expectCurrentQuery(page, { q: route.value });
          await page.reload();
          await expect(page.getByTestId(route.inputTestId)).toHaveValue(route.value);
          await expect(page.getByTestId(route.panelTestId)).toContainText(
            route.expectedCopy,
          );
          await expectNoUnresolvedSurfaceCopy(page.getByTestId("product-canvas"));
          await expectNoPageHorizontalOverflow(page);
          await expectNoViewportClippedControls(page);
        });
      }
    });
  }

  test("keeps dashboard, discovery, asset and leaderboard controls stateful", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1050 });

    await page.goto("/dashboard");
    await page.getByTestId("dashboard-featured-tab-fresh").click();
    await expect(page.getByTestId("dashboard-featured-tab-fresh")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expectCurrentQuery(page, { feature: "fresh" });
    await page.reload();
    await expect(page.getByTestId("dashboard-featured-tab-fresh")).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await page.goto("/discover");
    await page.getByTestId("discover-feature-tab-profit").click();
    await expect(page.getByTestId("discover-feature-tab-profit")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expectCurrentQuery(page, { feature: "profit" });
    await expect(page.getByTestId("discover-figma-preview-grid")).toContainText(
      /profit|TVL|Arka/i,
    );
    await page.reload();
    await expect(page.getByTestId("discover-feature-tab-profit")).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await page.goto("/assets");
    await page.getByTestId("assets-spotlight-tab-balance-sheet").click();
    await expect(
      page.getByTestId("assets-spotlight-tab-balance-sheet"),
    ).toHaveAttribute("aria-pressed", "true");
    await expectCurrentQuery(page, { spotlight: "balanceSheet" });
    await expect(page.getByTestId("assets-list-panel")).toContainText(
      /balance sheet/i,
    );
    await page.reload();
    await expect(
      page.getByTestId("assets-spotlight-tab-balance-sheet"),
    ).toHaveAttribute("aria-pressed", "true");

    await page.goto("/vaults");
    await page.getByTestId("vaults-featured-tab-volume").click();
    await expect(page.getByTestId("vaults-featured-tab-volume")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expectCurrentQuery(page, { feature: "volume" });
    await expect(page.getByTestId("vaults-sort-metric")).toHaveValue("volume");
    await expect(page.getByTestId("vaults-leaderboard-table")).toContainText(/volume/i);
    await page.getByTestId("vaults-window-30d").click();
    await expect(page.getByTestId("vaults-window-30d")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expectCurrentQuery(page, { feature: "volume", window: "30d" });
    await page.getByTestId("vaults-sort-metric").selectOption("profit");
    await expect(page.getByTestId("vaults-sort-metric")).toHaveValue("profit");
    await expectCurrentQuery(page, {
      feature: "volume",
      window: "30d",
      sort: "profit",
      order: null,
    });
    await page.getByTestId("vaults-sort-metric").selectOption("volume");
    await expect(page.getByTestId("vaults-sort-metric")).toHaveValue("volume");
    await expectCurrentQuery(page, {
      feature: "volume",
      window: "30d",
      sort: "volume",
      order: null,
    });
    await page.reload();
    await expect(page.getByTestId("vaults-featured-tab-volume")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.getByTestId("vaults-window-30d")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.getByTestId("vaults-sort-metric")).toHaveValue("volume");

    await page.goto("/managers");
    await page.getByTestId("managers-spotlight-tab-curated").click();
    await expect(page.getByTestId("managers-spotlight-tab-curated")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expectCurrentQuery(page, { spotlight: "curated" });
    await page.getByTestId("managers-sort-metric").selectOption("arkas");
    await expect(page.getByTestId("managers-list-panel")).toContainText(/sorted by Arka count/i);
    await expectCurrentQuery(page, { spotlight: "curated", sort: "arkas" });
    await page.getByTestId("managers-sort-order").selectOption("asc");
    await expect(page.getByTestId("managers-sort-order")).toHaveValue("asc");
    await expectCurrentQuery(page, {
      spotlight: "curated",
      sort: "arkas",
      order: "asc",
    });
    await page.reload();
    await expect(page.getByTestId("managers-spotlight-tab-curated")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.getByTestId("managers-sort-metric")).toHaveValue("arkas");
    await expect(page.getByTestId("managers-sort-order")).toHaveValue("asc");
    await expect(page.getByTestId("managers-list-panel")).toContainText(/sorted by Arka count/i);

    await page.getByTestId("chrome-search-input").click();
    await typeWithoutLosingFocus(page, page.getByTestId("chrome-search-input"), "BLND");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp(`/assets/${FIXTURE_ASSET_ID}$`));
    await expect(page.getByTestId("asset-detail-hero")).toContainText(/BLND/i);

    await expectNoUnresolvedSurfaceCopy(page.getByTestId("product-canvas"));
    await expectNoPageHorizontalOverflow(page);
    await expectNoViewportClippedControls(page);
  });
});
