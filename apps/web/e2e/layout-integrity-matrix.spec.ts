import { expect, test, type Page } from "@playwright/test";
import { resolveCatalogFixture } from "../src/lib/catalog/testFixtures";
import {
  LAYOUT_INTEGRITY_BREAKPOINTS,
  LAYOUT_INTEGRITY_ROUTES,
  type LayoutIntegrityBreakpoint,
  type LayoutIntegrityRoute,
} from "../src/lib/qa/layoutIntegrityMatrix";
import { enableOperatorMode } from "./helpers/operator-mode";

type LayoutOffender = {
  tag: string;
  testId: string;
  className: string;
  text: string;
  left?: number;
  right?: number;
  top?: number;
  bottom?: number;
  width?: number;
  height?: number;
  lineCount?: number;
  elementWidth?: number;
  containerWidth?: number;
  scrollWidth?: number;
  clientWidth?: number;
};

type LayoutIntegrityReport = {
  route: string;
  breakpoint: string;
  viewport: number;
  scrollWidth: number;
  pageOverflow: number;
  pageOverflowOffenders: LayoutOffender[];
  viewportClippedControls: LayoutOffender[];
  containerEscapingControls: LayoutOffender[];
  clippedTextControls: LayoutOffender[];
  skinnyMicrocopy: LayoutOffender[];
};

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

async function openRoute(page: Page, route: LayoutIntegrityRoute) {
  await page.goto(route.path, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 20_000 });
  await expect(
    page.getByTestId("operator-route-gate"),
    `${route.key} must render its surface, not the operator access gate`,
  ).toHaveCount(0);
  await page.waitForTimeout(180);
}

async function auditLayoutIntegrity(
  page: Page,
  route: LayoutIntegrityRoute,
  breakpoint: LayoutIntegrityBreakpoint,
) {
  const report = await page.evaluate(
    ({ routeKey, breakpointKey }) => {
      const visible = (element: HTMLElement) => {
        const style = window.getComputedStyle(element);
        const box = element.getBoundingClientRect();
        return (
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          Number(style.opacity) !== 0 &&
          box.width > 0 &&
          box.height > 0
        );
      };

      const textOf = (element: HTMLElement) => (element.textContent ?? "").trim().slice(0, 120);
      const classOf = (element: HTMLElement) => element.getAttribute("class") ?? "";
      const testIdOf = (element: HTMLElement) => element.getAttribute("data-testid") ?? "";
      const boxOf = (element: HTMLElement) => {
        const box = element.getBoundingClientRect();
        return {
          left: Math.round(box.left),
          right: Math.round(box.right),
          top: Math.round(box.top),
          bottom: Math.round(box.bottom),
          width: Math.round(box.width),
          height: Math.round(box.height),
        };
      };
      const summarize = (element: HTMLElement) => ({
        tag: element.tagName.toLowerCase(),
        testId: testIdOf(element),
        className: classOf(element).slice(0, 140),
        text: textOf(element),
        ...boxOf(element),
      });
      const isAllowedOverflow = (element: HTMLElement) =>
        element instanceof SVGElement ||
        Boolean(
          element.closest(
            "[data-layout-overflow-allowed='true'], .sr-only, .chrome-brand-a11y",
          ),
        );

      const pageOverflow = Math.max(0, document.documentElement.scrollWidth - window.innerWidth);
      const pageOverflowOffenders = Array.from(document.querySelectorAll<HTMLElement>("body *"))
        .filter((element) => visible(element) && !isAllowedOverflow(element))
        .filter((element) => {
          const box = element.getBoundingClientRect();
          if (box.left < -2 || box.right > window.innerWidth + 2) return true;
          if (element.scrollWidth > element.clientWidth + 2) {
            const style = window.getComputedStyle(element);
            return style.overflowX === "visible";
          }
          return false;
        })
        .slice(0, 10)
        .map((element) => ({
          ...summarize(element),
          scrollWidth: element.scrollWidth,
          clientWidth: element.clientWidth,
        }));

      const controls = Array.from(
        document.querySelectorAll<HTMLElement>(
          'a, button, input, select, textarea, [role="button"]',
        ),
      ).filter((element) => visible(element) && !isAllowedOverflow(element));

      const viewportClippedControls = controls
        .filter((element) => {
          const box = element.getBoundingClientRect();
          return box.left < -2 || box.right > window.innerWidth + 2;
        })
        .map(summarize);

      const containerSelector = [
        ".chrome-canvas",
        ".surface-hero",
        ".surface-card",
        ".surface-panel",
        ".surface-section",
        ".surface-table-shell",
        ".workflow-card",
        ".dashboard-card",
        ".vault-card",
        ".stage-card",
        ".metric-card",
        "[data-testid$='-panel']",
        "[data-testid$='-card']",
      ].join(", ");

      const containerEscapingControls = controls
        .filter((element) => {
          const container = element.parentElement?.closest<HTMLElement>(containerSelector);
          if (!container || container === document.body) return false;
          const box = element.getBoundingClientRect();
          const containerBox = container.getBoundingClientRect();
          return (
            box.left < containerBox.left - 3 ||
            box.right > containerBox.right + 3 ||
            box.top < containerBox.top - 3 ||
            box.bottom > containerBox.bottom + 3
          );
        })
        .slice(0, 10)
        .map(summarize);

      const clippedTextControls = controls
        .filter((element) => {
          if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
            return false;
          }
          const text = textOf(element);
          if (text.length < 3) return false;
          const style = window.getComputedStyle(element);
          if (style.overflowX === "auto" || style.overflowX === "scroll") return false;
          return element.scrollWidth > element.clientWidth + 3;
        })
        .slice(0, 10)
        .map((element) => ({
          ...summarize(element),
          scrollWidth: element.scrollWidth,
          clientWidth: element.clientWidth,
        }));

      const lineCountOf = (element: HTMLElement) => {
        const range = document.createRange();
        range.selectNodeContents(element);
        const count = Array.from(range.getClientRects()).filter(
          (rect) => rect.width > 1 && rect.height > 1,
        ).length;
        range.detach();
        return count;
      };

      const microcopySelector = [
        "p",
        ".surface-copy",
        ".surface-section-copy",
        ".dashboard-stage-subtitle",
        ".discover-stage-copy",
        ".vaults-stage-copy",
        ".workflow-copy",
      ].join(", ");

      const skinnyMicrocopy = Array.from(document.querySelectorAll<HTMLElement>(microcopySelector))
        .filter((element) => visible(element) && !isAllowedOverflow(element))
        .filter((element) => {
          if (element.closest(".chrome-rail, nav, table, .surface-table-shell")) return false;
          const text = textOf(element);
          const words = text.split(/\s+/).filter(Boolean).length;
          if (text.length < 48 || text.length > 220 || words < 7) return false;

          const box = element.getBoundingClientRect();
          const lineCount = lineCountOf(element);
          const parentBox =
            element.parentElement?.closest<HTMLElement>(
              [
                ".transaction-review-card",
                ".create-assistant-launch-card",
                ".dashboard-section-workspace",
                ".discover-section-workspace",
                ".chrome-canvas",
                ".surface-card",
                ".surface-section",
                ".surface-hero",
                ".workflow-card",
              ].join(", "),
            )?.getBoundingClientRect() ?? null;
          const parentWidth = parentBox?.width ?? box.width;

          return lineCount >= 5 && box.width < 280 && parentWidth > box.width * 1.45;
        })
        .slice(0, 10)
        .map((element) => {
          const box = element.getBoundingClientRect();
          const parentBox =
            element.parentElement?.closest<HTMLElement>(
              [
                ".transaction-review-card",
                ".create-assistant-launch-card",
                ".dashboard-section-workspace",
                ".discover-section-workspace",
                ".chrome-canvas",
                ".surface-card",
                ".surface-section",
                ".surface-hero",
                ".workflow-card",
              ].join(", "),
            )?.getBoundingClientRect() ?? null;
          return {
            ...summarize(element),
            lineCount: lineCountOf(element),
            elementWidth: Math.round(box.width),
            containerWidth: Math.round(parentBox?.width ?? box.width),
          };
        });

      return {
        route: routeKey,
        breakpoint: breakpointKey,
        viewport: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        pageOverflow,
        pageOverflowOffenders,
        viewportClippedControls,
        containerEscapingControls,
        clippedTextControls,
        skinnyMicrocopy,
      };
    },
    { routeKey: route.key, breakpointKey: breakpoint.key },
  );

  expect(
    report.pageOverflow,
    `${route.key}@${breakpoint.key} page overflow:\n${JSON.stringify(report, null, 2)}`,
  ).toBeLessThanOrEqual(2);
  expect(
    report.pageOverflowOffenders,
    `${route.key}@${breakpoint.key} page overflow offenders`,
  ).toEqual([]);
  expect(
    report.viewportClippedControls,
    `${route.key}@${breakpoint.key} controls clipped by viewport`,
  ).toEqual([]);
  expect(
    report.containerEscapingControls,
    `${route.key}@${breakpoint.key} controls escape their visual container`,
  ).toEqual([]);
  expect(
    report.clippedTextControls,
    `${route.key}@${breakpoint.key} controls hide their own label text`,
  ).toEqual([]);
  expect(
    report.skinnyMicrocopy,
    `${route.key}@${breakpoint.key} microcopy is squeezed into excessive short lines`,
  ).toEqual([]);

  return report as LayoutIntegrityReport;
}

