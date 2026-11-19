import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  fixtureArkasPage,
  fixtureManagersPage,
  resolveCatalogFixture,
} from "../src/lib/catalog/testFixtures";
import { LAYOUT_INTEGRITY_BREAKPOINTS } from "../src/lib/qa/layoutIntegrityMatrix";
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

const VALID_VAULT_ID =
  "CA7ALPHAQFK2MZKJY4R5S8N2P1T6V9W3X7Y2Z5ABCD1EFGH2345678IJ";

const RESPONSIVE_VIEWPORTS = LAYOUT_INTEGRITY_BREAKPOINTS.map((breakpoint) => ({
  label: breakpoint.key,
  width: breakpoint.width,
  height: breakpoint.height,
}));

const SURFACE_ROUTES = [
  {
    label: "dashboard",
    route: "/dashboard",
    anchorTestId: "dashboard-arkas-panel",
    stableCopy: /dashboard|TVL|arkas/i,
  },
  {
    label: "assets",
    route: "/assets",
    anchorTestId: "assets-list-panel",
    stableCopy: /asset explorer|core stellar registry|TVL/i,
  },
  {
    label: "managers",
    route: "/managers",
    anchorTestId: "managers-list-panel",
    stableCopy: /manager leaderboard|sorted by|TVL/i,
  },
  {
    label: "arkas leaderboard",
    route: "/arkas",
    anchorTestId: "vaults-leaderboard-panel",
    stableCopy: /arkas|ranked by|TVL/i,
  },
  {
    label: "vault ops detail",
    route: "/arkas/TEST_BLEND_VAULT",
    anchorTestId: "arka-stage-panel",
    stableCopy: /overview|deposit|swap|blend/i,
  },
  {
    label: "vault detail",
    route: `/vaults/${VALID_VAULT_ID}`,
    anchorTestId: "vault-detail-hero",
    stableCopy: /CA7ALPHA|TVL|profile/i,
  },
  {
    label: "integrations",
    route: "/integrations",
    anchorTestId: "integrations-product-catalog",
    stableCopy: /lending|swaps|blend/i,
  },
  {
    label: "create assets",
    route: "/factory/create?step=assets&denomination=BLND&asset=XTAR&intent=blend",
    anchorTestId: "create-assets-management-panel",
    stableCopy: /after creation|allowed assets|blend/i,
  },
  {
    label: "create review",
    route: "/factory/create?step=review&denomination=BLND&asset=XTAR&intent=blend",
    anchorTestId: "create-review-panel",
    stableCopy: /create arka|create transaction|review/i,
  },
  {
    label: "governance",
    route: "/governance",
    anchorTestId: "governance-overview-panel",
    stableCopy: /proposal|voting/i,
  },
  {
    label: "coverage",
    route: "/coverage",
    anchorTestId: "coverage-overview-panel",
    stableCopy: /coverage|reserve/i,
  },
] as const;

