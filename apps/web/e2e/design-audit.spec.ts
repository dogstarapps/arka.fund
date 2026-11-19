import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
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

type FigmaAuditCapture = {
  key: string;
  title: string;
  route: string;
  currentFile: string;
  manualFile?: string;
  fullPage?: boolean;
  requiresOperator?: boolean;
};

type FigmaAuditManifest = {
  currentRoot: string;
  manualRoot: string;
  defaultViewport: {
    width: number;
    height: number;
  };
  captures: FigmaAuditCapture[];
};

const manifestPath = resolve(process.cwd(), "docs/figma-route-audit-manifest.json");
const manifest = JSON.parse(
  readFileSync(manifestPath, "utf8"),
) as FigmaAuditManifest;
const auditDir = resolve(process.cwd(), manifest.currentRoot);
const manualDir = resolve(process.cwd(), manifest.manualRoot);

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

async function expectNoPageHorizontalOverflow(page: Page, capture: FigmaAuditCapture) {
  const report = await page.evaluate(() => {
    const overflow = document.documentElement.scrollWidth - window.innerWidth;
    const offenders = Array.from(document.querySelectorAll<HTMLElement>("body *"))
      .map((element) => {
        const box = element.getBoundingClientRect();
        return {
          tag: element.tagName.toLowerCase(),
          testId: element.getAttribute("data-testid") ?? "",
          className: element.getAttribute("class") ?? "",
          left: Math.round(box.left),
          right: Math.round(box.right),
          width: Math.round(box.width),
          scrollWidth: element.scrollWidth,
          clientWidth: element.clientWidth,
        };
      })
      .filter(
        (entry) =>
          entry.width > 0 &&
          (entry.left < -1 ||
            entry.right > window.innerWidth + 1 ||
            entry.scrollWidth > entry.clientWidth + 1),
      )
      .slice(0, 8);

    return {
      ok: overflow <= 1,
      overflow,
      viewport: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      offenders,
    };
  });

  expect(
    report.ok,
    `${capture.key} must not create horizontal page overflow:\n${JSON.stringify(report, null, 2)}`,
  ).toBe(true);
}

async function expectNoViewportClippedControls(page: Page, capture: FigmaAuditCapture) {
  const clippedControls = await page.evaluate(() =>
    Array.from(
      document.querySelectorAll<HTMLElement>(
        'a, button, input, select, textarea, [role="button"]',
      ),
    )
      .filter((element) => {
        const style = window.getComputedStyle(element);
        if (style.display === "none" || style.visibility === "hidden") return false;
        const box = element.getBoundingClientRect();
        if (box.width <= 0 || box.height <= 0) return false;
        return box.left < -1 || box.right > window.innerWidth + 1;
      })
      .map((element) => {
        const box = element.getBoundingClientRect();
        return {
          tag: element.tagName.toLowerCase(),
          testId: element.getAttribute("data-testid") ?? "",
          text: (element.textContent ?? "").trim().slice(0, 80),
          left: Math.round(box.left),
          right: Math.round(box.right),
          viewport: window.innerWidth,
        };
      }),
  );

  expect(
    clippedControls,
    `${capture.key} must not clip visible controls at the viewport edge`,
  ).toEqual([]);
}