test.describe.configure({ mode: "serial" });
test.setTimeout(600_000);

test("public product routes keep readable, unclipped layouts across critical breakpoints", async ({
  page,
}) => {
  await mockCatalogApi(page);
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "wallet:pubkey",
      "GCFLOW7RTH9KLMNOPQ2UVWX3YZ56789ABCDEFGHJKLMNPRSTUV4WX",
    );
    window.localStorage.setItem("e2e-wallet-profile", "holder");
  });

  const routes = LAYOUT_INTEGRITY_ROUTES.filter((route) => route.access === "public");
  const reports: LayoutIntegrityReport[] = [];

  for (const breakpoint of LAYOUT_INTEGRITY_BREAKPOINTS) {
    await page.setViewportSize({ width: breakpoint.width, height: breakpoint.height });
    for (const route of routes) {
      await openRoute(page, route);
      reports.push(await auditLayoutIntegrity(page, route, breakpoint));
    }
  }

  expect(reports).toHaveLength(routes.length * LAYOUT_INTEGRITY_BREAKPOINTS.length);
});

test("operator routes keep advanced surfaces readable after wallet-gated access", async ({
  page,
}) => {
  await mockCatalogApi(page);
  await enableOperatorMode(page);

  const routes = LAYOUT_INTEGRITY_ROUTES.filter((route) => route.access === "operator");
  const reports: LayoutIntegrityReport[] = [];

  for (const breakpoint of LAYOUT_INTEGRITY_BREAKPOINTS) {
    await page.setViewportSize({ width: breakpoint.width, height: breakpoint.height });
    for (const route of routes) {
      await openRoute(page, route);
      reports.push(await auditLayoutIntegrity(page, route, breakpoint));
    }
  }

  expect(reports).toHaveLength(routes.length * LAYOUT_INTEGRITY_BREAKPOINTS.length);
});
