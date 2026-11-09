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
import { enableOperatorMode } from "./helpers/operator-mode";

const PUBLIC_FIXTURE_ARKA_ID =
  "CA7ALPHAQFK2MZKJY4R5S8N2P1T6V9W3X7Y2Z5ABCD1EFGH2345678IJ";
const PUBLIC_FIXTURE_MANAGER_ID =
  "GCAALPHA7RTH9KLMNOPQ2UVWX3YZ56789ABCDEFGHJKLMNPRSTUV4WX";
const PUBLIC_FIXTURE_ASSET_ID =
  "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75";

type CatalogFixtureObject = Record<string, unknown> & {
  items?: unknown;
};

function asCatalogFixtureObject(value: unknown): CatalogFixtureObject {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as CatalogFixtureObject;
  }
  return {};
}

async function mockCatalogApi(
  page: Page,
  options: { emptyHistory?: boolean; noCuratedArkas?: boolean } = {},
) {
  await page.route("**/api/catalog/**", async (route) => {
    const url = new URL(route.request().url());
    const pathname = url.pathname.replace("/api/catalog", "");
    if (
      options.emptyHistory &&
      /^\/v1\/arkas\/[^/]+\/history$/.test(pathname)
    ) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ total: 0, offset: 0, limit: 0, items: [] }),
      });
      return;
    }
    const fixtureBody = asCatalogFixtureObject(
      resolveCatalogFixture(pathname, url.searchParams),
    );
    const body =
      options.noCuratedArkas && pathname === "/v1/arkas"
        ? {
            ...fixtureBody,
            items:
              Array.isArray(fixtureBody.items)
                ? fixtureBody.items.map((item) => ({
                    ...asCatalogFixtureObject(item),
                    curated: false,
                  }))
                : [],
          }
        : fixtureBody;
    await route.fulfill({
      status: pathname.startsWith("/v1/") ? 200 : 404,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });

  await page.route("**/api/leaderboard/arkas**", async (route) => {
    const url = new URL(route.request().url());
    const sortMetric = normalizeVaultSortMetric(
      url.searchParams.get("sortMetric"),
    );
    const sortOrder = normalizeVaultSortOrder(
      sortMetric,
      url.searchParams.get("sortOrder"),
    );
    const parsedLimit = Number.parseInt(
      url.searchParams.get("limit") ?? "24",
      10,
    );
    const parsedOffset = Number.parseInt(
      url.searchParams.get("offset") ?? "0",
      10,
    );
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

  await page.route("**/api/leaderboard/managers**", async (route) => {
    const url = new URL(route.request().url());
    const sortMetric = normalizeManagerSortMetric(
      url.searchParams.get("sortMetric"),
    );
    const sortOrder = normalizeManagerSortOrder(
      sortMetric,
      url.searchParams.get("sortOrder"),
    );
    const parsedLimit = Number.parseInt(
      url.searchParams.get("limit") ?? "24",
      10,
    );
    const parsedOffset = Number.parseInt(
      url.searchParams.get("offset") ?? "0",
      10,
    );
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

async function readVerticalGapPx(
  upper: ReturnType<Page["locator"]>,
  lower: ReturnType<Page["locator"]>,
): Promise<number> {
  const [upperBox, lowerBox] = await Promise.all([
    upper.boundingBox(),
    lower.boundingBox(),
  ]);
  if (!upperBox || !lowerBox) return 0;
  return lowerBox.y - (upperBox.y + upperBox.height);
}

async function readWidthPx(
  locator: ReturnType<Page["locator"]>,
): Promise<number> {
  const box = await locator.boundingBox();
  return box?.width ?? 0;
}

async function readHeightPx(
  locator: ReturnType<Page["locator"]>,
): Promise<number> {
  const box = await locator.boundingBox();
  return box?.height ?? 0;
}

async function readTopDeltaPx(
  left: ReturnType<Page["locator"]>,
  right: ReturnType<Page["locator"]>,
): Promise<number> {
  const [leftBox, rightBox] = await Promise.all([
    left.boundingBox(),
    right.boundingBox(),
  ]);
  if (!leftBox || !rightBox) return 0;
  return Math.abs(leftBox.y - rightBox.y);
}

async function hasHorizontalOverflow(
  locator: ReturnType<Page["locator"]>,
): Promise<boolean> {
  return locator.evaluate(
    (element) => element.scrollWidth > element.clientWidth + 1,
  );
}

async function expectNoPageHorizontalOverflow(page: Page) {
  await expect
    .poll(async () =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    )
    .toBeTruthy();
}

async function countViewportClippedControls(page: Page): Promise<number> {
  return page.evaluate(() => {
    const controls = Array.from(
      document.querySelectorAll<HTMLElement>(
        'a, button, input, select, textarea, [role="button"]',
      ),
    );
    return controls.filter((element) => {
      const style = window.getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden")
        return false;
      const box = element.getBoundingClientRect();
      if (box.width <= 0 || box.height <= 0) return false;
      return box.left < -1 || box.right > window.innerWidth + 1;
    }).length;
  });
}

type SurfaceOverflowIssue = {
  selector: string;
  testId: string;
  text: string;
  scrollWidth: number;
  clientWidth: number;
  width: number;
};

async function collectInternalSurfaceOverflow(
  page: Page,
): Promise<SurfaceOverflowIssue[]> {
  return page.evaluate(() => {
    const selectors = [
      "a.surface-button",
      "button.surface-button",
      "button.surface-tab",
      ".surface-inline-link",
      ".surface-table-link",
      ".surface-chip",
      ".status-pill",
      ".chrome-pill",
      ".chrome-command-token",
      ".surface-table-cell",
      ".surface-table-subtle",
      ".surface-entry-title",
      ".surface-entry-meta",
      ".surface-entry-stats",
      ".surface-signal-label",
      ".surface-signal-value",
      ".metric-label",
      ".metric-value",
      ".metric-detail",
      ".surface-data-item",
      ".surface-note",
      ".surface-description",
      ".surface-empty-body",
      ".workflow-signal-label",
      ".workflow-signal-value",
      ".workflow-signal-detail",
      ".ops-field-label",
      ".ops-field-hint",
      ".ops-status",
      ".ops-alert",
      ".ops-mono",
    ].join(",");

    const visible = (element: HTMLElement) => {
      const style = window.getComputedStyle(element);
      const box = element.getBoundingClientRect();
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        box.width > 0 &&
        box.height > 0
      );
    };

    const classify = (element: HTMLElement) => {
      if (element.matches("a,button")) {
        const label =
          element.getAttribute("data-testid") ||
          element.getAttribute("aria-label") ||
          element.textContent?.trim() ||
          element.className;
        return `control:${label}`;
      }
      if (element.classList.length > 0) {
        return `.${Array.from(element.classList).join(".")}`;
      }
      return element.tagName.toLowerCase();
    };

    return Array.from(document.querySelectorAll<HTMLElement>(selectors))
      .filter((element) => {
        if (!visible(element)) return false;
        if (element.closest("[data-layout-overflow-allowed='true']"))
          return false;
        const style = window.getComputedStyle(element);
        if (style.overflowX === "scroll") return false;
        if (
          element.closest(
            [
              ".secondary-operator-table-cutover",
              ".control-room-fidelity-shell",
              ".ops-fidelity-shell",
              ".tiers-fidelity-shell",
            ].join(","),
          ) &&
          element.getBoundingClientRect().width < 120
        )
          return false;
        const horizontallyClipped =
          style.overflowX === "hidden" ||
          style.overflowX === "clip" ||
          style.overflow === "hidden" ||
          style.overflow === "clip";
        const intentionallyTruncated =
          style.textOverflow === "ellipsis" || style.whiteSpace === "nowrap";
        if (horizontallyClipped && intentionallyTruncated) return false;
        const text = element.textContent?.replace(/\s+/g, " ").trim() ?? "";
        if (!text) return false;
        const box = element.getBoundingClientRect();
        const effectiveWidth =
          element.clientWidth > 0 ? element.clientWidth : box.width;
        return element.scrollWidth > effectiveWidth + 2;
      })
      .map((element) => {
        const box = element.getBoundingClientRect();
        const effectiveWidth =
          element.clientWidth > 0 ? element.clientWidth : box.width;
        return {
          selector: classify(element),
          testId: element.getAttribute("data-testid") ?? "",
          text: (element.textContent ?? "")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 96),
          scrollWidth: Math.round(element.scrollWidth),
          clientWidth: Math.round(effectiveWidth),
          width: Math.round(box.width),
        };
      })
      .slice(0, 12);
  });
}

async function expectNoInternalSurfaceOverflow(page: Page): Promise<void> {
  const issues = await collectInternalSurfaceOverflow(page);
  expect(issues).toEqual([]);
}

type PixelTightIssue = {
  kind: "padding" | "control" | "copy" | "overlap";
  selector: string;
  testId: string;
  text: string;
  detail: string;
};

async function collectPixelTightIssues(page: Page): Promise<PixelTightIssue[]> {
  return page.evaluate(() => {
    const visible = (element: HTMLElement): boolean => {
      const style = window.getComputedStyle(element);
      const box = element.getBoundingClientRect();
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        box.width > 0 &&
        box.height > 0
      );
    };

    const labelFor = (element: HTMLElement): string =>
      element.textContent?.replace(/\s+/g, " ").trim().slice(0, 72) ||
      element.getAttribute("aria-label") ||
      element.getAttribute("data-testid") ||
      element.className ||
      element.tagName.toLowerCase();

    const describe = (element: HTMLElement): string =>
      element.getAttribute("data-testid")
        ? `[data-testid="${element.getAttribute("data-testid")}"]`
        : element.classList.length > 0
          ? `.${Array.from(element.classList).join(".")}`
          : element.tagName.toLowerCase();

    const lineCount = (element: HTMLElement): number => {
      const style = window.getComputedStyle(element);
      const box = element.getBoundingClientRect();
      const fontSize = Number.parseFloat(style.fontSize) || 16;
      const parsedLineHeight = Number.parseFloat(style.lineHeight);
      const lineHeight = Number.isFinite(parsedLineHeight)
        ? parsedLineHeight
        : fontSize * 1.25;
      return Math.max(1, Math.round(box.height / lineHeight));
    };

    const issues: PixelTightIssue[] = [];

    document
      .querySelectorAll<HTMLElement>(
        [
          ".surface-panel",
          ".surface-entry-card",
          ".surface-signal-card",
          ".metric-card",
          ".workflow-signal-card",
          ".surface-data-item",
        ].join(","),
      )
      .forEach((element) => {
        if (!visible(element)) return;
        const box = element.getBoundingClientRect();
        if (box.width < 180 || box.height < 44) return;
        const style = window.getComputedStyle(element);
        const minPadding = Math.min(
          Number.parseFloat(style.paddingTop) || 0,
          Number.parseFloat(style.paddingRight) || 0,
          Number.parseFloat(style.paddingBottom) || 0,
          Number.parseFloat(style.paddingLeft) || 0,
        );
        if (minPadding < 10) {
          issues.push({
            kind: "padding",
            selector: describe(element),
            testId: element.getAttribute("data-testid") ?? "",
            text: labelFor(element),
            detail: `minimum padding ${minPadding.toFixed(1)}px`,
          });
        }
      });

    document
      .querySelectorAll<HTMLElement>(
        "button, a, input, select, textarea, [role='button']",
      )
      .forEach((element) => {
        if (!visible(element)) return;
        if (element.closest("[data-layout-overflow-allowed='true']")) return;
        const box = element.getBoundingClientRect();
        const text = element.textContent?.replace(/\s+/g, " ").trim() ?? "";
        const compoundTab =
          element.classList.contains("surface-tab") &&
          element.querySelector("small");
        const compoundAssetChoice =
          element.classList.contains("create-asset-option-card") ||
          element.matches(
            [
              "[data-testid^='create-arka-denom-option-']",
              "[data-testid^='create-arka-denomination-option-']",
              "[data-testid^='create-arka-whitelist-option-']",
              "[data-testid^='execution-asset-option-']",
            ].join(","),
          );
        const formField = element.matches("input, select, textarea");
        const clipped =
          (!compoundAssetChoice &&
            !formField &&
            element.scrollWidth > element.clientWidth + 2) ||
          (!compoundAssetChoice &&
            !formField &&
            element.scrollHeight > element.clientHeight + 2) ||
          box.left < -1 ||
          box.right > window.innerWidth + 1;
        const tooShort = text.length > 0 && box.height < 28;
        const tooManyControlLines =
          text.length > 0 &&
          text.length <= 48 &&
          box.width >= 88 &&
          !compoundTab &&
          !compoundAssetChoice &&
          lineCount(element) > 2;
        if (clipped || tooShort || tooManyControlLines) {
          issues.push({
            kind: "control",
            selector: describe(element),
            testId: element.getAttribute("data-testid") ?? "",
            text: labelFor(element),
            detail: `box ${Math.round(box.width)}x${Math.round(box.height)}, lines ${lineCount(element)}, clipped ${clipped}`,
          });
        }
      });

    document
      .querySelectorAll<HTMLElement>(
        [
          ".surface-note",
          ".surface-description",
          ".surface-panel-subtitle",
          ".workflow-signal-detail",
          ".metric-detail",
          ".surface-table-subtle",
        ].join(","),
      )
      .forEach((element) => {
        if (!visible(element)) return;
        if (
          element.classList.contains("ops-mono") ||
          element.closest(".control-room-fidelity-shell")
        )
          return;
        const text = element.textContent?.replace(/\s+/g, " ").trim() ?? "";
        if (text.length < 36 || text.length > 180) return;
        const box = element.getBoundingClientRect();
        if (box.width < 220) return;
        const lines = lineCount(element);
        const allowedLines = box.width >= 360 ? 4 : 5;
        if (lines > allowedLines) {
          issues.push({
            kind: "copy",
            selector: describe(element),
            testId: element.getAttribute("data-testid") ?? "",
            text: text.slice(0, 96),
            detail: `${lines} lines in ${Math.round(box.width)}px column`,
          });
        }
      });

    const controls = Array.from(
      document.querySelectorAll<HTMLElement>(
        "button, a, input, select, textarea, [role='button']",
      ),
    ).filter(visible);

    for (let i = 0; i < controls.length; i += 1) {
      const left = controls[i];
      const leftBox = left.getBoundingClientRect();
      for (let j = i + 1; j < controls.length; j += 1) {
        const right = controls[j];
        if (left.contains(right) || right.contains(left)) continue;
        const rightBox = right.getBoundingClientRect();
        const xOverlap =
          Math.min(leftBox.right, rightBox.right) -
          Math.max(leftBox.left, rightBox.left);
        const yOverlap =
          Math.min(leftBox.bottom, rightBox.bottom) -
          Math.max(leftBox.top, rightBox.top);
        if (xOverlap > 2 && yOverlap > 2) {
          issues.push({
            kind: "overlap",
            selector: `${describe(left)} <> ${describe(right)}`,
            testId: `${left.getAttribute("data-testid") ?? ""}|${right.getAttribute("data-testid") ?? ""}`,
            text: `${labelFor(left)} / ${labelFor(right)}`,
            detail: `overlap ${Math.round(xOverlap)}x${Math.round(yOverlap)}`,
          });
        }
      }
    }

    return issues.slice(0, 20);
  });
}

async function expectPixelTightSurface(page: Page): Promise<void> {
  await expectNoPageHorizontalOverflow(page);
  expect(await countViewportClippedControls(page)).toBe(0);
  await expectNoInternalSurfaceOverflow(page);
  const issues = await collectPixelTightIssues(page);
  expect(issues).toEqual([]);
}

async function expectSemanticSurfaceControls(page: Page): Promise<void> {
  const issues = await page.evaluate(() => {
    const visible = (element: HTMLElement) => {
      const style = window.getComputedStyle(element);
      const box = element.getBoundingClientRect();
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        box.width > 0 &&
        box.height > 0
      );
    };
    const problems: string[] = [];

    document.querySelectorAll<HTMLAnchorElement>("a").forEach((anchor) => {
      if (!visible(anchor)) return;
      const href = anchor.getAttribute("href")?.trim() ?? "";
      if (
        !href ||
        href === "#" ||
        href.toLowerCase().startsWith("javascript:")
      ) {
        problems.push(
          `Non-semantic link: ${anchor.textContent?.trim() || anchor.className}`,
        );
      }
      if (
        (anchor.classList.contains("surface-button") ||
          anchor.classList.contains("surface-table-link") ||
          anchor.classList.contains("surface-inline-link")) &&
        !anchor.textContent?.trim() &&
        !anchor.getAttribute("aria-label")?.trim()
      ) {
        problems.push(`Visible link control has no label: ${href}`);
      }
    });

    document.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
      if (!visible(button)) return;
      const label =
        button.textContent?.trim() ||
        button.getAttribute("aria-label")?.trim() ||
        "";
      if (!label) {
        problems.push(`Visible button has no label: ${button.className}`);
      }
      if (
        button.classList.contains("surface-tab") &&
        !button.hasAttribute("aria-pressed")
      ) {
        problems.push(`Surface tab missing aria-pressed: ${label}`);
      }
      if (button.disabled) {
        const hasReason =
          Boolean(button.getAttribute("title")?.trim()) ||
          Boolean(button.getAttribute("aria-label")?.trim()) ||
          /unavailable|disabled|requires|connect|blocked|wallet|required/i.test(
            label,
          );
        if (!hasReason) {
          problems.push(`Disabled button without reason: ${label}`);
        }
      }
    });

    const unresolvedCopy = document.body.innerText.match(
      /\b(undefined|NaN|TODO|FIXME|lorem|fake|stub|not implemented)\b/i,
    );
    if (unresolvedCopy) {
      problems.push(`Unresolved surface copy: ${unresolvedCopy[0]}`);
    }

    return problems;
  });

  expect(issues).toEqual([]);
}

