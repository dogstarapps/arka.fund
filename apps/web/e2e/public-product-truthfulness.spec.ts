import { expect, test, type Page } from "@playwright/test";
import {
  fixtureArkasPage,
  fixtureManagersPage,
  resolveCatalogFixture,
} from "../src/lib/catalog/testFixtures";
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

const FORBIDDEN_PRODUCT_COPY =
  /\b(undefined|NaN|TODO|FIXME|lorem|fake|stub|not implemented)\b|Routing asset [AB]|Product surface|denomination sleeve|\bsleeve\b|Selected lane|factory payload|indexed registry|token units|command deck|raw contracts|operator diagnostics|Open operator view|indexed snapshots|indexed snapshot|real indexed|catalog NAV|indexed NAV|NAV pending|History pendingHistory|History pending|\b1B\b/i;
const FIXTURE_ARKA_ID =
  "CA7ALPHAQFK2MZKJY4R5S8N2P1T6V9W3X7Y2Z5ABCD1EFGH2345678IJ";
const FIXTURE_MANAGER_ID =
  "GCAALPHA7RTH9KLMNOPQ2UVWX3YZ56789ABCDEFGHJKLMNPRSTUV4WX";
const FIXTURE_ASSET_ID =
  "CD25MNVTZDL4Y3XBCPCJXGXATV5WUHHOWMYFF4YBEGU5FCPGMYTVG5JY";

async function mockCatalogBackends(page: Page) {
  await page.route("**/api/catalog/**", async (route) => {
    const url = new URL(route.request().url());
    const pathname = url.pathname.replace("/api/catalog", "");
    const body = resolveCatalogFixture(pathname, url.searchParams);
    await route.fulfill({
      status: pathname.startsWith("/v1/") ? 200 : 404,
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
    const limit = parseBoundedInteger(url.searchParams.get("limit"), 24);
    const offset = parseBoundedInteger(url.searchParams.get("offset"), 0);
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
        generatedAt: "2026-04-30T08:00:00.000Z",
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
    const limit = parseBoundedInteger(url.searchParams.get("limit"), 24);
    const offset = parseBoundedInteger(url.searchParams.get("offset"), 0);
    const pageData = fixtureManagersPage({
      search: url.searchParams.get("search") ?? undefined,
      limit: 24,
    });
    const rankedItems = rankManagerLeaderboardEntries(
      pageData.items,
      sortMetric,
      sortOrder,
    );
    const pagedItems = rankedItems.slice(offset, offset + limit);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        source: "api_manager_leaderboard",
        generatedAt: "2026-04-30T08:00:00.000Z",
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
          items: pagedItems,
        },
      }),
    });
  });

  await page.route("**/api/leaderboard/source**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        source: "runtime_leaderboard_source",
        generatedAt: "2026-04-30T08:00:00.000Z",
        oracle: {
          mode: "unverified",
          validatedAt: null,
          network: "testnet",
          rpcUrl: "https://soroban-testnet.stellar.org",
          oracleGuard: null,
          primaryOracle: null,
          secondaryOracle: null,
          validationAsset: null,
          selectedSourceUnderDivergence: null,
          source: "fallback",
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
          deploymentsPath: null,
          pathSource: "network_default",
          fileFound: false,
          networkMismatch: false,
          readError: null,
        },
      }),
    });
  });
}

function parseBoundedInteger(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed;
}

async function expectNoPageHorizontalOverflow(page: Page) {
  const hasNoOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth + 1,
  );
  if (hasNoOverflow) return;

  const diagnostics = await page.evaluate(() => {
    const viewportWidth = window.innerWidth;
    const offenders = Array.from(document.querySelectorAll<HTMLElement>("*"))
      .map((element) => {
        const box = element.getBoundingClientRect();
        return {
          tag: element.tagName.toLowerCase(),
          testId: element.getAttribute("data-testid"),
          className:
            typeof element.className === "string" ? element.className : "",
          text: element.textContent?.trim().replace(/\s+/g, " ").slice(0, 90),
          left: Math.round(box.left),
          right: Math.round(box.right),
          width: Math.round(box.width),
        };
      })
      .filter((entry) => entry.width > 0 && entry.right > viewportWidth + 1)
      .sort((left, right) => right.right - left.right)
      .slice(0, 8);
    return {
      url: window.location.href,
      viewportWidth,
      scrollWidth: document.documentElement.scrollWidth,
      offenders,
    };
  });

  throw new Error(
    `Public route has horizontal overflow: ${JSON.stringify(diagnostics, null, 2)}`,
  );
}

interface ClippedControlDiagnostic {
  tag: string;
  label: string;
  testId: string | null;
  href: string | null;
  left: number;
  right: number;
  width: number;
  viewportWidth: number;
}

