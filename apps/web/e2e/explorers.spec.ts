import { expect, test, type Page } from "@playwright/test";
import {
  fixtureManagersPage,
  resolveCatalogFixture,
} from "../src/lib/catalog/testFixtures";
import {
  normalizeManagerSortMetric,
  normalizeManagerSortOrder,
  rankManagerLeaderboardEntries,
} from "../src/lib/catalog/leaderboardManagers";

const DETAIL_ASSET_ID =
  "CD25MNVTZDL4Y3XBCPCJXGXATV5WUHHOWMYFF4YBEGU5FCPGMYTVG5JY";
const DETAIL_MANAGER_ID =
  "GCBBETA77RTH9KLMNOPQ2UVWX3YZ56789ABCDEFGHJKLMNPRSTUV4Y";
const DETAIL_BREAKPOINTS = [
  { label: "desktop", width: 1366, height: 920 },
  { label: "tablet", width: 820, height: 1060 },
  { label: "mobile", width: 390, height: 844 },
] as const;

async function mockCatalogApi(page: Page) {
  await page.route("**/api/assets/core-registry", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        generatedAt: "2026-05-13T10:00:00.000Z",
        items: [],
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
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });

  await page.route("**/api/leaderboard/managers**", async (route) => {
    const url = new URL(route.request().url());
    const sortMetric = normalizeManagerSortMetric(url.searchParams.get("sortMetric"));
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
    const pagedItems = rankedItems.slice(offset, offset + limit);
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
          items: pagedItems,
        },
      }),
    });
  });
}

async function expectDetailCanvasContained(page: Page, testId: string, label: string) {
  const canvasOverflow = await page.getByTestId("product-canvas").evaluate((element) => ({
    scrollWidth: element.scrollWidth,
    clientWidth: element.clientWidth,
  }));
  expect(
    canvasOverflow.scrollWidth - canvasOverflow.clientWidth,
    `${label} product canvas must not create horizontal overflow`,
  ).toBeLessThanOrEqual(2);

  const offenders = await page
    .getByTestId(testId)
    .locator(
      [
        ".workflow-signal-label",
        ".explorer-signal-label",
        ".surface-table-cell-strong",
        ".surface-button",
        ".surface-table-link",
        ".status-pill",
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
            className: element.className.toString(),
            text: element.textContent?.trim().slice(0, 80),
            scrollWidth: element.scrollWidth,
            clientWidth: element.clientWidth,
          };
        }),
    );

  expect(offenders, `${label} detail labels/controls clipped`).toEqual([]);
}

async function expectDetailLaneCutover(page: Page, testId: string, label: string) {
  const stageReport = await page.getByTestId(testId).evaluate((node) => {
    const element = node as HTMLElement;
    const style = window.getComputedStyle(element);
    return {
      className: element.className,
      gridTemplateColumns: style.gridTemplateColumns,
      columnCount: style.gridTemplateColumns
        .split(" ")
        .filter((column) => column.trim().length > 0).length,
    };
  });

  expect(
    stageReport.className,
    `${label} stage grid must use the detail lane cutover marker`,
  ).toContain("explorer-detail-stage-cutover");
  expect(
    stageReport.className,
    `${label} stage grid must use the public detail cutover marker`,
  ).toContain("public-detail-stage-grid-cutover");
  expect(
    stageReport.columnCount,
    `${label} stage grid must render as one contained detail lane`,
  ).toBe(1);
}

test("manager explorer filters and opens manager detail", async ({ page }) => {
  await mockCatalogApi(page);

  await page.goto("/managers");

  await expect(
    page.getByRole("heading", { name: /managers leaderboard/i }),
  ).toBeVisible();
  await expect(page.getByTestId("managers-list")).toBeVisible();
  await expect(page.getByTestId("managers-list-panel")).toHaveClass(
    /managers-list-workspace-panel/,
  );
  await expect(page.getByTestId("managers-list")).toContainText(
    "Open manager detail",
  );
  await expect(page.getByTestId("manager-card")).toHaveCount(3);
  await expect(page.getByTestId("managers-spotlight-tabs")).toContainText(
    "Lead TVL",
  );
  await expect(page.getByTestId("manager-card").first()).toContainText("USD TVL");
  await expect(page.getByTestId("managers-list")).not.toContainText("of listed TVL");
  await page.getByTestId("managers-search-input").fill("beta");
  await page.getByTestId("managers-spotlight-tab-search").click();
  await expect(page.getByTestId("manager-card").first()).toContainText("GCBBETA");
  await expect(page.getByTestId("manager-card")).toHaveCount(1);
  await expect(page.getByTestId("managers-list-panel")).toContainText(
    "GCBBETA",
  );

  await page.getByRole("link", { name: /open manager detail/i }).first().click();
  await expect(page.getByTestId("manager-detail-history-panel")).toContainText(
    "TVL history",
  );
  await expect(page.getByTestId("manager-detail-fidelity-shell")).toHaveClass(
    /public-detail-shell-cutover/,
  );
  await expect(page.getByTestId("manager-detail-history-panel")).toHaveClass(
    /public-detail-panel-cutover/,
  );
  await expect(page.getByTestId("manager-detail-coverage-panel")).toHaveCount(0);
  await expect(page.getByTestId("manager-detail-arkas-panel")).toContainText(
    "Managed Arkas",
  );
  await expect(page.getByTestId("manager-detail-arkas-table")).toHaveClass(
    /public-detail-related-grid-cutover/,
  );
});