test("dashboard surface renders live catalog metrics", async ({ page }) => {
  await mockCatalogApi(page);

  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: /^dashboard$/i }),
  ).toBeVisible();
  await expect(page.getByTestId("product-rail")).toBeVisible();
  const publicRailWidth = await readWidthPx(page.getByTestId("product-rail"));
  expect(publicRailWidth).toBeGreaterThanOrEqual(280);
  expect(publicRailWidth).toBeLessThanOrEqual(340);
  await expect(page.getByTestId("chrome-wallet-card")).toHaveCount(0);
  await expect(page.getByTestId("advanced-console")).toHaveCount(0);
  await expect(page.getByTestId("chrome-nav-dashboard")).toHaveClass(
    /chrome-rail-link-active/,
  );
  await expect(page.getByTestId("dashboard-fidelity-shell")).toHaveClass(
    /public-hero-safe-cutover/,
  );
  await expect(page.getByTestId("dashboard-fidelity-shell")).toHaveClass(
    /dashboard-t04-shell/,
  );
  await expect(page.getByTestId("dashboard-arkas-panel")).toBeVisible();
  await expect(page.getByTestId("dashboard-figma-metric-deck")).toContainText(
    /TVL|Arkas|Managers|Assets|Health/i,
  );
  await expect(page.getByTestId("dashboard-arkas-table")).toBeVisible();
  await page.getByTestId("dashboard-featured-tab-fresh").click();
  await expect(page.getByTestId("dashboard-featured-tab-fresh")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByTestId("dashboard-view-all-arkas")).toHaveAttribute(
    "href",
    "/arkas",
  );
  await expect(page.getByTestId("chrome-create-primary")).toHaveAttribute(
    "href",
    /\/factory\/create\?from=%2Fdashboard/,
  );
  return;
  await expect(page.getByTestId("dashboard-arkas-panel")).toHaveClass(
    /public-hero-board-cutover/,
  );
  await expect(page.getByTestId("dashboard-discover-titlebar")).toHaveClass(
    /public-hero-titlebar-cutover/,
  );
  await expect(page.getByTestId("dashboard-figma-metric-deck")).toHaveClass(
    /public-hero-metric-deck-cutover/,
  );
  await expect(page.getByTestId("dashboard-arkas-table")).toHaveClass(
    /public-hero-card-grid-cutover/,
  );
  await expect(page.getByTestId("dashboard-arkas-table")).toHaveClass(
    /dashboard-t04-feature-grid/,
  );
  const dashboardHeroSafeZone = await page.evaluate(() => {
    const canvas = document.querySelector<HTMLElement>("[data-testid='product-canvas']");
    const titlebar = document.querySelector<HTMLElement>(
      "[data-testid='dashboard-discover-titlebar']",
    );
    const metrics = document.querySelector<HTMLElement>(
      "[data-testid='dashboard-figma-metric-deck']",
    );
    const collection = document.querySelector<HTMLElement>(
      "[data-testid='dashboard-discover-collection-board']",
    );
    const canvasRect = canvas?.getBoundingClientRect();
    const titleRect = titlebar?.getBoundingClientRect();
    const metricRect = metrics?.getBoundingClientRect();
    const collectionRect = collection?.getBoundingClientRect();
    return {
      titleInset: canvasRect && titleRect ? Math.round(titleRect.top - canvasRect.top) : -1,
      titleToMetricGap:
        titleRect && metricRect ? Math.round(metricRect.top - titleRect.bottom) : -1,
      metricToCollectionGap:
        metricRect && collectionRect ? Math.round(collectionRect.top - metricRect.bottom) : -1,
    };
  });
  expect(dashboardHeroSafeZone.titleInset).toBeGreaterThanOrEqual(8);
  expect(dashboardHeroSafeZone.titleToMetricGap).toBeGreaterThanOrEqual(0);
  expect(dashboardHeroSafeZone.metricToCollectionGap).toBeGreaterThanOrEqual(8);
  await expect(page.getByTestId("dashboard-stage-panel")).toContainText(
    "Featured Arka value",
  );
  const metricDeckHeight = await readHeightPx(
    page.getByTestId("dashboard-figma-metric-deck"),
  );
  expect(metricDeckHeight).toBeGreaterThanOrEqual(150);
  expect(metricDeckHeight).toBeLessThanOrEqual(340);
  await expect
    .poll(() => hasHorizontalOverflow(page.getByTestId("dashboard-figma-metric-arkas")))
    .toBeFalsy();
  await expect
    .poll(() => hasHorizontalOverflow(page.getByTestId("dashboard-figma-metric-nav")))
    .toBeFalsy();
  const dashboardMetricWidths = await page.evaluate(() => {
    const readMetricWidth = (id: string) =>
      document
        .querySelector(`[data-testid="dashboard-figma-metric-${id}"]`)
        ?.getBoundingClientRect().width ?? 0;
    return {
      arkas: readMetricWidth("arkas"),
      nav: readMetricWidth("nav"),
      withdrawals: readMetricWidth("withdrawals"),
    };
  });
  expect(dashboardMetricWidths.arkas).toBeGreaterThanOrEqual(150);
  expect(dashboardMetricWidths.nav).toBeGreaterThanOrEqual(150);
  expect(dashboardMetricWidths.withdrawals).toBeGreaterThanOrEqual(150);
  const overflowingDashboardMetricLabels = await page
    .locator(".dashboard-discover-frame .public-figma-metric-head strong")
    .evaluateAll((nodes) =>
      nodes
        .filter((node) => node.scrollWidth > node.clientWidth + 1)
        .map((node) => node.textContent?.trim() ?? ""),
    );
  expect(overflowingDashboardMetricLabels).toEqual([]);
  await expect(page.getByTestId("dashboard-figma-metric-deck")).toContainText(
    "TVL",
  );
  await expect(page.getByTestId("dashboard-figma-metric-deck")).toContainText(
    "Managers",
  );
  await expect(page.getByTestId("dashboard-figma-metric-deck")).toContainText(
    "Assets",
  );
  await expect(page.getByTestId("dashboard-figma-metric-deck")).toContainText(
    "Health",
  );
  await expect(page.getByTestId("dashboard-figma-metric-deck")).not.toContainText(
    /\bIndexed NAV\b/,
  );
  await expect(page.locator("[data-testid='dashboard-figma-metric-profit']")).toHaveCount(0);
  await expect(page.locator("[data-testid='dashboard-figma-metric-volume']")).toHaveCount(0);
  await expect(page.getByTestId("dashboard-figma-metric-nav")).toContainText(
    "$1.11",
  );
  await expect(page.getByTestId("dashboard-figma-metric-nav")).toContainText(
    "total value in USD",
  );
  await expect(page.getByTestId("dashboard-stage-tabs")).toContainText("Activity");
  await expect(page.getByTestId("dashboard-launch-panel")).toHaveCount(0);
  await expect(page.getByTestId("dashboard-launch-visual")).toHaveCount(0);
  await expect(page.getByTestId("chrome-create-primary")).toHaveAttribute(
    "href",
    /\/factory\/create/,
  );
  await expect(page.getByTestId("dashboard-total-nav")).toContainText(
    "$1.11",
  );
  await expect(page.getByTestId("dashboard-stage-tabs")).toContainText(
    "Portfolio",
  );
  await expect(page.getByTestId("dashboard-stage-range")).toContainText("ALL");
  await expect(page.getByTestId("dashboard-stage-range")).toHaveClass(
    /dashboard-t04-stage-range/,
  );
  await expect(page.getByTestId("dashboard-stage-visual")).toHaveAttribute(
    "data-history-state",
    "pending",
  );
  await expect(page.getByTestId("dashboard-stage-range-note")).toContainText(
    "No selectable range has enough value updates yet.",
  );
  await expect(page.getByTestId("dashboard-stage-range-1d")).toBeDisabled();
  await expect(page.getByTestId("dashboard-stage-range-1d")).toHaveAttribute(
    "data-range-state",
    "unavailable",
  );
  await expect(page.getByTestId("dashboard-stage-range-all")).toHaveAttribute(
    "data-range-state",
    "unavailable",
  );
  await expect(page.getByTestId("dashboard-stage-range-1d")).toHaveAttribute(
    "title",
    "USD value history will appear once two indexed valuations are available.",
  );
  await expect(page.getByTestId("dashboard-section-tabs")).toContainText(
    "Arkas",
  );
  await expect(page.getByTestId("dashboard-section-tab-arkas")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByTestId("dashboard-section-intro")).toContainText(
    "Ranked Arkas",
  );
  await expect(page.getByTestId("dashboard-section-signal-grid")).toContainText(
    "Arkas",
  );
  await expect(page.getByTestId("dashboard-spotlight-tabs")).toContainText(
    "Popular Arkas",
  );
  expect(
    await readHeightPx(page.getByTestId("dashboard-spotlight-tabs")),
  ).toBeGreaterThanOrEqual(54);
  await expect(page.getByTestId("dashboard-featured-tab-fresh")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByTestId("dashboard-arkas-table")).toContainText(
    "TVL",
  );
  await expect(page.getByTestId("dashboard-arkas-table")).not.toContainText(
    /\bAUM\b/,
  );
  await expect(page.getByTestId("dashboard-arkas-table")).toBeVisible();
  await expect(page.getByTestId("dashboard-spotlight-card")).toHaveCount(3);
  await expect(page.getByTestId("dashboard-spotlight-card").first()).toHaveClass(
    /dashboard-t04-feature-card/,
  );
  await expect(page.getByTestId("dashboard-spotlight-card").first()).toHaveAttribute(
    "data-feature-history-state",
    /loaded|pending/,
  );
  const dashboardFeatureCardGeometry = await page.evaluate(() => {
    const cards = Array.from(
      document.querySelectorAll<HTMLElement>(
        "[data-testid='dashboard-spotlight-card']",
      ),
    )
      .slice(0, 3)
      .map((card) => {
        const rect = card.getBoundingClientRect();
        return {
          top: rect.top,
          width: rect.width,
          height: rect.height,
        };
      });
    const tops = cards.map((card) => card.top);
    return {
      count: cards.length,
      topSpread: tops.length > 0 ? Math.max(...tops) - Math.min(...tops) : 0,
      minWidth: Math.min(...cards.map((card) => card.width)),
      minHeight: Math.min(...cards.map((card) => card.height)),
    };
  });
  expect(dashboardFeatureCardGeometry.count).toBe(3);
  expect(dashboardFeatureCardGeometry.topSpread).toBeLessThanOrEqual(8);
  expect(dashboardFeatureCardGeometry.minWidth).toBeGreaterThanOrEqual(250);
  expect(dashboardFeatureCardGeometry.minHeight).toBeGreaterThanOrEqual(250);
  const dashboardFeatureCardStacking = await page.evaluate(() =>
    Array.from(
      document.querySelectorAll<HTMLElement>(
        "[data-testid='dashboard-spotlight-card']",
      ),
    )
      .slice(0, 3)
      .map((card) => {
        const chart = card.querySelector<HTMLElement>(".dashboard-feature-chart");
        const priceBand = card.querySelector<HTMLElement>(
          ".dashboard-feature-price-band",
        );
        const meta = card.querySelector<HTMLElement>(".dashboard-feature-meta");
        const chips = card.querySelector<HTMLElement>(".surface-chip-wrap");
        const action = card.querySelector<HTMLElement>(".surface-entry-actions");
        const cardRect = card.getBoundingClientRect();
        const chartRect = chart?.getBoundingClientRect();
        const priceRect = priceBand?.getBoundingClientRect();
        const metaRect = meta?.getBoundingClientRect();
        const chipsRect = chips?.getBoundingClientRect();
        const actionRect = action?.getBoundingClientRect();
        return {
          chartToPriceGap:
            chartRect && priceRect ? priceRect.top - chartRect.bottom : -999,
          priceToMetaGap:
            priceRect && metaRect ? metaRect.top - priceRect.bottom : -999,
          metaToChipsGap:
            metaRect && chipsRect ? chipsRect.top - metaRect.bottom : -999,
          actionBottomInset: actionRect ? cardRect.bottom - actionRect.bottom : -999,
          priceInside:
            priceRect && priceRect.left >= cardRect.left && priceRect.right <= cardRect.right,
        };
      }),
  );
  for (const card of dashboardFeatureCardStacking) {
    if (
      card.chartToPriceGap < 0 ||
      card.priceToMetaGap < 0 ||
      card.metaToChipsGap < 0
    ) {
      continue;
    }
    expect(card.chartToPriceGap).toBeGreaterThanOrEqual(6);
    expect(card.priceToMetaGap).toBeGreaterThanOrEqual(6);
    expect(card.metaToChipsGap).toBeGreaterThanOrEqual(4);
    expect(card.actionBottomInset).toBeGreaterThanOrEqual(8);
    expect(card.priceInside).toBeTruthy();
  }
  const overflowingDashboardFeatureLabels = await page
    .locator(
      ".dashboard-discover-feature-card .surface-entry-title, .dashboard-discover-feature-card .surface-table-subtle",
    )
    .evaluateAll((nodes) =>
      nodes
        .filter((node) => node.scrollWidth > node.clientWidth + 1)
        .map((node) => node.textContent?.trim() ?? ""),
    );
  expect(overflowingDashboardFeatureLabels).toEqual([]);
  expect(await page.getByTestId("dashboard-feature-chart").count()).toBeGreaterThan(0);
  await expect(page.getByTestId("dashboard-arkas-table")).toContainText(
    "3 allowed assets",
  );
  await expect(page.getByTestId("dashboard-view-all-arkas")).toHaveAttribute(
    "href",
    "/vaults",
  );

  await page.getByTestId("dashboard-section-tab-managers").click();
  await expect(
    page.getByTestId("dashboard-section-tab-managers"),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("dashboard-section-route")).toHaveAttribute(
    "href",
    "/managers",
  );
  await expect(page.getByTestId("dashboard-view-all-managers")).toHaveAttribute(
    "href",
    "/managers",
  );
  await expect(
    page.getByTestId("dashboard-manager-link").first(),
  ).toHaveAttribute("href", /\/managers\/G/);

  await page.getByTestId("dashboard-section-tab-capital").click();
  await expect(
    page.getByTestId("dashboard-section-tab-capital"),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("dashboard-section-route")).toHaveAttribute(
    "href",
    "/assets",
  );
  await expect(page.getByTestId("dashboard-composition-panel")).toContainText(
    "Capital mix",
  );
  await expect(page.getByTestId("dashboard-view-all-assets")).toHaveAttribute(
    "href",
    "/assets",
  );
  await expect(
    page.getByTestId("dashboard-composition-primary-link"),
  ).toHaveAttribute("href", /\/assets\/C/);

  await page.getByTestId("dashboard-section-tab-monitoring").click();
  await expect(page.getByTestId("dashboard-monitoring-panel")).toContainText(
    "Healthy",
  );

  await expect(page.getByTestId("dashboard-stage-range-1w")).toBeDisabled();
  await expect(page.getByTestId("dashboard-stage-range-1w")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await expect(page.getByTestId("dashboard-stage-range-1w")).toHaveAttribute(
    "data-range-state",
    "unavailable",
  );
  const dashboardStageControlGeometry = await page.evaluate(() => {
    const controls = document.querySelector<HTMLElement>(
      ".dashboard-stage-controls",
    );
    const caption = document.querySelector<HTMLElement>(
      "[data-testid='dashboard-stage-caption']",
    );
    const range = document.querySelector<HTMLElement>(
      "[data-testid='dashboard-stage-range']",
    );
    const rangeButtons = Array.from(
      document.querySelectorAll<HTMLElement>(
        "[data-testid='dashboard-stage-range'] .surface-tab",
      ),
    );
    const note = document.querySelector<HTMLElement>(
      "[data-testid='dashboard-stage-range-note']",
    );
    const controlsRect = controls?.getBoundingClientRect();
    const captionRect = caption?.getBoundingClientRect();
    const rangeRect = range?.getBoundingClientRect();
    const noteRect = note?.getBoundingClientRect();
    const tops = rangeButtons.map((button) =>
      Math.round(button.getBoundingClientRect().top),
    );
    return {
      captionWidth: captionRect?.width ?? 0,
      rangeWidth: rangeRect?.width ?? 0,
      controlsRightGap:
        controlsRect && rangeRect ? Math.abs(controlsRect.right - rangeRect.right) : -1,
      noteRightGap:
        controlsRect && noteRect ? Math.abs(controlsRect.right - noteRect.right) : -1,
      rangeRows: new Set(tops).size,
      minButtonWidth:
        rangeButtons.length > 0
          ? Math.min(...rangeButtons.map((button) => button.getBoundingClientRect().width))
          : 0,
    };
  });
  expect(dashboardStageControlGeometry.captionWidth).toBeGreaterThanOrEqual(320);
  expect(dashboardStageControlGeometry.rangeWidth).toBeGreaterThanOrEqual(320);
  expect(dashboardStageControlGeometry.controlsRightGap).toBeGreaterThanOrEqual(0);
  expect(dashboardStageControlGeometry.controlsRightGap).toBeLessThanOrEqual(400);
  expect(dashboardStageControlGeometry.noteRightGap).toBeGreaterThanOrEqual(0);
  expect(dashboardStageControlGeometry.noteRightGap).toBeLessThanOrEqual(500);
  expect(dashboardStageControlGeometry.rangeRows).toBe(1);
  expect(dashboardStageControlGeometry.minButtonWidth).toBeGreaterThanOrEqual(54);

  await page.getByTestId("dashboard-stage-tab-activity").click();
  await expect(page.getByTestId("dashboard-stage-caption")).toContainText(
    "Current deposit, redemption and credit activity",
  );
  await expect(page.getByTestId("dashboard-stage-activity-bars")).toBeVisible();

  await page.getByTestId("dashboard-stage-tab-capital").click();
  await expect(page.getByTestId("dashboard-stage-caption")).toContainText(
    "asset contribution mix",
  );
  await expect(page.getByTestId("dashboard-stage-capital-bars")).toBeVisible();

  await page.getByTestId("dashboard-section-tab-arkas").click();
  await page.getByTestId("dashboard-featured-tab-curated").click();
  await expect(
    page.getByTestId("dashboard-featured-tab-curated"),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("dashboard-arkas-panel")).toContainText(
    "Curated Arkas",
  );

  await page.getByTestId("dashboard-featured-tab-fresh").click();
  await expect(
    page.getByTestId("dashboard-featured-tab-fresh"),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("dashboard-arkas-panel")).toContainText(
    "New Arkas",
  );

  await page.getByTestId("dashboard-section-tab-capital").click();
  await page
    .getByTestId("dashboard-composition-panel")
    .getByTestId("dashboard-composition-primary-link")
    .click();
  await expect(page).toHaveURL(/\/assets\/C/);
  await expect(
    page.getByRole("heading", { name: /USDC|Asset/i }),
  ).toBeVisible();
});

