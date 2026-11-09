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

const VALID_VAULT_ID =
  "CA7ALPHAQFK2MZKJY4R5S8N2P1T6V9W3X7Y2Z5ABCD1EFGH2345678IJ";
const VALID_MANAGER_ID =
  "GCAALPHA7RTH9KLMNOPQ2UVWX3YZ56789ABCDEFGHJKLMNPRSTUV4WX";
const VALID_INDEXED_ASSET_ID =
  "CD25MNVTZDL4Y3XBCPCJXGXATV5WUHHOWMYFF4YBEGU5FCPGMYTVG5JY";
const VALID_CORE_FALLBACK_ASSET_ID =
  "CDCKFBZYF2AQCSM3JOF2ZM27O3Y6AJAI4OTCQKAFNZ3FHBYUTFOKICIY";

const RESPONSIVE_VIEWPORTS = [
  { label: "desktop", width: 1440, height: 1050 },
  { label: "tablet", width: 834, height: 1120 },
  { label: "mobile", width: 390, height: 900 },
] as const;

const OFFLINE_RETRY_ROUTES = [
  {
    label: "discover",
    route: "/discover",
    offlineTestId: "discover-catalog-offline",
    recoveredTestId: "discover-summary-grid",
    offlineCopy: /discovery data is not available/i,
    recoveredCopy: /arkas|managers|assets/i,
  },
  {
    label: "dashboard",
    route: "/dashboard",
    offlineTestId: "dashboard-catalog-offline",
    recoveredTestId: "dashboard-arkas-panel",
    offlineCopy: /dashboard data is not available/i,
    recoveredCopy: /arkas|TVL/i,
  },
  {
    label: "assets",
    route: "/assets",
    offlineTestId: "assets-catalog-offline",
    recoveredTestId: "assets-list-panel",
    offlineCopy: /asset explorer data is not available/i,
    recoveredCopy: /asset explorer|core stellar registry|TVL/i,
  },
  {
    label: "arkas leaderboard",
    route: "/vaults",
    offlineTestId: "vaults-catalog-offline",
    recoveredTestId: "vaults-leaderboard-panel",
    offlineCopy: /arka leaderboard data is not available/i,
    recoveredCopy: /arkas leaderboard|sorted by|price source|TVL/i,
  },
  {
    label: "managers leaderboard",
    route: "/managers",
    offlineTestId: "managers-catalog-offline",
    recoveredTestId: "managers-list-panel",
    offlineCopy: /manager explorer data is not available/i,
    recoveredCopy: /manager leaderboard|sorted by|TVL/i,
  },
] as const;

const DETAIL_RETRY_ROUTES = [
  {
    label: "vault detail",
    route: `/vaults/${VALID_VAULT_ID}`,
    errorTestId: "vault-detail-error",
    recoveredTestId: "vault-detail-hero",
    errorCopy: /arka profile unavailable/i,
    recoveredCopy: /TVL|profile|allowed/i,
  },
  {
    label: "manager detail",
    route: `/managers/${VALID_MANAGER_ID}`,
    errorTestId: "manager-detail-error",
    recoveredTestId: "manager-detail-hero",
    errorCopy: /manager detail unavailable/i,
    recoveredCopy: /TVL|current rank|latest update/i,
  },
] as const;

const ASSET_DETAIL_RETRY_ROUTES = [
  {
    label: "indexed asset detail",
    route: `/assets/${VALID_INDEXED_ASSET_ID}`,
    offlineTestId: "asset-detail-core-registry-fallback",
    recoveredTestId: "asset-detail-hero",
    offlineCopy: /data unavailable/i,
    recoveredCopy: /current rank|last sync|linked arkas/i,
  },
  {
    label: "core registry fallback asset detail",
    route: `/assets/${VALID_CORE_FALLBACK_ASSET_ID}`,
    offlineTestId: "asset-detail-core-registry-fallback",
    recoveredTestId: "asset-detail-core-registry-fallback",
    offlineCopy: /data unavailable/i,
    recoveredCopy: /no exposure|xtar/i,
  },
] as const;