test("asset explorer opens detail with linked Arkas", async ({ page }) => {
  await mockCatalogApi(page);

  await page.goto("/assets");

  await expect(page.getByRole("heading", { name: /^assets$/i })).toBeVisible();
  await expect(page.getByTestId("assets-list")).toBeVisible();
  await expect(page.getByTestId("assets-spotlight-tabs")).toContainText(
    "Core exposure",
  );
  await expect(page.getByTestId("asset-card").first()).toContainText("Value share");
  await page.getByTestId("assets-spotlight-tab-balance-sheet").click();
  await expect(page.getByTestId("asset-card").first()).toContainText("BLND");
  await page.getByTestId("assets-search-input").fill("BLND");
  await expect(page.getByTestId("assets-list-panel")).toContainText(
    "BLND",
  );

  await page.getByRole("link", { name: /open asset detail/i }).first().click();
  await expect(page.getByTestId("asset-detail-history-panel")).toContainText(
    "Asset amount over time",
  );
  await expect(page.getByTestId("asset-detail-fidelity-shell")).toHaveClass(
    /public-detail-shell-cutover/,
  );
  await expect(page.getByTestId("asset-detail-history-panel")).toHaveClass(
    /public-detail-panel-cutover/,
  );
  await expect(page.getByTestId("asset-detail-risk-panel")).toContainText(
    "Liquid share",
  );
  await expect(page.getByTestId("asset-detail-risk-panel")).toHaveClass(
    /public-detail-panel-cutover/,
  );
  await expect(page.getByTestId("asset-detail-arkas-panel")).toContainText(
    "Linked Arkas",
  );
  await expect(page.getByTestId("asset-detail-arkas-table")).toHaveClass(
    /public-detail-related-grid-cutover/,
  );
});

test("core registry asset detail stays truthful before current exposure exists", async ({ page }) => {
  await mockCatalogApi(page);

  await page.goto("/assets/CDCKFBZYF2AQCSM3JOF2ZM27O3Y6AJAI4OTCQKAFNZ3FHBYUTFOKICIY");

  await expect(page.getByTestId("asset-detail-core-registry-fallback")).toBeVisible();
  await expect(page.getByTestId("asset-detail-core-registry-fallback")).toHaveClass(
    /public-detail-shell-cutover/,
  );
  await expect(page.getByRole("heading", { name: /^XTAR$/i })).toBeVisible();
  await expect(page.getByTestId("asset-detail-core-hero")).toContainText("No exposure");
  await expect(page.getByTestId("asset-detail-core-stage-grid")).toHaveClass(
    /public-detail-stage-grid-cutover/,
  );
  await expect(page.getByTestId("asset-detail-core-metadata-table")).toContainText("XTAR");
  await expect(page.getByTestId("asset-detail-core-metadata-table")).toHaveClass(
    /public-detail-table-cutover/,
  );
  await expect(page.getByTestId("asset-detail-core-metadata-table")).toContainText(
    "GAORYJ3KBDGI",
  );
  await expect(page.getByTestId("asset-detail-core-metadata-table")).toContainText(
    "53257IG4",
  );
  await expect(page.getByTestId("asset-detail-core-exposure-panel")).toContainText(
    "No exposure yet",
  );
  await expect(page.getByTestId("asset-detail-net-position")).toHaveCount(0);
  await expect(page.getByTestId("asset-detail-arkas-table")).toHaveCount(0);
  await expect(page.getByRole("link", { name: /open asset explorer/i })).toHaveAttribute(
    "href",
    "/assets",
  );
  await expect(
    page
      .getByTestId("asset-detail-core-exposure-panel")
      .getByRole("link", { name: /create arka/i }),
  ).toHaveAttribute(
    "href",
    "/factory/create?asset=CDCKFBZYF2AQCSM3JOF2ZM27O3Y6AJAI4OTCQKAFNZ3FHBYUTFOKICIY",
  );
});

test("asset and manager detail product frames stay contained across breakpoints", async ({
  page,
}) => {
  await mockCatalogApi(page);

  for (const breakpoint of DETAIL_BREAKPOINTS) {
    await page.setViewportSize({
      width: breakpoint.width,
      height: breakpoint.height,
    });

    await page.goto(`/assets/${DETAIL_ASSET_ID}`);
    await expect(page.getByTestId("asset-detail-fidelity-shell")).toBeVisible();
    await expect(page.getByTestId("asset-detail-fidelity-shell")).toHaveClass(
      /public-detail-shell-cutover/,
    );
    await expect(page.getByTestId("asset-detail-stage-grid")).toHaveClass(
      /explorer-detail-stage-cutover/,
    );
    await expect(page.getByTestId("asset-detail-arkas-table")).toBeVisible();
    await expectDetailLaneCutover(
      page,
      "asset-detail-stage-grid",
      `asset-detail@${breakpoint.label}`,
    );
    await expectDetailCanvasContained(
      page,
      "asset-detail-fidelity-shell",
      `asset-detail@${breakpoint.label}`,
    );

    await page.goto(`/managers/${DETAIL_MANAGER_ID}`);
    await expect(page.getByTestId("manager-detail-fidelity-shell")).toBeVisible();
    await expect(page.getByTestId("manager-detail-fidelity-shell")).toHaveClass(
      /public-detail-shell-cutover/,
    );
    await expect(page.getByTestId("manager-detail-stage-grid")).toHaveClass(
      /explorer-detail-stage-cutover/,
    );
    await expect(page.getByTestId("manager-detail-arkas-table")).toBeVisible();
    await expectDetailLaneCutover(
      page,
      "manager-detail-stage-grid",
      `manager-detail@${breakpoint.label}`,
    );
    await expectDetailCanvasContained(
      page,
      "manager-detail-fidelity-shell",
      `manager-detail@${breakpoint.label}`,
    );
  }
});