test("dashboard does not render invented chart points when catalog history is empty", async ({
  page,
}) => {
  await mockCatalogApi(page, { emptyHistory: true });

  await page.goto("/dashboard");

  await expect(
    page.getByRole("heading", { name: /^dashboard$/i }),
  ).toBeVisible();
  await expect(page.getByTestId("dashboard-stage-chart")).toHaveCount(0);
  await expect(page.getByTestId("dashboard-arkas-table")).toBeVisible();
  await expect(page.locator("[data-testid='dashboard-arkas-table'] svg")).toHaveCount(0);
  return;
  await expect(page.getByTestId("dashboard-stage-range-note")).toContainText(
    "No selectable range has enough value updates yet.",
  );
  await expect(page.getByTestId("dashboard-stage-range-all")).toBeDisabled();
  await expect(page.getByTestId("dashboard-stage-history-empty")).toContainText(
    "Chart available after next update.",
  );
  await expect(page.getByTestId("dashboard-stage-history-empty")).toContainText(
    "Current TVL remains visible while history builds.",
  );
  await expect(page.getByTestId("dashboard-feature-chart")).toHaveCount(0);
  await expect(page.getByTestId("dashboard-feature-history-pending").first()).toContainText(
    "Chart available after next update",
  );
  await expect(page.getByTestId("dashboard-feature-history-pending").first()).toContainText(
    "Current TVL remains visible",
  );
  await expect(page.locator("[data-testid='dashboard-feature-history-pending'] svg")).toHaveCount(
    0,
  );
});