async function expectNoBrokenSingleWordLabels(page: Page, capture: FigmaAuditCapture) {
  const audit = await page.evaluate(() => {
    const statusPillStyleViolations = Array.from(
      document.querySelectorAll<HTMLElement>(".status-pill"),
    )
      .filter((element) => {
        const style = window.getComputedStyle(element);
        if (style.display === "none" || style.visibility === "hidden") return false;
        const text = (element.textContent ?? "").trim();
        if (!/^[A-Za-z0-9%./:-]{4,18}$/.test(text)) return false;
        return style.overflowWrap === "anywhere" || style.wordBreak === "break-all";
      })
      .map((element) => {
        const style = window.getComputedStyle(element);
        return {
          text: (element.textContent ?? "").trim(),
          testId: element.getAttribute("data-testid") ?? "",
          className: element.getAttribute("class") ?? "",
          whiteSpace: style.whiteSpace,
          overflowWrap: style.overflowWrap,
          wordBreak: style.wordBreak,
        };
      });

    const selectors = [
      ".workflow-signal-value",
      ".surface-signal-value",
      ".surface-tab > span",
      ".surface-table-link",
      ".surface-button",
    ].join(", ");

    const brokenInlineLabels = Array.from(document.querySelectorAll<HTMLElement>(selectors))
      .filter((element) => {
        const style = window.getComputedStyle(element);
        if (style.display === "none" || style.visibility === "hidden") return false;
        const box = element.getBoundingClientRect();
        if (box.width <= 0 || box.height <= 0) return false;

        const text = (element.textContent ?? "").trim();
        if (!/^[A-Za-z0-9%./:-]{4,18}$/.test(text)) return false;

        const range = document.createRange();
        range.selectNodeContents(element);
        const lineCount = Array.from(range.getClientRects()).filter(
          (rect) => rect.width > 1 && rect.height > 1,
        ).length;
        range.detach();
        return lineCount > 1;
      })
      .map((element) => {
        const range = document.createRange();
        range.selectNodeContents(element);
        const lineCount = Array.from(range.getClientRects()).filter(
          (rect) => rect.width > 1 && rect.height > 1,
        ).length;
        range.detach();
        return {
          text: (element.textContent ?? "").trim(),
          testId: element.getAttribute("data-testid") ?? "",
          className: element.getAttribute("class") ?? "",
          lineCount,
        };
      });

    return { brokenInlineLabels, statusPillStyleViolations };
  });

  expect(
    audit.statusPillStyleViolations,
    `${capture.key} status pills must keep compact labels non-breaking`,
  ).toEqual([]);
  expect(
    audit.brokenInlineLabels,
    `${capture.key} must not split compact labels/status words across multiple visual lines`,
  ).toEqual([]);
}

async function captureRoute(page: Page, capture: FigmaAuditCapture) {
  await page.goto(capture.route, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("load", { timeout: 15_000 }).catch(() => undefined);
  await page
    .waitForLoadState("networkidle", { timeout: 15_000 })
    .catch(() => undefined);
  await expect(
    page.getByText(/^Loading /),
    `${capture.key} must resolve real route data before visual capture`,
  ).toHaveCount(0, { timeout: 30_000 });
  await page.waitForTimeout(500);
  await expect(
    page.getByTestId("operator-route-gate"),
    `${capture.key} must not capture the operator gate instead of the intended route`,
  ).toHaveCount(0);
  await expectNoPageHorizontalOverflow(page, capture);
  await expectNoViewportClippedControls(page, capture);
  await expectNoBrokenSingleWordLabels(page, capture);
  const screenshot = await page.screenshot({ fullPage: capture.fullPage ?? false });
  writeFileSync(resolve(auditDir, capture.currentFile), screenshot);
  writeFileSync(resolve(manualDir, capture.manualFile ?? capture.currentFile), screenshot);
}

test.describe.configure({ mode: "serial" });
// The audit captures every public/operator route at full fidelity. Keep this
// timeout aligned with the actual 20+ screenshot workload rather than the
// single-page Playwright default, otherwise the pixel gate becomes flaky.
test.setTimeout(900_000);

test("captures current product screenshots for design audit", async ({ page }) => {
  rmSync(auditDir, { recursive: true, force: true });
  mkdirSync(auditDir, { recursive: true });
  mkdirSync(manualDir, { recursive: true });

  await page.setViewportSize(manifest.defaultViewport);
  await mockCatalogApi(page);
  let operatorModeEnabled = false;
  const orderedCaptures = [...manifest.captures].sort(
    (left, right) =>
      Number(Boolean(left.requiresOperator)) -
      Number(Boolean(right.requiresOperator)),
  );
  for (const capture of orderedCaptures) {
    if (capture.requiresOperator && !operatorModeEnabled) {
      await enableOperatorMode(page);
      operatorModeEnabled = true;
    }
    await captureRoute(page, capture);
  }

  await expect(page.getByRole("heading").first()).toBeVisible();
});