async function findViewportClippedControls(
  page: Page,
): Promise<ClippedControlDiagnostic[]> {
  return page.evaluate(() => {
    const controls = Array.from(
      document.querySelectorAll<HTMLElement>(
        'a, button, input, select, textarea, [role="button"]',
      ),
    );
    return controls.filter((element) => {
      const style = window.getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden") {
        return false;
      }
      const box = element.getBoundingClientRect();
      if (box.width <= 0 || box.height <= 0) return false;
      return box.left < -1 || box.right > window.innerWidth + 1;
    }).map((element) => {
      const box = element.getBoundingClientRect();
      return {
        tag: element.tagName.toLowerCase(),
        label:
          element.getAttribute("aria-label") ??
          element.textContent?.replace(/\s+/g, " ").trim().slice(0, 120) ??
          "",
        testId: element.getAttribute("data-testid"),
        href: element.getAttribute("href"),
        left: Math.round(box.left),
        right: Math.round(box.right),
        width: Math.round(box.width),
        viewportWidth: window.innerWidth,
      };
    });
  });
}

async function expectPublicRouteTruthful(page: Page) {
  await expectNoPageHorizontalOverflow(page);
  await expect(page.getByTestId("operator-route-gate")).toHaveCount(0);
  const canvasText = await page.getByTestId("product-canvas").innerText();
  expect(canvasText).not.toMatch(FORBIDDEN_PRODUCT_COPY);
}