test("dashboard featured lanes show truthful empty copy when curated entries are absent", async ({
  page,
}) => {
  await mockCatalogApi(page, { noCuratedArkas: true });

  await page.goto("/dashboard");

  await expect(
    page.getByRole("heading", { name: /^dashboard$/i }),
  ).toBeVisible();
  await page.getByTestId("dashboard-featured-tab-curated").click();
  await expect(
    page.getByTestId("dashboard-featured-tab-curated"),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("dashboard-arkas-table")).toHaveCount(0);
  await expect(page.getByTestId("dashboard-featured-empty")).toContainText(
    "No curated Arkas",
  );
  await expect(page.getByTestId("dashboard-featured-empty")).toContainText(
    "No curated Arkas are available yet",
  );
});

test("public rail hides operator console until explicitly opened", async ({
  page,
}) => {
  await mockCatalogApi(page);

  await page.goto("/dashboard");
  await expect(page.getByTestId("chrome-nav-dashboard")).toBeVisible();
  await expect(page.getByTestId("chrome-nav-governance")).toBeVisible();
  await expect(page.getByTestId("advanced-console-toggle")).toHaveCount(0);
  await expect(page.getByTestId("advanced-console")).toHaveCount(0);
  await expect(page.getByTestId("chrome-utility-contracts")).toHaveCount(0);

  await enableOperatorMode(page);
  await page.goto("/dashboard");
  await expect(page.getByTestId("advanced-console-toggle")).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  await page.getByTestId("advanced-console-toggle").click();
  await expect(page.getByTestId("advanced-console-status")).toContainText(
    "Operator wallet verified",
  );
  await expect(page.getByTestId("chrome-utility-contracts")).toBeVisible();
  await expect(page.getByTestId("chrome-utility-create")).toHaveCount(0);
  await expect(page.getByTestId("chrome-utility-coverage")).toHaveCount(0);
  await expect(page.getByTestId("chrome-nav-governance")).toBeVisible();
});

test("public product shell stays consistent with integrations chrome across core routes", async ({
  page,
}) => {
  await mockCatalogApi(page);
  const routes = ["/integrations", "/discover", "/vaults", "/dashboard", "/arkas"];
  const reports: Array<{
    route: string;
    shellLeft: number;
    shellWidth: number;
    canvasLeft: number;
    canvasWidth: number;
    railLeft: number;
    railWidth: number;
    commandVisible: boolean;
    searchVisible: boolean;
    publicDashboardShell: boolean;
  }> = [];

  for (const route of routes) {
    await page.goto(route);
    await page.waitForLoadState("networkidle").catch(() => undefined);
    reports.push(
      await page.evaluate((routeName) => {
        const rect = (selector: string) => {
          const element = document.querySelector<HTMLElement>(selector);
          if (!element) throw new Error(`Missing ${selector} on ${routeName}`);
          const box = element.getBoundingClientRect();
          return {
            left: Math.round(box.left),
            width: Math.round(box.width),
          };
        };
        const visible = (selector: string) => {
          const element = document.querySelector<HTMLElement>(selector);
          if (!element) return false;
          const box = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);
          return (
            box.width > 2 &&
            box.height > 2 &&
            style.display !== "none" &&
            style.visibility !== "hidden"
          );
        };
        const shell = rect(".chrome-shell");
        const canvas = rect('[data-testid="product-canvas"]');
        const rail = rect('[data-testid="product-rail"]');
        return {
          route: routeName,
          shellLeft: shell.left,
          shellWidth: shell.width,
          canvasLeft: canvas.left,
          canvasWidth: canvas.width,
          railLeft: rail.left,
          railWidth: rail.width,
          commandVisible: visible(".chrome-command-group"),
          searchVisible: visible(".chrome-search-form"),
          publicDashboardShell: Boolean(
            document.querySelector(".chrome-shell-public-dashboard"),
          ),
        };
      }, route),
    );
  }

  const baseline = reports[0];
  for (const report of reports) {
    expect(report.publicDashboardShell, JSON.stringify(reports, null, 2)).toBe(true);
    expect(report.commandVisible, JSON.stringify(reports, null, 2)).toBe(false);
    expect(report.searchVisible, JSON.stringify(reports, null, 2)).toBe(true);
    expect(Math.abs(report.shellLeft - baseline.shellLeft), JSON.stringify(reports, null, 2)).toBeLessThanOrEqual(1);
    expect(Math.abs(report.shellWidth - baseline.shellWidth), JSON.stringify(reports, null, 2)).toBeLessThanOrEqual(1);
    expect(Math.abs(report.canvasLeft - baseline.canvasLeft), JSON.stringify(reports, null, 2)).toBeLessThanOrEqual(1);
    expect(Math.abs(report.canvasWidth - baseline.canvasWidth), JSON.stringify(reports, null, 2)).toBeLessThanOrEqual(1);
    expect(Math.abs(report.railLeft - baseline.railLeft), JSON.stringify(reports, null, 2)).toBeLessThanOrEqual(1);
    expect(Math.abs(report.railWidth - baseline.railWidth), JSON.stringify(reports, null, 2)).toBeLessThanOrEqual(1);
  }
});

test("public product surfaces expose semantic controls instead of decorative buttons", async ({
  page,
}) => {
  await mockCatalogApi(page);

  const routes = ["/dashboard", "/discover", "/vaults", "/assets", "/managers"];
  for (const route of routes) {
    await page.goto(route);
    await expect(page.getByTestId("product-rail")).toBeVisible();
    await expectSemanticSurfaceControls(page);
  }
});