type BackendMode = "offline" | "ready";

function buildLeaderboardSourcePayload() {
  return {
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
  };
}

function buildVaultLeaderboardResponse(url: URL) {
  const sortMetric = normalizeVaultSortMetric(url.searchParams.get("sortMetric"));
  const sortOrder = normalizeVaultSortOrder(sortMetric, url.searchParams.get("sortOrder"));
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
  return {
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
  };
}

function buildManagerLeaderboardResponse(url: URL) {
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
  const rankedItems = rankManagerLeaderboardEntries(
    pageData.items,
    sortMetric,
    sortOrder,
  );
  const pagedItems = rankedItems.slice(offset, offset + limit);
  return {
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
      items: pagedItems,
    },
  };
}

async function installRecoverableCatalogBackend(
  page: Page,
  getMode: () => BackendMode,
): Promise<void> {
  await page.route("**/api/assets/core-registry", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        generatedAt: "2026-04-25T18:00:00.000Z",
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
      body: JSON.stringify(buildLeaderboardSourcePayload()),
    });
  });

  await page.route("**/api/catalog/**", async (route) => {
    if (getMode() === "offline") {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          message: "NEXT_PUBLIC_CATALOG_API_BASE_URL is not configured",
        }),
      });
      return;
    }
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
    if (getMode() === "offline") {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          message: "NEXT_PUBLIC_CATALOG_API_BASE_URL is not configured",
        }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(buildVaultLeaderboardResponse(new URL(route.request().url()))),
    });
  });

  await page.route("**/api/leaderboard/managers**", async (route) => {
    if (getMode() === "offline") {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          message: "NEXT_PUBLIC_CATALOG_API_BASE_URL is not configured",
        }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(buildManagerLeaderboardResponse(new URL(route.request().url()))),
    });
  });
}