test.describe("public product route truthfulness matrix", () => {
  test.beforeEach(async ({ page }) => {
    await mockCatalogBackends(page);
  });

  test("public dashboard, discovery and leaderboard routes stay populated and interactive", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: /^dashboard$/i })).toBeVisible();
    await expectPublicRouteTruthful(page);
    await expect(page.getByTestId("chrome-nav-dashboard")).toHaveClass(
      /chrome-rail-link-active/,
    );
    await expect(page.getByTestId("chrome-nav-discover")).not.toHaveClass(
      /chrome-rail-link-active/,
    );
    await expect(page.getByTestId("dashboard-arkas-panel")).toBeVisible();
    await expect(page.getByTestId("dashboard-figma-metric-deck")).toContainText(
      /TVL|Arkas/i,
    );
    await expect(page.getByTestId("dashboard-arkas-table")).toBeVisible();
    await expect(page.getByTestId("dashboard-launch-panel")).toHaveCount(0);
    await expect(page.getByTestId("chrome-create-primary")).toHaveAttribute(
      "href",
      /\/factory\/create\?from=%2Fdashboard/,
    );
    await page.getByTestId("dashboard-featured-tab-curated").click();
    await expect(page.getByTestId("dashboard-featured-tab-curated")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.getByTestId("dashboard-view-all-arkas")).toHaveAttribute(
      "href",
      "/arkas",
    );

    await page.goto("/discover");
    await expect(page.getByRole("heading", { name: /^discover$/i })).toBeVisible();
    await expectPublicRouteTruthful(page);
    await expect(page.getByTestId("chrome-nav-discover")).toHaveClass(
      /chrome-rail-link-active/,
    );
    await expect(page.getByTestId("chrome-nav-dashboard")).not.toHaveClass(
      /chrome-rail-link-active/,
    );
    await expect(page.getByTestId("discover-public-metric-board")).toBeVisible();
    await expect(page.getByTestId("discover-public-collection-board")).toBeVisible();
    await page.getByTestId("discover-feature-tab-profit").click();
    await expect(page.getByTestId("discover-feature-tab-profit")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.getByTestId("discover-feature-tab-profit")).toHaveAttribute(
      "aria-controls",
      "discover-featured-arkas",
    );
    await page.getByTestId("discover-search-input").fill("gamma");
    await expect(page.getByTestId("discover-search-input")).toBeFocused();
    await expect(page.getByTestId("discover-figma-preview-grid")).toContainText(
      /CA7GAMMA|GCCGAMM/i,
    );

    await page.goto("/arkas");
    await expect(
      page.getByRole("heading", { name: /^arkas leaderboard$/i }),
    ).toBeVisible();
    await expectPublicRouteTruthful(page);
    await expect(page.getByTestId("vaults-public-metric-deck")).toContainText(
      "Estimated profit",
    );
    await expect(page.getByTestId("vault-public-metric-volume")).toContainText(
      "Trading volume",
    );
    await page.getByTestId("vaults-featured-tab-volume").click();
    await expect(page.getByTestId("vaults-featured-tab-volume")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.getByTestId("vault-leaderboard-card").first()).toBeVisible();
    await expect(page.getByTestId("vault-open-profile-link").first()).toHaveAttribute(
      "href",
      /\/vaults\//,
    );
    await expect(page.getByTestId("vault-open-ops-link").first()).toHaveAttribute(
      "href",
      /\/arkas\//,
    );
    await expect(page.getByTestId("vaults-leaderboard-table")).toContainText(
      /TVL|Manager|Open Arka/i,
    );
  });

  test("public manager and asset explorers use real catalog rows without unavailable rails", async ({
    page,
  }) => {
    await page.goto("/managers");
    await expect(
      page.getByRole("heading", { name: /^managers leaderboard$/i }),
    ).toBeVisible();
    await expectPublicRouteTruthful(page);
    await page.getByTestId("managers-search-input").fill("alpha");
    await expect(page.getByTestId("managers-list")).toContainText("GCAALPHA");

    await page.goto("/assets");
    await expect(page.getByRole("heading", { name: /^assets$/i })).toBeVisible();
    await expectPublicRouteTruthful(page);
    await expect(page.getByTestId("assets-hero-aside")).toContainText(
      "TVL",
    );
    await expect(page.getByTestId("assets-hero-aside")).not.toContainText(
      /\b\d+(?:\.\d)?B\b|Managed footprint/i,
    );
    await expect(page.getByTestId("assets-list-panel")).toBeVisible();
    await expect(page.getByTestId("assets-list")).toBeVisible();
    await expect(page.getByTestId("asset-card").first()).toContainText(
      /USDC|XLM|BLND|AQUA|XTAR/i,
    );
    await page.getByTestId("assets-search-input").fill("usdc");
    await expect(page.getByTestId("assets-search-input")).toBeFocused();
    await expect(page.getByTestId("assets-list")).toContainText("USDC");
    await expect(page.getByTestId("assets-list")).toContainText(
      "Open asset detail",
    );
  });

  test("public route matrix is deep-linkable, responsive and free of clipped controls", async ({
    page,
  }) => {
    const routes = [
      {
        route: "/dashboard?feature=fresh",
        marker: "dashboard-arkas-panel",
      },
      {
        route: "/discover?q=gamma&curated=0&feature=search&section=assets",
        marker: "discover-public-collection-board",
      },
      {
        route: "/arkas?q=beta&curated=0&sort=profit&feature=volume&window=latest",
        marker: "vaults-leaderboard-panel",
      },
      {
        route: "/assets?q=BLND&spotlight=balanceSheet",
        marker: "assets-list-panel",
      },
      {
        route: "/managers?q=beta&spotlight=curated&sort=arkas&order=asc",
        marker: "managers-list-panel",
      },
      {
        route: `/vaults/${FIXTURE_ARKA_ID}`,
        marker: "vault-detail-hero",
      },
      {
        route: `/managers/${FIXTURE_MANAGER_ID}`,
        marker: "manager-detail-hero",
      },
      {
        route: `/assets/${FIXTURE_ASSET_ID}`,
        marker: "asset-detail-hero",
      },
    ] as const;

    for (const viewport of [
      { width: 390, height: 844 },
      { width: 768, height: 1024 },
      { width: 1366, height: 900 },
    ]) {
      await page.setViewportSize(viewport);
      for (const current of routes) {
        await page.goto(current.route);
        await expect(page.getByTestId(current.marker).first()).toBeVisible();
        await expectPublicRouteTruthful(page);
        const clippedControls = await findViewportClippedControls(page);
        expect(
          clippedControls,
          JSON.stringify({ route: current.route, viewport, clippedControls }, null, 2),
        ).toEqual([]);
      }
    }
  });

  test("public detail routes render current values, portfolio and linked entity data", async ({
    page,
  }) => {
    await page.goto(`/vaults/${FIXTURE_ARKA_ID}`);
    await expect(page.getByTestId("vault-detail-hero")).toBeVisible();
    await expectPublicRouteTruthful(page);
    await expect(page.getByTestId("vault-detail-public-metric-deck")).toContainText(
      "TVL",
    );
    await expect(page.getByTestId("vault-detail-fees")).toContainText(
      "Management 2.00% · Performance 12.00%",
    );
    await expect(page.getByTestId("vault-profile-table")).toBeVisible();
    await page.getByRole("button", { name: "Portfolio", exact: true }).click();
    await expect(page.getByTestId("vault-portfolio-tab")).toBeVisible();
    await expect(page.getByTestId("vault-assets-table")).toContainText(
      /Asset|Amount|Value/i,
    );
    await page.getByRole("button", { name: "Activity", exact: true }).click();
    await expect(page.getByTestId("vault-activity-tab")).toBeVisible();
    await expect(page.getByTestId("vault-activity-table")).toContainText("deposit");

    await page.goto(`/managers/${FIXTURE_MANAGER_ID}`);
    await expect(page.getByTestId("manager-detail-hero")).toBeVisible();
    await expectPublicRouteTruthful(page);
    await expect(page.getByTestId("manager-detail-history-panel")).toBeVisible();
    await expect(page.getByTestId("manager-detail-coverage-panel")).toHaveCount(0);
    await expect(page.getByTestId("manager-detail-arkas-table")).toContainText(
      "CA7ALPHA",
    );

    await page.goto(`/assets/${FIXTURE_ASSET_ID}`);
    await expect(page.getByTestId("asset-detail-hero")).toBeVisible();
    await expectPublicRouteTruthful(page);
    await expect(page.getByTestId("asset-detail-history-panel")).toBeVisible();
    await expect(page.getByTestId("asset-detail-risk-panel")).toContainText(
      /Liquid share|Debt share/i,
    );
    await expect(page.getByTestId("asset-detail-arkas-table")).toContainText(
      "CA7ALPHA",
    );
  });
});