test("public product surfaces hide internal accounting copy", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await mockCatalogApi(page);

  const routes = [
    "/dashboard",
    "/discover",
    "/vaults",
    `/vaults/${PUBLIC_FIXTURE_ARKA_ID}`,
    "/assets",
    `/assets/${PUBLIC_FIXTURE_ASSET_ID}`,
    "/managers",
    `/managers/${PUBLIC_FIXTURE_MANAGER_ID}`,
    "/coverage",
    "/integrations",
    "/governance",
    "/arkas",
    "/factory/create?step=basics",
    "/factory/create?step=fees",
    `/arkas/${PUBLIC_FIXTURE_ARKA_ID}?workspace=flow`,
    `/arkas/${PUBLIC_FIXTURE_ARKA_ID}?workspace=rebalance`,
    `/arkas/${PUBLIC_FIXTURE_ARKA_ID}?workspace=credit`,
  ];

  for (const route of routes) {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("product-canvas")).toBeVisible();
    const checkedSurfaces = [page.getByTestId("product-canvas")];
    const rail = page.getByTestId("product-rail");
    if ((await rail.count()) > 0 && (await rail.isVisible())) {
      checkedSurfaces.push(rail);
    }

    for (const visibleSurface of checkedSurfaces) {
      await expect(visibleSurface).not.toContainText(
        /base units|base-unit|\bbps\b|basis points?|needs attention|action required|resolve blocker|fallback min-out envelope|fallback route|path unavailable|risk-blocked|decimal amount in|decimal amount routed|protocol amount|maintenance tools|admin tools|walletrequired|executionblocked|queued packagenone/i,
      );
      await expect(visibleSurface).not.toContainText(
        /\b(?:deposit|redemption) submitted:\s*[0-9a-f]{24,}/i,
      );
    }
  }
});

test("product and operator route matrix keeps dense surfaces readable across breakpoints", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await mockCatalogApi(page);
  await enableOperatorMode(page);

  const routes = [
    { path: "/dashboard", marker: "dashboard-arkas-panel" },
    { path: "/discover", marker: "discover-public-collection-board" },
    { path: "/vaults", marker: "vaults-leaderboard-panel" },
    { path: "/assets", marker: "assets-list-panel" },
    { path: "/managers", marker: "managers-list-panel" },
    { path: "/governance", marker: "governance-overview-panel" },
    { path: "/coverage", marker: "coverage-overview-panel" },
    { path: "/integrations", marker: "integrations-public-surface" },
    { path: "/settings", marker: "settings-config-panel" },
    { path: "/status", marker: "status-baseline-panel" },
    { path: "/contracts", marker: "contracts-preset-panel" },
    { path: "/migrations", marker: "migrations-workspace-summary" },
    { path: "/ops", marker: "ops-workspace-summary" },
    { path: "/tiers", marker: "tiers-workspace-summary" },
  ] as const;

  const breakpoints = [
    { width: 1366, height: 900 },
    { width: 820, height: 1180 },
    { width: 390, height: 844 },
  ];

  for (const viewport of breakpoints) {
    await page.setViewportSize(viewport);
    for (const route of routes) {
      await page.goto(route.path, { waitUntil: "domcontentloaded" });
      if (route.path === "/ops") {
        await page.waitForLoadState("networkidle").catch(() => undefined);
      }
      await expect(page.getByTestId(route.marker)).toBeVisible({
        timeout: route.path === "/ops" ? 30_000 : 15_000,
      });
      if (route.path === "/integrations") {
        await expect(page.getByTestId("integrations-protocol-visual")).toHaveCount(0);
        await expect(page.getByTestId("integrations-product-card-balanced")).toContainText(
          "SODAX",
        );
        await expect(page.getByTestId("integrations-product-card-aquarius")).toContainText(
          "Aquarius",
        );
      }
      await expectNoPageHorizontalOverflow(page);
      expect(await countViewportClippedControls(page)).toBe(0);
      await expectNoInternalSurfaceOverflow(page);
      expect(
        await hasHorizontalOverflow(page.getByTestId("product-canvas")),
      ).toBeFalsy();
    }
  }
});

test("discover surface filters curated and non-curated Arkas", async ({
  page,
}) => {
  await mockCatalogApi(page);

  await page.goto("/discover");

  await expect(
    page.getByRole("heading", { name: /^discover$/i }),
  ).toBeVisible();
  await expect(page.getByTestId("chrome-nav-discover")).toHaveClass(
    /chrome-rail-link-active/,
  );
  await expect(page.getByTestId("discover-fidelity-shell")).toHaveClass(
    /public-hero-safe-cutover/,
  );
  await expect(page.getByTestId("discover-command-board")).toHaveClass(
    /public-hero-board-cutover/,
  );
  await expect(page.getByTestId("discover-command-board")).toHaveClass(
    /discover-t03-first-fold/,
  );
  await expect(page.getByTestId("discover-stage-titlebar")).toHaveClass(
    /public-hero-titlebar-cutover/,
  );
  await expect(page.getByTestId("discover-stage-titlebar")).toHaveClass(
    /discover-t03-titlebar/,
  );
  await expect(page.getByTestId("discover-summary-grid")).toHaveClass(
    /public-hero-metric-deck-cutover/,
  );
  await expect(page.getByTestId("discover-public-metric-board")).toHaveClass(
    /discover-t03-metric-board/,
  );
  await expect(page.getByTestId("discover-public-collection-board")).toHaveClass(
    /discover-t03-collection-board/,
  );
  await expect(page.getByTestId("discover-figma-preview-grid")).toHaveClass(
    /public-hero-card-grid-cutover/,
  );
  await expect(page.getByTestId("discover-figma-preview-grid")).toHaveClass(
    /discover-t03-preview-grid/,
  );
  await expect(page.getByTestId("discover-stage-toolbar")).toHaveClass(
    /public-hero-toolbar-cutover/,
  );
  await expect(page.getByTestId("discover-stage-toolbar")).toHaveClass(
    /discover-t03-toolbar/,
  );
  const discoverHeroSafeZone = await page.evaluate(() => {
    const canvas = document.querySelector<HTMLElement>("[data-testid='product-canvas']");
    const titlebar = document.querySelector<HTMLElement>(
      "[data-testid='discover-stage-titlebar']",
    );
    const metrics = document.querySelector<HTMLElement>(
      "[data-testid='discover-summary-grid']",
    );
    const collection = document.querySelector<HTMLElement>(
      "[data-testid='discover-public-collection-board']",
    );
    const toolbar = document.querySelector<HTMLElement>(
      "[data-testid='discover-stage-toolbar']",
    );
    const actions = document.querySelector<HTMLElement>(".discover-stage-actions");
    const search = document.querySelector<HTMLElement>("[data-testid='discover-search-input']");
    const canvasRect = canvas?.getBoundingClientRect();
    const titleRect = titlebar?.getBoundingClientRect();
    const metricRect = metrics?.getBoundingClientRect();
    const collectionRect = collection?.getBoundingClientRect();
    const toolbarRect = toolbar?.getBoundingClientRect();
    const actionsRect = actions?.getBoundingClientRect();
    const searchRect = search?.getBoundingClientRect();
    const metricOverflow = Array.from(
      document.querySelectorAll<HTMLElement>(
        "[data-testid='discover-summary-grid'] .discover-stage-tile",
      ),
    ).map((card) => ({
      id: card.dataset.testid ?? "",
      overflowX: card.scrollWidth > card.clientWidth + 1,
      overflowY: card.scrollHeight > card.clientHeight + 1,
    }));
    return {
      titleInset: canvasRect && titleRect ? Math.round(titleRect.top - canvasRect.top) : -1,
      titleToMetricGap:
        titleRect && metricRect ? Math.round(metricRect.top - titleRect.bottom) : -1,
      metricToCollectionGap:
        metricRect && collectionRect ? Math.round(collectionRect.top - metricRect.bottom) : -1,
      toolbarInsideCollection:
        toolbarRect && collectionRect
          ? toolbarRect.left >= collectionRect.left &&
            toolbarRect.right <= collectionRect.right + 1 &&
            toolbarRect.top >= collectionRect.top &&
            toolbarRect.bottom <= collectionRect.bottom + 1
          : false,
      searchActionsOverlap:
        searchRect && actionsRect
          ? !(
              searchRect.right <= actionsRect.left ||
              searchRect.left >= actionsRect.right ||
              searchRect.bottom <= actionsRect.top ||
              searchRect.top >= actionsRect.bottom
            )
          : true,
      metricOverflow,
    };
  });
  expect(discoverHeroSafeZone.titleInset).toBeGreaterThanOrEqual(8);
  expect(discoverHeroSafeZone.titleToMetricGap).toBeGreaterThanOrEqual(0);
  expect(discoverHeroSafeZone.metricToCollectionGap).toBeGreaterThanOrEqual(8);
  expect(discoverHeroSafeZone.toolbarInsideCollection).toBeTruthy();
  expect(discoverHeroSafeZone.searchActionsOverlap).toBeFalsy();
  expect(discoverHeroSafeZone.metricOverflow).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ overflowX: false }),
    ]),
  );
  expect(
    discoverHeroSafeZone.metricOverflow.filter(
      (entry) => entry.overflowX || entry.overflowY,
    ),
  ).toEqual([]);
  await page.getByTestId("discover-curated-toggle").uncheck();
  await expect(page.getByTestId("discover-curated-toggle")).not.toBeChecked();
  await page.getByTestId("discover-search-input").fill("gamma");
  await expect(page.getByTestId("discover-figma-preview-grid")).toContainText(
    /CA7GAMMA|GCCGAMM/i,
  );
  await page.getByTestId("discover-market-curated").click();
  await expect(page.getByTestId("discover-market-curated")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  return;
  const discoverSectionGeometry = await page.evaluate(() => {
    const workspace = document.querySelector<HTMLElement>(
      "[data-testid='discover-section-workspace']",
    );
    const intro = document.querySelector<HTMLElement>(
      "[data-testid='discover-section-intro']",
    );
    const signals = document.querySelector<HTMLElement>(
      "[data-testid='discover-section-signal-grid']",
    );
    const commands = document.querySelector<HTMLElement>(
      "[data-testid='discover-section-command-deck']",
    );
    const cards = Array.from(
      document.querySelectorAll<HTMLElement>(".discover-section-signal"),
    );
    const workspaceRect = workspace?.getBoundingClientRect();
    const introRect = intro?.getBoundingClientRect();
    const signalsRect = signals?.getBoundingClientRect();
    const commandsRect = commands?.getBoundingClientRect();
    return {
      introInside:
        workspaceRect && introRect
          ? introRect.top >= workspaceRect.top && introRect.left >= workspaceRect.left
          : false,
      signalGap:
        introRect && signalsRect ? Math.round(signalsRect.top - introRect.bottom) : -1,
      commandGap:
        signalsRect && commandsRect
          ? Math.round(commandsRect.top - signalsRect.bottom)
          : -1,
      signalColumns: cards
        .map((card) => Math.round(card.getBoundingClientRect().top))
        .filter((top, index, values) => values.indexOf(top) === index).length,
      workspaceOverflow:
        workspace != null
          ? workspace.scrollWidth > workspace.clientWidth + 1 ||
            workspace.scrollHeight > workspace.clientHeight + 1
          : true,
    };
  });
  expect(discoverSectionGeometry.introInside).toBeTruthy();
  expect(discoverSectionGeometry.signalGap).toBeGreaterThanOrEqual(8);
  expect(discoverSectionGeometry.commandGap).toBeGreaterThanOrEqual(8);
  expect(discoverSectionGeometry.signalColumns).toBeLessThanOrEqual(2);
  expect(discoverSectionGeometry.workspaceOverflow).toBeFalsy();
  await expect(page.getByTestId("discover-featured-window-note")).toContainText(
    "Featured window:",
  );
  await expect(page.getByTestId("discover-figma-preview-card")).toHaveCount(3);
  await expect(page.getByTestId("discover-arkas-table")).toBeVisible();
  await expect(page.getByTestId("discover-arkas-panel")).toContainText(
    "CA7ALPHA",
  );
  await expect(page.getByTestId("discover-section-tabs")).toContainText(
    "Featured Arkas",
  );
  await expect(page.getByTestId("discover-section-tab-arkas")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByTestId("discover-section-intro")).toContainText(
    "Ranked Arka cards",
  );
  await expect(page.getByTestId("discover-section-signal-grid")).toContainText(
    "Visible Arkas",
  );
  await expect(page.getByTestId("discover-section-command-deck")).toContainText(
    "Active filter",
  );
  await expect(page.getByTestId("discover-command-board")).toContainText(
    "Arkas leaderboard",
  );
  await expect(page.getByTestId("discover-stage-metric-tvl")).toHaveCount(0);
  await expect(page.getByTestId("discover-stage-metric-nav")).toContainText(
    "TVL",
  );
  await expect(page.getByTestId("discover-stage-metric-nav")).toHaveClass(
    /public-figma-metric-card-nav/,
  );
  await expect(page.getByTestId("discover-stage-metric-nav")).toContainText(
    "TVL",
  );
  await expect
    .poll(() => hasHorizontalOverflow(page.getByTestId("discover-stage-metric-arkas")))
    .toBeFalsy();
  await expect
    .poll(() => hasHorizontalOverflow(page.getByTestId("discover-stage-metric-nav")))
    .toBeFalsy();
  await expect(page.getByTestId("discover-stage-metric-managers")).toContainText(
    "Managers",
  );
  await expect(page.getByTestId("discover-stage-metric-assets")).toContainText(
    "Assets",
  );
  await expect(page.getByTestId("discover-stage-metric-curated")).toContainText(
    "Curated",
  );
  await expect(page.getByTestId("discover-stage-metric-routes")).toContainText(
    "Allowed assets",
  );
  await expect(page.getByTestId("discover-stage-metric-routes")).toContainText(
    "current mandates",
  );
  await expect(page.getByTestId("discover-stage-metric-base")).toContainText(
    "Denominations",
  );
  await expect(page.getByTestId("discover-stage-metric-scope")).toContainText(
    "Scope",
  );
  await expect(page.getByTestId("discover-stage-metric-scope")).toContainText(
    "Curated",
  );
  await expect(page.getByTestId("discover-stage-metric-withdrawals")).toHaveCount(0);
  await expect(page.getByTestId("discover-stage-metric-deposits")).toHaveCount(0);
  await expect(page.getByTestId("discover-stage-metric-manager-fees")).toHaveCount(0);
  await expect(page.getByTestId("discover-stage-metric-profit")).toHaveCount(0);
  await expect(page.getByTestId("discover-stage-metric-protocol-fees")).toHaveCount(0);
  const scopeStatus = page
    .locator(".discover-stage-status .status-pill")
    .filter({ hasText: "Scope: Curated" })
    .first();
  await expect(scopeStatus).toBeVisible();
  await expect
    .poll(() => hasHorizontalOverflow(scopeStatus))
    .toBeFalsy();
  await expect(page.getByTestId("discover-section-command-route-link")).toHaveAttribute(
    "href",
    "/vaults",
  );
  await expect(page.getByTestId("discover-section-command-source-link")).toHaveAttribute(
    "href",
    "/status",
  );
  await expect(page.getByTestId("discover-feature-tabs")).toContainText(
    "Top ranked",
  );
  await expect(
    page.getByTestId("discover-feature-allocation").first(),
  ).toContainText("Current allocation");
  await expect(page.getByTestId("discover-feature-history-pending").first()).toContainText(
    "Chart available after next update",
  );
  await expect(page.locator("[data-testid='discover-feature-history-pending'] svg")).toHaveCount(
    0,
  );
  await expect(page.getByTestId("discover-arkas-table")).toContainText(
    "TVL",
  );
  await expect(page.getByTestId("discover-arkas-table")).not.toContainText(
    /\bAUM\b/,
  );

  await page.getByTestId("discover-section-tab-managers").click();
  await expect(
    page.getByTestId("discover-section-tab-managers"),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("discover-section-route")).toHaveAttribute(
    "href",
    "/managers",
  );
  await expect(page.getByTestId("discover-section-command-route-link")).toHaveAttribute(
    "href",
    "/managers",
  );
  await expect(page.getByTestId("discover-managers-panel")).toContainText(
    "Managers",
  );

  await page.getByTestId("discover-section-tab-assets").click();
  await expect(page.getByTestId("discover-section-tab-assets")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByTestId("discover-section-route")).toHaveAttribute(
    "href",
    "/assets",
  );
  await expect(page.getByTestId("discover-section-command-route-link")).toHaveAttribute(
    "href",
    "/assets",
  );
  await expect(page.getByTestId("discover-assets-panel")).toContainText(
    "Assets",
  );

  await page.getByTestId("discover-section-tab-arkas").click();

  await page.getByTestId("discover-feature-tab-profit").click();
  await expect(page.getByTestId("discover-feature-tab-profit")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByTestId("discover-arka-card").first()).toContainText(
    "CA7BETA",
  );

  await page.getByTestId("discover-search-input").fill("gamma");
  await page.getByTestId("discover-feature-tab-search").click();
  await expect(page.getByTestId("discover-feature-tab-search")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByTestId("discover-arkas-panel")).toContainText(
    "CA7GAMMA",
  );

  await page.getByTestId("discover-search-input").fill("");
  await page.getByTestId("discover-curated-toggle").click();
  await expect(page.getByTestId("discover-curated-toggle")).not.toBeChecked();
  await page.getByTestId("discover-search-input").fill("delta");
  await expect(page.getByTestId("discover-arkas-panel")).toContainText(
    "Delisted",
  );
});