async function mockCatalogApi(page: Page): Promise<void> {
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
          primaryProvider: "reflector",
          secondaryProvider: "twap_guard",
          provider: "twap_guard",
          selectedSourceUnderDivergence: 2,
          source: "deployments",
        },
        deployment: {
          targetNetwork: "testnet",
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
    await route.fulfill({
      status: pathname.startsWith("/v1/") ? 200 : 404,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });

  await page.route("**/api/leaderboard/arkas**", async (route) => {
    const url = new URL(route.request().url());
    const sortMetric = normalizeVaultSortMetric(url.searchParams.get("sortMetric"));
    const sortOrder = normalizeVaultSortOrder(sortMetric, url.searchParams.get("sortOrder"));
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
    const sortMetric = normalizeManagerSortMetric(url.searchParams.get("sortMetric"));
    const sortOrder = normalizeManagerSortOrder(sortMetric, url.searchParams.get("sortOrder"));
    const parsedLimit = Number.parseInt(url.searchParams.get("limit") ?? "24", 10);
    const parsedOffset = Number.parseInt(url.searchParams.get("offset") ?? "0", 10);
    const limit = Number.isFinite(parsedLimit) ? parsedLimit : 24;
    const offset = Number.isFinite(parsedOffset) ? parsedOffset : 0;
    const pageData = fixtureManagersPage({
      search: url.searchParams.get("search") ?? undefined,
      limit: 24,
    });
    const rankedItems = rankManagerLeaderboardEntries(pageData.items, sortMetric, sortOrder);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        source: "api_manager_leaderboard",
        generatedAt: "2026-04-16T12:00:00.000Z",
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
  expect(text).not.toMatch(/\b(undefined|null|NaN|TODO|lorem|fake|stub|skeleton)\b/i);
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
          if (rect.width <= 0 || rect.height <= 0) {
            return false;
          }
          return rect.left < -2 || rect.right > width + 2 || rect.top < -2;
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

async function expectNoInternalControlOverflow(page: Page): Promise<void> {
  const offenders = await page
    .locator(
      [
        "a.surface-button",
        "button.surface-button",
        "button.surface-tab",
        ".surface-inline-link",
        ".surface-table-link",
        ".surface-chip",
        ".status-pill",
        ".chrome-advanced-inline-action",
      ].join(","),
    )
    .evaluateAll((nodes) =>
      nodes
        .filter((node) => {
          const element = node as HTMLElement;
          const style = window.getComputedStyle(element);
          if (
            style.display === "none" ||
            style.visibility === "hidden" ||
            Number(style.opacity) === 0
          ) {
            return false;
          }
          return element.scrollWidth > element.clientWidth + 2;
        })
        .map((node) => {
          const element = node as HTMLElement;
          return {
            testId: element.getAttribute("data-testid"),
            text: element.textContent?.trim().slice(0, 80) ?? element.tagName,
            scrollWidth: element.scrollWidth,
            clientWidth: element.clientWidth,
          };
        })
        .slice(0, 8),
    );

  expect(offenders).toEqual([]);
}

async function assertRouteSurface(page: Page, route: (typeof SURFACE_ROUTES)[number]) {
  await page.goto(route.route, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await expect(page.getByTestId("operator-route-gate")).toHaveCount(0);
  const anchor = page.getByTestId(route.anchorTestId);
  await expect(anchor).toBeVisible({ timeout: 30_000 });
  await expect(anchor).toContainText(route.stableCopy);
  if (route.label === "assets") {
    await expect(page.getByTestId("assets-workspace-grid")).toHaveClass(
      /assets-workspace-grid/,
    );
    await expect(page.getByTestId("assets-list-panel")).toHaveClass(
      /assets-list-workspace-panel/,
    );
    await expect(page.getByTestId("assets-list")).toBeVisible();
    await expect(page.getByTestId("asset-card").first()).toContainText(
      /USDC|BLND|AQUA|XTAR|XLM/i,
    );
  }
  if (route.label === "managers") {
    await expect(page.getByTestId("managers-fidelity-shell")).toHaveClass(
      /managers-fidelity-shell/,
    );
    await expect(page.getByTestId("managers-workspace-grid")).toHaveClass(
      /managers-workspace-grid/,
    );
    await expect(page.getByTestId("managers-list-panel")).toHaveClass(
      /managers-list-workspace-panel/,
    );
    await expect(page.getByTestId("manager-card").first()).toContainText(
      /Arkas|curated|Share/i,
    );
  }
  await expectNoUnresolvedSurfaceCopy(page.getByTestId("product-canvas"));
  await expectNoPageHorizontalOverflow(page);
  await expectNoViewportClippedControls(page);
  await expectNoInternalControlOverflow(page);
}

test.describe("public and operator responsive surface matrix", () => {
  test.beforeEach(async ({ page }) => {
    await mockCatalogApi(page);
    await page.addInitScript(() => {
      window.localStorage.setItem(
        "wallet:pubkey",
        "GCFLOW7RTH9KLMNOPQ2UVWX3YZ56789ABCDEFGHJKLMNPRSTUV4WX",
      );
    });
  });

  for (const viewport of RESPONSIVE_VIEWPORTS) {
    test(`keeps critical surfaces readable at ${viewport.label}`, async ({ page }) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });

      for (const route of SURFACE_ROUTES) {
        await test.step(route.label, async () => {
          await assertRouteSurface(page, route);
        });
      }
    });
  }
});