async function installGenericErrorCatalogBackend(page: Page): Promise<void> {
  await page.route("**/api/assets/core-registry", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        generatedAt: "2026-04-25T18:00:00.000Z",
        items: CORE_STELLAR_ASSET_REGISTRY.map((entry) =>
          buildCoreStellarAssetMetadata(entry),
        ),
      }),
    });
  });

  await page.route("**/api/catalog/**", async (route) => {
    await route.fulfill({
      status: 502,
      contentType: "application/json",
      body: JSON.stringify({
        message: "catalog upstream failed with retryable gateway error",
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
      const height = window.innerHeight;
      const scrollY = window.scrollY;
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
          if (rect.bottom < 0 || rect.top > height) {
            return false;
          }
          return (
            rect.left < -2 ||
            rect.right > width + 2 ||
            (scrollY <= 2 && rect.top < -2)
          );
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

async function assertSafeState(page: Page, stateTestId: string): Promise<void> {
  await expect(page.getByTestId("operator-route-gate")).toHaveCount(0);
  await expect(page.getByTestId(stateTestId)).toBeVisible({ timeout: 30_000 });
  await expectNoUnresolvedSurfaceCopy(page.getByTestId("product-canvas"));
  await expectNoPageHorizontalOverflow(page);
  await expectNoViewportClippedControls(page);
}

test.describe("public degraded/offline retry matrix", () => {
  for (const viewport of RESPONSIVE_VIEWPORTS) {
    test(`recovers catalog-backed product routes at ${viewport.label}`, async ({
      page,
    }) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await page.addInitScript(() => {
        window.localStorage.setItem(
          "wallet:pubkey",
          "GCFLOW7RTH9KLMNOPQ2UVWX3YZ56789ABCDEFGHJKLMNPRSTUV4WX",
        );
      });

      let backendMode: BackendMode = "offline";
      await installRecoverableCatalogBackend(page, () => backendMode);

      for (const route of OFFLINE_RETRY_ROUTES) {
        await test.step(route.label, async () => {
          backendMode = "offline";
          await page.goto(route.route);
          const offlineState = page.getByTestId(route.offlineTestId);
          await expect(offlineState).toContainText(route.offlineCopy);
          await expect(offlineState.getByRole("button", { name: /retry/i })).toBeVisible();
          await assertSafeState(page, route.offlineTestId);

          backendMode = "ready";
          await offlineState.getByRole("button", { name: /retry/i }).click();

          const recoveredState = page.getByTestId(route.recoveredTestId);
          await expect(recoveredState).toContainText(route.recoveredCopy, {
            timeout: 30_000,
          });
          await assertSafeState(page, route.recoveredTestId);
        });
      }

      for (const route of DETAIL_RETRY_ROUTES) {
        await test.step(route.label, async () => {
          backendMode = "offline";
          await page.goto(route.route);
          const errorState = page.getByTestId(route.errorTestId);
          await expect(errorState).toContainText(route.errorCopy);
          await expect(errorState.getByRole("button", { name: /retry/i })).toBeVisible();
          await assertSafeState(page, route.errorTestId);

          backendMode = "ready";
          await errorState.getByRole("button", { name: /retry/i }).click();

          const recoveredState = page.getByTestId(route.recoveredTestId);
          await expect(recoveredState).toContainText(route.recoveredCopy, {
            timeout: 30_000,
          });
          await assertSafeState(page, route.recoveredTestId);
        });
      }
    });
  }

  for (const route of ASSET_DETAIL_RETRY_ROUTES) {
    test(`recovers ${route.label} without confusing data outage with current exposure`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 834, height: 1120 });

      let backendMode: BackendMode = "offline";
      await installRecoverableCatalogBackend(page, () => backendMode);

      await page.goto(route.route);

      const offlineState = page.getByTestId(route.offlineTestId);
      await expect(offlineState).toContainText(route.offlineCopy);
      await assertSafeState(page, route.offlineTestId);

      backendMode = "ready";
      await page.reload();

      const recoveredState = page.getByTestId(route.recoveredTestId);
      await expect(recoveredState).toContainText(route.recoveredCopy, {
        timeout: 30_000,
      });
      await assertSafeState(page, route.recoveredTestId);

      if (route.label.includes("indexed")) {
        await expect(recoveredState).not.toContainText(/not indexed/i);
      }
    });
  }

  test("keeps repeated public retry failures safe before recovering", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 834, height: 1120 });

    let backendMode: BackendMode = "offline";
    await installRecoverableCatalogBackend(page, () => backendMode);

    await page.goto("/discover");

    const firstOfflineState = page.getByTestId("discover-catalog-offline");
    await expect(firstOfflineState).toContainText(
      /discovery data is not available/i,
      { timeout: 30_000 },
    );
    await expect(firstOfflineState).not.toContainText(
      /CATALOG_API_BASE_URL|NEXT_PUBLIC_CATALOG_API_BASE_URL/i,
    );
    await assertSafeState(page, "discover-catalog-offline");

    await firstOfflineState.getByRole("button", { name: /retry/i }).click();

    const secondOfflineState = page.getByTestId("discover-catalog-offline");
    await expect(secondOfflineState).toContainText(
      /discovery data is not available/i,
      { timeout: 30_000 },
    );
    await expect(secondOfflineState).not.toContainText(/undefined|NaN|stub/i);
    await assertSafeState(page, "discover-catalog-offline");

    backendMode = "ready";
    await secondOfflineState.getByRole("button", { name: /retry/i }).click();

    await expect(page.getByTestId("discover-summary-grid")).toContainText(
      /arkas|managers|assets/i,
      { timeout: 30_000 },
    );
    await assertSafeState(page, "discover-summary-grid");
  });

  test("keeps generic vault detail errors retryable and visually safe", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await installGenericErrorCatalogBackend(page);

    await page.goto(`/vaults/${VALID_VAULT_ID}`);

    const errorState = page.getByTestId("vault-detail-error");
    await expect(errorState).toContainText(/arka profile unavailable/i);
    await expect(errorState).toContainText(/gateway error/i);
    await expect(errorState.getByRole("button", { name: /retry/i })).toBeVisible();
    await assertSafeState(page, "vault-detail-error");
  });
});