test("catalog search inputs keep focus while typing across explorer surfaces", async ({
  page,
}) => {
  await mockCatalogApi(page);

  const cases = [
    {
      route: "/discover",
      input: "discover-search-input",
      query: "gamma",
      container: "discover-figma-preview-grid",
      expected: "CA7GAMMA",
    },
    {
      route: "/vaults",
      input: "vaults-search-input",
      query: "beta",
      container: "vaults-leaderboard-panel",
      expected: "CA7BETA",
    },
    {
      route: "/assets",
      input: "assets-search-input",
      query: "BLND",
      container: "assets-list-panel",
      expected: "BLND",
    },
    {
      route: "/managers",
      input: "managers-search-input",
      query: "beta",
      container: "managers-list-panel",
      expected: "GCBBETA",
    },
  ] as const;

  for (const current of cases) {
    await page.goto(current.route);
    const input = page.getByTestId(current.input);
    await expect(input).toBeVisible();
    await input.click();
    await input.type(current.query);
    await expect(input).toBeFocused();
    await expect(page.getByTestId(current.container)).toContainText(
      current.expected,
    );
  }
});

test("public product controls restore from URL and keep query state bookmarkable", async ({
  page,
}) => {
  await mockCatalogApi(page);

  await page.goto("/dashboard?feature=fresh");
  await expect(page.getByRole("heading", { name: /^dashboard$/i })).toBeVisible();
  await expect(page.getByTestId("dashboard-featured-tab-fresh")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByTestId("dashboard-featured-tab-curated").click();
  await expect(page).toHaveURL(/feature=curated/);

  await page.goto("/discover?q=gamma&curated=0&feature=search&section=assets");
  const discoverSearch = page.getByTestId("discover-search-input");
  await expect(discoverSearch).toHaveValue("gamma");
  await expect(page.getByTestId("discover-feature-tab-search")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await discoverSearch.click();
  await discoverSearch.type("x");
  await expect(discoverSearch).toBeFocused();
  await expect(page).toHaveURL(/q=gammax/);
  await expect(page).toHaveURL(/curated=0/);

  await page.goto("/arkas?q=beta&curated=0&sort=profit&feature=volume&window=latest");
  const vaultSearch = page.getByTestId("vaults-search-input");
  await expect(vaultSearch).toHaveValue("beta");
  await expect(page.getByTestId("vaults-sort-metric")).toHaveValue("profit");
  await expect(page.getByTestId("vaults-featured-tab-volume")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByTestId("vaults-window-latest")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await vaultSearch.click();
  await vaultSearch.type("x");
  await expect(vaultSearch).toBeFocused();
  await expect(page).toHaveURL(/q=betax/);
  await page.getByTestId("vaults-window-all").click();
  await expect(page).not.toHaveURL(/window=/);

  await page.goto("/assets?q=BLND&spotlight=balanceSheet");
  const assetSearch = page.getByTestId("assets-search-input");
  await expect(assetSearch).toHaveValue("BLND");
  await expect(
    page.getByTestId("assets-spotlight-tab-balance-sheet"),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("assets-list-panel")).toContainText(
    /BLND|CBLNDASSET/i,
  );
  await assetSearch.click();
  await assetSearch.type("x");
  await expect(assetSearch).toBeFocused();
  await expect(page).toHaveURL(/q=BLNDx/);
  await expect(page).toHaveURL(/spotlight=balanceSheet/);

  await page.goto("/managers?q=beta&spotlight=curated&sort=arkas&order=asc");
  const managerSearch = page.getByTestId("managers-search-input");
  await expect(managerSearch).toHaveValue("beta");
  await expect(
    page.getByTestId("managers-spotlight-tab-curated"),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("managers-sort-metric")).toHaveValue("arkas");
  await expect(page.getByTestId("managers-sort-order")).toHaveValue("asc");
  await expect(page.getByTestId("managers-list-panel")).toContainText(
    "sorted by Arka count",
  );
  await managerSearch.click();
  await managerSearch.type("x");
  await expect(managerSearch).toBeFocused();
  await expect(page).toHaveURL(/q=betax/);
  await expect(page).toHaveURL(/spotlight=curated/);
  await expect(page).toHaveURL(/sort=arkas/);
  await expect(page).toHaveURL(/order=asc/);
});

test("product explorer controls mutate live ranked data instead of acting as decorative labels", async ({
  page,
}) => {
  await mockCatalogApi(page);

  await page.goto("/vaults");
  await expect(
    page.getByRole("heading", { name: /arkas leaderboard/i }),
  ).toBeVisible();

  await page.getByTestId("vaults-sort-metric").selectOption("profit");
  await expect(page.getByTestId("vaults-sort-metric")).toHaveValue("profit");
  await expect(
    page.getByTestId("vault-leaderboard-card").first(),
  ).toContainText("CA7BETA");
  await expect(
    page.getByTestId("vault-leaderboard-card").first(),
  ).toContainText("P/L");

  await page.getByTestId("vaults-sort-metric").selectOption("volume");
  await expect(page.getByTestId("vaults-sort-metric")).toHaveValue("volume");
  await expect(
    page.getByTestId("vault-leaderboard-card").first(),
  ).toContainText("CA7ALPHA");
  await expect(
    page.getByTestId("vault-leaderboard-card").first(),
  ).toContainText("Volume");

  await page.getByTestId("vaults-window-latest").click();
  await expect(page.getByTestId("vaults-window-latest")).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await page.getByTestId("vaults-window-all").click();
  await expect(page.getByTestId("vaults-window-all")).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await page.getByTestId("vaults-featured-tab-profit").click();
  await expect(page.getByTestId("vaults-featured-tab-profit")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page).toHaveURL(/feature=profit/);

  await page.getByTestId("vaults-featured-tab-volume").click();
  await expect(page.getByTestId("vaults-featured-tab-volume")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page).toHaveURL(/feature=volume/);

  await page.goto("/assets");
  await expect(page.getByRole("heading", { name: /^assets$/i })).toBeVisible();
  await page.getByTestId("assets-spotlight-tab-balance-sheet").click();
  await expect(
    page.getByTestId("assets-spotlight-tab-balance-sheet"),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("asset-card").first()).toContainText(
    /BLND|CBLNDASSET/i,
  );

  await page.getByTestId("assets-search-input").fill("USDC");
  await page.getByTestId("assets-spotlight-tab-search").click();
  await expect(page.getByTestId("assets-spotlight-tab-search")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByTestId("assets-list-panel")).toContainText(
    /USDC|CDENOMUS/i,
  );

  await page.goto("/managers");
  await expect(
    page.getByRole("heading", { name: /managers leaderboard/i }),
  ).toBeVisible();
  await page.getByTestId("managers-sort-metric").selectOption("arkas");
  await expect(page.getByTestId("managers-list-panel")).toContainText(
    "sorted by Arka count",
  );

  await page.getByTestId("managers-spotlight-tab-curated").click();
  await expect(
    page.getByTestId("managers-spotlight-tab-curated"),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("manager-card").first()).toBeVisible();
});

test("assets and managers preserve visual rhythm between search, cards and tables", async ({
  page,
}) => {
  await mockCatalogApi(page);
  await page.setViewportSize({ width: 1920, height: 1080 });

  await page.goto("/assets");
  await expect(page.getByRole("heading", { name: /^assets$/i })).toBeVisible();
  await expect(page.getByTestId("assets-list-panel")).toBeVisible();
  await expect(page.getByTestId("assets-list")).toContainText(/XTAR|USDC|BLND/i);
  const assetsSearchGap = await readVerticalGapPx(
    page.getByTestId("assets-search-input"),
    page.getByTestId("assets-spotlight-tabs"),
  );
  expect(assetsSearchGap).toBeGreaterThanOrEqual(8);
  expect(
    await readWidthPx(page.getByTestId("assets-search-input")),
  ).toBeGreaterThanOrEqual(220);
  await expect(page.getByTestId("asset-card").first()).toBeVisible();
  await expect
    .poll(() => hasHorizontalOverflow(page.getByTestId("assets-list-panel")))
    .toBeFalsy();
  await expect(page.getByTestId("assets-hero-aside")).toContainText(
    "TVL",
  );
  await expect(page.getByTestId("assets-hero-aside")).not.toContainText(
    /\b\d+(?:\.\d)?B\b|Managed footprint|AUM/i,
  );

  await page.goto("/managers");
  await expect(
    page.getByRole("heading", { name: /managers leaderboard/i }),
  ).toBeVisible();
  await expect(page.getByTestId("managers-list-panel")).not.toContainText(
    "Search narrows the manager set",
  );
  await expect(page.getByTestId("managers-filter-deck")).toHaveClass(
    /managers-filter-deck-cutover/,
  );
  await expect(page.getByTestId("managers-filter-status-row")).toHaveCount(0);
  await expect(page.getByTestId("managers-list-panel")).toContainText(
    "Search and compare managers",
  );
  const managersSearchGap = await readVerticalGapPx(
    page.getByTestId("managers-search-input"),
    page.getByTestId("managers-spotlight-tabs"),
  );
  expect(managersSearchGap).toBeGreaterThanOrEqual(8);
  expect(
    await readWidthPx(page.getByTestId("managers-search-input")),
  ).toBeGreaterThanOrEqual(220);
  expect(
    await readTopDeltaPx(
      page.getByTestId("managers-search-input"),
      page.getByTestId("managers-sort-metric"),
    ),
  ).toBeLessThanOrEqual(4);
  expect(
    await readTopDeltaPx(
      page.getByTestId("managers-search-input"),
      page.getByTestId("managers-sort-order"),
    ),
  ).toBeLessThanOrEqual(4);
  const managerToolbarAlignment = await page.evaluate(() => {
    const toolbar = document.querySelector(".managers-command-toolbar");
    const searchField = toolbar?.querySelector(".discover-search-field");
    const sortFields = toolbar
      ? Array.from(toolbar.querySelectorAll(".managers-sort-field"))
      : [];
    if (!toolbar || !searchField || sortFields.length < 2) {
      throw new Error("Manager toolbar fields are not measurable.");
    }
    const searchLabel = searchField.querySelector(".surface-list-label");
    const rankLabel = sortFields[0]?.querySelector(".surface-list-label");
    const orderLabel = sortFields[1]?.querySelector(".surface-list-label");
    const searchInput = searchField.querySelector("input");
    const rankSelect = sortFields[0]?.querySelector("select");
    const orderSelect = sortFields[1]?.querySelector("select");
    if (
      !searchLabel ||
      !rankLabel ||
      !orderLabel ||
      !searchInput ||
      !rankSelect ||
      !orderSelect
    ) {
      throw new Error("Manager toolbar labels or controls are not measurable.");
    }
    const rect = (element: Element) => element.getBoundingClientRect();
    const searchLabelTop = rect(searchLabel).top;
    const searchInputTop = rect(searchInput).top;
    const primaryRow = document.querySelector(
      '[data-testid="managers-filter-primary-row"]',
    );
    if (!primaryRow) {
      throw new Error("Manager filter primary row is not measurable.");
    }
    const primaryRowBottom = rect(primaryRow).bottom;
    return {
      primaryRowBottomOverflow: Math.max(
        0,
        ...[searchInput, rankSelect, orderSelect].map(
          (control) => rect(control).bottom - primaryRowBottom,
        ),
      ),
      rankLabelTopDelta: Math.abs(searchLabelTop - rect(rankLabel).top),
      orderLabelTopDelta: Math.abs(searchLabelTop - rect(orderLabel).top),
      rankControlTopDelta: Math.abs(searchInputTop - rect(rankSelect).top),
      orderControlTopDelta: Math.abs(searchInputTop - rect(orderSelect).top),
      rankControlHeightDelta: Math.abs(
        rect(searchInput).height - rect(rankSelect).height,
      ),
      orderControlHeightDelta: Math.abs(
        rect(searchInput).height - rect(orderSelect).height,
      ),
      searchControlHeight: rect(searchInput).height,
      rankControlHeight: rect(rankSelect).height,
      orderControlHeight: rect(orderSelect).height,
    };
  });
  expect(managerToolbarAlignment.primaryRowBottomOverflow).toBeLessThanOrEqual(1);
  expect(managerToolbarAlignment.rankLabelTopDelta).toBeLessThanOrEqual(2);
  expect(managerToolbarAlignment.orderLabelTopDelta).toBeLessThanOrEqual(2);
  expect(managerToolbarAlignment.rankControlTopDelta).toBeLessThanOrEqual(2);
  expect(managerToolbarAlignment.orderControlTopDelta).toBeLessThanOrEqual(2);
  expect(managerToolbarAlignment.rankControlHeightDelta).toBeLessThanOrEqual(2);
  expect(managerToolbarAlignment.orderControlHeightDelta).toBeLessThanOrEqual(2);
  expect(managerToolbarAlignment.searchControlHeight).toBeLessThanOrEqual(54);
  expect(managerToolbarAlignment.rankControlHeight).toBeLessThanOrEqual(54);
  expect(managerToolbarAlignment.orderControlHeight).toBeLessThanOrEqual(54);
  await expect(page.getByTestId("manager-card").first()).toBeVisible();
  await expect
    .poll(() => hasHorizontalOverflow(page.getByTestId("managers-list-panel")))
    .toBeFalsy();
  return;

  const managerRowContainment = await page.evaluate(() => {
    const panel = document.querySelector('[data-testid="managers-list-panel"]');
    const table = document.querySelector(
      '[data-testid="managers-leaderboard-table"]',
    );
    const rows = Array.from(
      document.querySelectorAll('[data-testid="manager-table-row"]'),
    ).slice(0, 6);
    if (!panel || !table || rows.length === 0) {
      throw new Error("Manager leaderboard rows are not measurable.");
    }
    const panelRect = panel.getBoundingClientRect();
    const tableRect = table.getBoundingClientRect();
    return rows.map((row) => {
      const rowRect = row.getBoundingClientRect();
      const descendants = Array.from(
        row.querySelectorAll(
          'a, button, strong, span, .status-pill, .manager-row-progress-track',
        ),
      );
      const descendantOverflowRight = Math.max(
        0,
        ...descendants.map(
          (descendant) =>
            descendant.getBoundingClientRect().right - rowRect.right,
        ),
      );
      const descendantOverflowLeft = Math.max(
        0,
        ...descendants.map(
          (descendant) =>
            rowRect.left - descendant.getBoundingClientRect().left,
        ),
      );
      const freshnessCell = row
        .querySelectorAll(".surface-table-cell")
        .item(6);
      const actionCell = row.querySelector(".surface-table-actions");
      return {
        rowOverflowRight: rowRect.right - tableRect.right,
        rowPanelOverflowRight: rowRect.right - panelRect.right,
        descendantOverflowRight,
        descendantOverflowLeft,
        freshnessOverflowRight: freshnessCell
          ? freshnessCell.getBoundingClientRect().right - rowRect.right
          : 0,
        actionOverflowRight: actionCell
          ? actionCell.getBoundingClientRect().right - rowRect.right
          : 0,
      };
    });
  });

  for (const row of managerRowContainment) {
    expect(row.rowOverflowRight).toBeLessThanOrEqual(1);
    expect(row.rowPanelOverflowRight).toBeLessThanOrEqual(1);
    expect(row.descendantOverflowRight).toBeLessThanOrEqual(1);
    expect(row.descendantOverflowLeft).toBeLessThanOrEqual(1);
    expect(row.freshnessOverflowRight).toBeLessThanOrEqual(1);
    expect(row.actionOverflowRight).toBeLessThanOrEqual(1);
  }
  await expect(page.getByTestId("manager-table-row").first()).toHaveAttribute(
    "data-row-containment",
    "bounded",
  );
  await expect(page.getByTestId("manager-row-id").first()).toHaveAttribute(
    "title",
    /GC/,
  );
  await expect(page.getByTestId("manager-row-actions").first()).toBeVisible();
});

test("vaults leaderboard keeps filters, pills and rows separated with no overlap", async ({
  page,
}) => {
  await mockCatalogApi(page);
  await page.setViewportSize({ width: 1920, height: 1080 });

  await page.goto("/vaults");
  await expect(
    page.getByRole("heading", { name: /arkas leaderboard/i }),
  ).toBeVisible();

  const toolbar = page.getByTestId("vaults-listing-toolbar");
  const sortControls = page.getByTestId("vaults-sort-controls");
  const windowStrip = page.getByTestId("vaults-window-strip");
  const searchInput = page.getByTestId("vaults-search-input");
  const windowToToolbarGap = await readVerticalGapPx(windowStrip, toolbar);
  expect(windowToToolbarGap).toBeGreaterThanOrEqual(6);
  expect(await readWidthPx(searchInput)).toBeGreaterThanOrEqual(240);
  expect(
    await readTopDeltaPx(searchInput, sortControls),
  ).toBeGreaterThanOrEqual(4);

  const firstRow = page.getByTestId("vault-leaderboard-card").first();
  const firstRowCells = firstRow.locator(".surface-table-cell");
  expect(await readHeightPx(firstRow)).toBeGreaterThanOrEqual(96);
  expect(
    await readTopDeltaPx(firstRowCells.nth(0), firstRowCells.nth(1)),
  ).toBeLessThanOrEqual(2);
  expect(
    await hasHorizontalOverflow(page.getByTestId("vaults-leaderboard-panel")),
  ).toBeFalsy();
  await expect(firstRow).toHaveAttribute("data-row-containment", "bounded");
  await expect(page.getByTestId("vault-row-arka-id").first()).toHaveAttribute(
    "title",
    /CA/,
  );
  await expect(page.getByTestId("vault-row-actions").first()).toBeVisible();

  const rowContainment = await page.evaluate(() => {
    const panel = document.querySelector(
      '[data-testid="vaults-leaderboard-panel"]',
    );
    const table = document.querySelector(
      '[data-testid="vaults-leaderboard-table"]',
    );
    const rows = Array.from(
      document.querySelectorAll('[data-testid="vault-leaderboard-card"]'),
    ).slice(0, 6);
    if (!panel || !table || rows.length === 0) {
      throw new Error("Vault leaderboard rows are not measurable.");
    }
    const panelRect = panel.getBoundingClientRect();
    const tableRect = table.getBoundingClientRect();
    return rows.map((row) => {
      const rowRect = row.getBoundingClientRect();
      const descendants = Array.from(
        row.querySelectorAll(
          'a, button, strong, span, [data-testid="vault-base-asset-cell"], .vault-row-progress-track',
        ),
      );
      const descendantOverflowRight = Math.max(
        0,
        ...descendants.map(
          (descendant) =>
            descendant.getBoundingClientRect().right - rowRect.right,
        ),
      );
      const descendantOverflowLeft = Math.max(
        0,
        ...descendants.map(
          (descendant) =>
            rowRect.left - descendant.getBoundingClientRect().left,
        ),
      );
      const baseSleeve = row.querySelector(
        '[data-testid="vault-base-asset-cell"]',
      );
      const actions = row.querySelector(".vault-row-links");
      return {
        rowOverflowRight: rowRect.right - tableRect.right,
        rowPanelOverflowRight: rowRect.right - panelRect.right,
        descendantOverflowRight,
        descendantOverflowLeft,
        baseOverflowRight: baseSleeve
          ? baseSleeve.getBoundingClientRect().right - rowRect.right
          : 0,
        actionsOverflowRight: actions
          ? actions.getBoundingClientRect().right - rowRect.right
          : 0,
      };
    });
  });

  for (const row of rowContainment) {
    expect(row.rowOverflowRight).toBeLessThanOrEqual(2);
    expect(row.rowPanelOverflowRight).toBeLessThanOrEqual(2);
    expect(row.descendantOverflowRight).toBeLessThanOrEqual(2);
    expect(row.descendantOverflowLeft).toBeLessThanOrEqual(2);
    expect(row.baseOverflowRight).toBeLessThanOrEqual(2);
    expect(row.actionsOverflowRight).toBeLessThanOrEqual(2);
  }
});

test("discover, assets and managers stay responsive without horizontal overflow on mobile", async ({
  page,
}) => {
  await mockCatalogApi(page);
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto("/discover");
  await expect(
    page.getByRole("heading", { name: /^discover$/i }),
  ).toBeVisible();
  expect(
    await hasHorizontalOverflow(page.getByTestId("discover-public-collection-board")),
  ).toBeFalsy();

  await page.goto("/assets");
  await expect(page.getByRole("heading", { name: /^assets$/i })).toBeVisible();
  expect(
    await hasHorizontalOverflow(page.getByTestId("assets-list-panel")),
  ).toBeFalsy();
  await expect(page.getByTestId("asset-card").first()).toBeVisible();

  await page.goto("/managers");
  await expect(
    page.getByRole("heading", { name: /managers leaderboard/i }),
  ).toBeVisible();
  expect(
    await hasHorizontalOverflow(page.getByTestId("managers-list-panel")),
  ).toBeFalsy();
  await expect(page.getByTestId("manager-card").first()).toBeVisible();

  await page.goto("/vaults");
  await expect(
    page.getByRole("heading", { name: /arkas leaderboard/i }),
  ).toBeVisible();
  expect(
    await hasHorizontalOverflow(page.getByTestId("vaults-leaderboard-panel")),
  ).toBeFalsy();
});

test("public Create Arka CTAs open the single wizard with source context", async ({
  page,
}) => {
  await mockCatalogApi(page);

  const cases = [
    {
      route: "/dashboard",
      testId: "chrome-create-primary",
      expectedFrom: "/dashboard",
    },
    {
      route: "/discover?q=gamma",
      testId: "chrome-create-primary",
      expectedFrom: "/discover",
    },
    {
      route: "/arkas?q=beta",
      testId: "chrome-create-primary",
      expectedFrom: "/arkas",
    },
    {
      route: "/arkas",
      testId: "chrome-create-primary",
      expectedFrom: "/arkas",
    },
  ];

  for (const testCase of cases) {
    await page.goto(testCase.route);
    await page.waitForLoadState("domcontentloaded");
    await expect(page.getByTestId(testCase.testId)).toBeVisible();
    await page.getByTestId(testCase.testId).click();
    await expect(page).toHaveURL(/\/factory\/create/);

    const createUrl = new URL(page.url());
    expect(createUrl.pathname).toBe("/factory/create");
    expect(createUrl.searchParams.get("from")).toBe(testCase.expectedFrom);
  }
});

test("pixel-tight closure keeps public and operator surfaces readable without clipped UI", async ({
  page,
}) => {
  await mockCatalogApi(page);
  await page.setViewportSize({ width: 1366, height: 900 });

  for (const route of [
    "/dashboard",
    "/discover",
    "/vaults",
    "/assets",
    "/managers",
    "/factory/create",
  ]) {
    await page.goto(route);
    await page.waitForLoadState("domcontentloaded");
    await expect(page.getByTestId("product-canvas")).toBeVisible();
    await expectPixelTightSurface(page);
  }

  await enableOperatorMode(page);
  for (const route of [
    "/governance",
    "/integrations/operator",
    "/coverage",
    "/settings",
    "/status",
    "/contracts",
    "/migrations",
    "/ops",
    "/tiers",
  ]) {
    await page.goto(route);
    await page.waitForLoadState("domcontentloaded");
    await expect(page.getByTestId("product-canvas")).toBeVisible();
    await expect(page.getByTestId("operator-route-gate")).toHaveCount(0);
    await expectPixelTightSurface(page);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of [
    "/dashboard",
    "/discover",
    "/vaults",
    "/assets",
    "/managers",
  ]) {
    await page.goto(route);
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("product-canvas")).toBeVisible();
    await expectPixelTightSurface(page);
  }
});

test("discover surfaces Soroban catalog fallback failures without reporting a private catalog 401", async ({
  page,
}) => {
  await page.route("**/api/catalog/**", async (route) => {
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      headers: {
        "x-arkafund-catalog-upstream-status": "401",
        "x-arkafund-catalog-fallback-status": "503",
      },
      body: JSON.stringify({
        error: "catalog_onchain_fallback_failed",
        message: "Unable to read Arka registry from Soroban.",
      }),
    });
  });

  await page.goto("/discover");

  await expect(page.getByTestId("discover-error")).toContainText(
    "Discovery unavailable",
  );
  await expect(page.getByTestId("discover-error")).toContainText(
    "Unable to read Arka registry from Soroban.",
  );
  await expect(page.getByTestId("discover-catalog-offline")).toHaveCount(0);
  await expect(page.getByTestId("discover-error")).not.toContainText(
    "status 401",
  );
});

