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
import {
  PUBLIC_SURFACE_BREAKPOINTS,
  PUBLIC_SURFACE_BROWSER_PROJECTS,
  PUBLIC_SURFACE_ROUTES,
  getPublicSurfaceMatrixSummary,
  validatePublicSurfaceMatrix,
  type PublicSurfaceRoute,
} from "../src/lib/qa/publicSurfaceMatrix";

const DIRECT_ARKA_ID =
  "CA7ALPHAQFK2MZKJY4R5S8N2P1T6V9W3X7Y2Z5ABCD1EFGH2345678IJ";

function buildVaultLeaderboardResponse(url: URL) {
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
  const page = fixtureArkasPage({
    search: url.searchParams.get("search") ?? undefined,
    curated: curatedOnly === "false" || curatedOnly === "0" ? undefined : true,
    limit: 24,
  });
  const metrics = buildCatalogDerivedMetrics(page.items);
  const rankedItems = rankVaultLeaderboardEntries(
    page.items,
    sortMetric,
    sortOrder,
    metrics,
  );
  const pagedItems = rankedItems.slice(offset, offset + limit);

  return {
    ok: true,
    source: "api_vault_leaderboard",
    generatedAt: "2026-05-19T12:00:00.000Z",
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
  };
}

function buildManagerLeaderboardResponse(url: URL) {
  const sortMetric = normalizeManagerSortMetric(url.searchParams.get("sortMetric"));
  const sortOrder = normalizeManagerSortOrder(
    sortMetric,
    url.searchParams.get("sortOrder"),
  );
  const parsedLimit = Number.parseInt(url.searchParams.get("limit") ?? "24", 10);
  const parsedOffset = Number.parseInt(url.searchParams.get("offset") ?? "0", 10);
  const limit = Number.isFinite(parsedLimit) ? parsedLimit : 24;
  const offset = Number.isFinite(parsedOffset) ? parsedOffset : 0;
  const page = fixtureManagersPage({
    search: url.searchParams.get("search") ?? undefined,
    limit: 24,
  });
  const rankedItems = rankManagerLeaderboardEntries(
    page.items,
    sortMetric,
    sortOrder,
  );

  return {
    ok: true,
    source: "api_manager_leaderboard",
    generatedAt: "2026-05-19T12:00:00.000Z",
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
  };
}

async function installPublicCatalogBackends(page: Page): Promise<void> {
  await page.route("**/api/assets/core-registry", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        generatedAt: "2026-05-19T12:00:00.000Z",
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
          validatedAt: "2026-05-19",
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
    const status =
      typeof body === "object" && body !== null && "error" in body ? 404 : 200;
    await route.fulfill({
      status: pathname.startsWith("/v1/") ? status : 404,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });

  await page.route("**/api/leaderboard/arkas**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(buildVaultLeaderboardResponse(new URL(route.request().url()))),
    });
  });

  await page.route("**/api/leaderboard/managers**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(buildManagerLeaderboardResponse(new URL(route.request().url()))),
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
    .locator(["button", "a[href]", "input", "select", "textarea", "[role='button']"].join(","))
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
            text: element.textContent?.trim().slice(0, 80) ?? element.tagName,
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

async function assertPublicSurfaceSafe(page: Page): Promise<void> {
  await expectNoUnresolvedSurfaceCopy(page.getByTestId("product-canvas"));
  await expectNoPageHorizontalOverflow(page);
  await expectNoViewportClippedControls(page);
}

async function typeWithoutLosingFocus(
  page: Page,
  input: Locator,
  value: string,
): Promise<void> {
  await input.click();
  await expect(input).toBeFocused();
  await input.fill("");
  await expect(input).toBeFocused();
  await expect(input).toHaveValue("");

  await input.fill(value);
  await expect(input).toBeFocused();
  await expect(input).toHaveValue(value);
  await page.waitForTimeout(150);
  await expect(input).toHaveValue(value);
}

function routeSearchValue(route: PublicSurfaceRoute): string {
  if (route.key === "arkas") return DIRECT_ARKA_ID;
  return route.searchValue ?? "alpha";
}

test.describe("T13 public multi-browser surface matrix", () => {
  test.beforeEach(async ({ page }) => {
    await installPublicCatalogBackends(page);
    await page.addInitScript((directArkaId) => {
      window.localStorage.setItem(
        "wallet:pubkey",
        "GCFLOW7RTH9KLMNOPQ2UVWX3YZ56789ABCDEFGHJKLMNPRSTUV4WX",
      );
      window.localStorage.setItem("recent_arkas", JSON.stringify([directArkaId]));
    }, DIRECT_ARKA_ID);
  });

  test("keeps the canonical public matrix aligned with configured browser projects", async ({
    page,
  }, testInfo) => {
    expect(page).toBeTruthy();
    expect(PUBLIC_SURFACE_BROWSER_PROJECTS).toContain(
      testInfo.project.name as (typeof PUBLIC_SURFACE_BROWSER_PROJECTS)[number],
    );
    expect(validatePublicSurfaceMatrix()).toEqual([]);
    expect(getPublicSurfaceMatrixSummary()).toMatchObject({
      routeCount: 10,
      stateCount: 5,
      browserCount: 3,
      breakpointCount: 3,
      browserBreakpointRouteScenarios: 90,
    });
  });

  for (const breakpoint of PUBLIC_SURFACE_BREAKPOINTS) {
    test(`renders loaded public routes without overflow at ${breakpoint.key}`, async ({
      page,
    }) => {
      test.setTimeout(120_000);
      await page.setViewportSize({
        width: breakpoint.width,
        height: breakpoint.height,
      });

      for (const route of PUBLIC_SURFACE_ROUTES) {
        await test.step(route.key, async () => {
          await page.goto(route.path, { waitUntil: "domcontentloaded", timeout: 45_000 });
          const anchor = page.getByTestId(route.loadedAnchorTestId);
          await expect(anchor).toBeVisible({ timeout: 30_000 });
          await assertPublicSurfaceSafe(page);
        });
      }
    });
  }

  test("keeps search and filter lanes focused, stateful and visually contained", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1440, height: 1050 });

    for (const route of PUBLIC_SURFACE_ROUTES.filter((item) =>
      item.requiredStates.includes("search_filter"),
    )) {
      await test.step(route.key, async () => {
        await page.goto(route.searchPath ?? route.path, {
          waitUntil: "domcontentloaded",
          timeout: 45_000,
        });
        await expect(page.getByTestId(route.searchAnchorTestId ?? route.loadedAnchorTestId)).toBeVisible({
          timeout: 30_000,
        });

        if (route.searchInputTestId) {
          const input = page.getByTestId(route.searchInputTestId);
          await typeWithoutLosingFocus(page, input, routeSearchValue(route));
        } else {
          expect(route.filterControlTestIds?.length ?? 0).toBeGreaterThan(0);
        }

        for (const controlId of route.filterControlTestIds ?? []) {
          const control = page.getByTestId(controlId);
          if (await control.count()) {
            await expect(control.first()).toBeVisible();
          }
        }

        await assertPublicSurfaceSafe(page);
      });
    }
  });
});