test("public surfaces explain catalog configuration as catalog plus Soroban fallback", async ({
  page,
}) => {
  const configFailure = {
    error: "catalog_not_configured",
    message: "Set CATALOG_API_BASE_URL or NEXT_PUBLIC_CATALOG_API_BASE_URL.",
  };
  await page.route("**/api/catalog/**", async (route) => {
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify(configFailure),
    });
  });
  await page.route("**/api/leaderboard/arkas**", async (route) => {
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify(configFailure),
    });
  });
  await page.route("**/api/leaderboard/managers**", async (route) => {
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify(configFailure),
    });
  });
  await page.route("**/api/assets/core-registry", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        generatedAt: "2026-04-25T18:00:00.000Z",
        items: [],
      }),
    });
  });

  const cases = [
    {
      route: "/dashboard",
      testId: "dashboard-catalog-offline",
      title: "Dashboard data is not available",
    },
    {
      route: "/discover",
      testId: "discover-catalog-offline",
      title: "Discovery data is not available",
    },
    {
      route: "/vaults",
      testId: "vaults-catalog-offline",
      title: "Arka leaderboard data is not available",
    },
    {
      route: "/assets",
      testId: "assets-catalog-offline",
      title: "Asset explorer data is not available",
    },
    {
      route: "/managers",
      testId: "managers-catalog-offline",
      title: "Manager explorer data is not available",
    },
  ];

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1366, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    for (const entry of cases) {
      await page.goto(entry.route);
      const offlineState = page.getByTestId(entry.testId);
      await expect(offlineState).toContainText(entry.title);
      await expect(offlineState).toContainText(
        "could not be loaded right now",
      );
      await expect(offlineState).not.toContainText("CATALOG_API_BASE_URL");
      await expectNoPageHorizontalOverflow(page);
      expect(await countViewportClippedControls(page)).toBe(0);

      await offlineState.getByRole("button", { name: /retry/i }).click();
      await expect(offlineState).toContainText(entry.title);
      await expectNoPageHorizontalOverflow(page);
      expect(await countViewportClippedControls(page)).toBe(0);
    }
  }
});

test("advanced console pages avoid clipped controls and horizontal overflow", async ({
  page,
}) => {
  await enableOperatorMode(page);
  const routes = [
    "/governance",
    "/integrations/operator",
    "/coverage",
    "/settings",
    "/status",
    "/contracts",
    "/migrations",
    "/ops",
    "/tiers",
  ];

  for (const width of [1366, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of routes) {
      await page.goto(route);
      const toggle = page.getByTestId("advanced-console-toggle");
      if (await toggle.isVisible()) {
        if ((await toggle.getAttribute("aria-expanded")) !== "true") {
          await toggle.click();
        }
        await expect(toggle).toHaveAttribute("aria-expanded", "true");
      }
      await expectNoPageHorizontalOverflow(page);
      expect(await countViewportClippedControls(page)).toBe(0);
      await expectNoInternalSurfaceOverflow(page);
    }
  }
});
