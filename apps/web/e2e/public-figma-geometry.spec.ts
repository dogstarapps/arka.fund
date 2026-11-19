import { expect, test, type Page } from "@playwright/test";
import { resolveCatalogFixture } from "../src/lib/catalog/testFixtures";
import { enableOperatorMode } from "./helpers/operator-mode";

type PublicGeometryReport = {
  route: string;
  shellWidth: number;
  canvasWidth: number;
  canvasLeft: number;
  canvasRight: number;
  canvasTop: number;
  railWidth: number;
  railTop: number;
  railRatio: number;
  brandWidth: number;
  topbarBottom: number;
  titlebarTopbarGap: number | null;
  titlebarTopbarOverlap: boolean;
  commandBarBottom: number;
  commandBarHeight: number;
  commandGroupVisible: boolean;
  commandSearchVisible: boolean;
  commandSearchCanvasCenterDelta: number | null;
  shellLeft: number;
  shellRight: number;
  commandCreateWidth: number;
  commandCreateHref: string | null;
  visiblePublicQuickControls: Array<{
    selector: string;
    text: string;
    left: number;
    top: number;
    right: number;
    bottom: number;
  }>;
  titlebarQuickControlOverlaps: Array<{
    selector: string;
    text: string;
    controlRight: number;
    controlBottom: number;
    titlebarLeft: number;
    titlebarTop: number;
  }>;
  visibleCreateLinkCount: number;
  discoverTitlebarLeft: number | null;
  discoverTitlebarRight: number | null;
  discoverTitlebarTop: number | null;
  discoverTitlebarBottom: number | null;
  titlebarCommandGap: number | null;
  titlebarCanvasInset: {
    left: number | null;
    right: number | null;
    top: number | null;
  };
  titlebarPosition: string | null;
  titlebarBackgroundImage: string | null;
  titlebarBorderTopWidth: string | null;
  horizontalOverflow: number;
  clippedLabels: Array<{
    selector: string;
    text: string;
    width: number;
    scrollWidth: number;
  }>;
  outOfBoundsLabels: Array<{
    text: string;
    labelRight: number;
    containerRight: number;
    labelLeft: number;
    containerLeft: number;
  }>;
  metricColumnWidths: number[];
  metricColumnRatio: number;
  firstMetricTop: number | null;
  titlebarToMetricGap: number | null;
  metricHeaderBackgrounds: string[];
  metricIconDisplays: string[];
  metricIconLabelGaps: number[];
  metricInlineGaps: number[];
  metricStackGaps: number[];
  clippedMetricValues: Array<{
    text: string;
    width: number;
    scrollWidth: number;
  }>;
  outOfBoundsMetricValues: Array<{
    text: string;
    valueRight: number;
    containerRight: number;
    valueLeft: number;
    containerLeft: number;
  }>;
  discoverMetricBoardHeight: number | null;
  discoverCollectionBoardHeight: number | null;
  discoverMetricBoardTop: number | null;
  discoverCollectionBoardTop: number | null;
  discoverBoardGap: number | null;
};

type PublicMetricHeaderReport = {
  route: string;
  cardCount: number;
  missingSemanticClasses: Array<{
    testId: string | null;
    classes: string;
  }>;
  clippedLabels: Array<{
    text: string;
    width: number;
    scrollWidth: number;
  }>;
  outOfBoundsLabels: Array<{
    text: string;
    labelRight: number;
    containerRight: number;
    labelLeft: number;
    containerLeft: number;
  }>;
  clippedMetricValues: Array<{
    text: string;
    width: number;
    scrollWidth: number;
  }>;
  outOfBoundsMetricValues: Array<{
    text: string;
    valueRight: number;
    containerRight: number;
    valueLeft: number;
    containerLeft: number;
  }>;
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

async function openPublicRoute(page: Page, path: string) {
  await page.setViewportSize({ width: 1365, height: 768 });
  await mockCatalogApi(page);
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  await expect(page.getByTestId("product-canvas")).toBeVisible();
  await expect(page.getByTestId("product-rail")).toBeVisible();
}

async function auditPublicGeometry(page: Page, route: string): Promise<PublicGeometryReport> {
  return page.evaluate((routeName) => {
    const box = (selector: string) => {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element) throw new Error(`${selector} missing`);
      const rect = element.getBoundingClientRect();
      return {
        element,
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        top: Math.round(rect.top),
        bottom: Math.round(rect.bottom),
      };
    };
    const shell = box(".chrome-shell-public-dashboard");
    const canvas = box("[data-testid='product-canvas']");
    const rail = box("[data-testid='product-rail']");
    const railNav = box(".chrome-rail-public-dashboard .chrome-rail-nav");
    const topbar = box(".chrome-shell-public-dashboard .chrome-topbar");
    const brand = box(".chrome-shell-public-dashboard .chrome-brand-image");
    const commandBar = topbar;
    const commandGroup = document.querySelector<HTMLElement>(
      ".chrome-topbar .chrome-command-group",
    );
    const commandSearch = document.querySelector<HTMLElement>(
      ".chrome-topbar .chrome-topbar-search",
    );
    const commandCreate = document.querySelector<HTMLAnchorElement>(
      ".chrome-shell-public-dashboard .chrome-topbar-create-link",
    );
    const commandCreateRect = commandCreate?.getBoundingClientRect();
    const isVisible = (element: HTMLElement) => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return (
        rect.width > 2 &&
        rect.height > 2 &&
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        style.opacity !== "0"
      );
    };
    const visibleCreateLinkCount = Array.from(
      document.querySelectorAll<HTMLAnchorElement>(
        "a[href='/factory/create'], a[href^='/factory/create?']",
      ),
    ).filter((element) => isVisible(element)).length;
    const commandGroupRect = commandGroup?.getBoundingClientRect();
    const commandGroupStyle = commandGroup
      ? window.getComputedStyle(commandGroup)
      : null;
    const commandSearchRect = commandSearch?.getBoundingClientRect();
    const commandSearchStyle = commandSearch
      ? window.getComputedStyle(commandSearch)
      : null;
    const discoverTitlebar = document.querySelector<HTMLElement>(
      ".discover-stage-titlebar, .dashboard-discover-titlebar",
    );
    const discoverTitlebarRect = discoverTitlebar?.getBoundingClientRect();
    const discoverTitlebarStyle = discoverTitlebar
      ? window.getComputedStyle(discoverTitlebar)
      : null;
    const discoverMetricBoard = document.querySelector<HTMLElement>(
      "[data-testid='discover-public-metric-board']",
    );
    const discoverCollectionBoard = document.querySelector<HTMLElement>(
      "[data-testid='discover-public-collection-board']",
    );
    const discoverMetricBoardRect = discoverMetricBoard?.getBoundingClientRect();
    const discoverCollectionBoardRect =
      discoverCollectionBoard?.getBoundingClientRect();
    const topbarRect = topbar.element.getBoundingClientRect();
    const titlebarTopbarOverlap =
      discoverTitlebarRect == null
        ? false
        : !(
            discoverTitlebarRect.right <= topbarRect.left ||
            discoverTitlebarRect.left >= topbarRect.right ||
            discoverTitlebarRect.bottom <= topbarRect.top ||
            discoverTitlebarRect.top >= topbarRect.bottom
          );
    const visiblePublicQuickControls = Array.from(
      document.querySelectorAll<HTMLElement>(
        [
          ".chrome-command-bar-public-dashboard .chrome-command-token",
          ".chrome-command-bar-public-dashboard .chrome-command-link",
          ".chrome-command-bar-public-dashboard .chrome-search-form",
        ].join(","),
      ),
    )
      .filter((element) => isVisible(element))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          selector: element.className || element.tagName.toLowerCase(),
          text: (element.textContent ?? "").trim(),
          left: Math.round(rect.left),
          top: Math.round(rect.top),
          right: Math.round(rect.right),
          bottom: Math.round(rect.bottom),
        };
      });
    const titlebarQuickControlOverlaps =
      discoverTitlebarRect == null
        ? []
        : visiblePublicQuickControls.filter((control) => {
            return !(
              control.right <= discoverTitlebarRect.left ||
              control.left >= discoverTitlebarRect.right ||
              control.bottom <= discoverTitlebarRect.top ||
              control.top >= discoverTitlebarRect.bottom
            );
          }).map((control) => ({
            selector: control.selector,
            text: control.text,
            controlRight: control.right,
            controlBottom: control.bottom,
            titlebarLeft: Math.round(discoverTitlebarRect.left),
            titlebarTop: Math.round(discoverTitlebarRect.top),
          }));
    const metricCards = Array.from(
      document.querySelectorAll<HTMLElement>(
        ".discover-stage-grid > .public-figma-metric-card, .dashboard-discover-frame .public-figma-metric-card",
      ),
    ).slice(0, 4);
    const clippedLabels = Array.from(
      document.querySelectorAll<HTMLElement>(
        [
          ".chrome-rail-public-dashboard .chrome-rail-link span:last-child",
          ".discover-stage-tile-head .discover-stage-tile-label",
          ".dashboard-discover-frame .public-figma-metric-head strong",
        ].join(","),
      ),
    )
      .filter((element) => element.scrollWidth > element.clientWidth + 2)
      .map((element) => ({
        selector: element.className || element.tagName.toLowerCase(),
        text: (element.textContent ?? "").trim(),
        width: Math.round(element.clientWidth),
        scrollWidth: Math.round(element.scrollWidth),
      }));
    const outOfBoundsLabels = Array.from(
      document.querySelectorAll<HTMLElement>(
        [
          ".discover-stage-tile-head .discover-stage-tile-label",
          ".dashboard-discover-frame .public-figma-metric-head strong",
        ].join(","),
      ),
    )
      .map((element) => {
        const container = element.closest<HTMLElement>(".public-figma-metric-head");
        if (!container) return null;
        const labelRect = element.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const outside =
          labelRect.left < containerRect.left - 1 ||
          labelRect.right > containerRect.right + 1;
        return outside
          ? {
              text: (element.textContent ?? "").trim(),
              labelRight: Math.round(labelRect.right),
              containerRight: Math.round(containerRect.right),
              labelLeft: Math.round(labelRect.left),
              containerLeft: Math.round(containerRect.left),
            }
          : null;
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    const metricColumnWidths = metricCards.map((card) =>
      Math.round(card.getBoundingClientRect().width),
    );
    const firstMetricRect = metricCards[0]?.getBoundingClientRect();
    const metricHeaderBackgrounds = metricCards.map((card) => {
      const head = card.querySelector<HTMLElement>(".public-figma-metric-head");
      return head ? window.getComputedStyle(head).backgroundImage : "missing";
    });
    const metricIconDisplays = metricCards.map((card) => {
      const icon = card.querySelector<HTMLElement>(".public-figma-metric-icon");
      return icon ? window.getComputedStyle(icon).display : "missing";
    });
    const metricIconLabelGaps = metricCards.map((card) => {
      const icon = card.querySelector<HTMLElement>(".public-figma-metric-icon");
      const label = card.querySelector<HTMLElement>(
        ".public-figma-metric-head strong, .public-figma-metric-head .discover-stage-tile-label",
      );
      if (!icon || !label) return 0;
      const iconRect = icon.getBoundingClientRect();
      const labelRect = label.getBoundingClientRect();
      return Math.round(labelRect.left - iconRect.right);
    });
    const metricInlineGaps = metricCards.map((card) => {
      const head = card.querySelector<HTMLElement>(".public-figma-metric-head");
      const value = card.querySelector<HTMLElement>(".public-figma-metric-value");
      if (!head || !value) return 0;
      const headRect = head.getBoundingClientRect();
      const valueRect = value.getBoundingClientRect();
      return Math.round(valueRect.left - headRect.right);
    });
    const metricStackGaps = metricCards.map((card) => {
      const head = card.querySelector<HTMLElement>(".public-figma-metric-head");
      const value = card.querySelector<HTMLElement>(".public-figma-metric-value");
      if (!head || !value) return 0;
      const headRect = head.getBoundingClientRect();
      const valueRect = value.getBoundingClientRect();
      return Math.round(valueRect.top - headRect.bottom);
    });
    const clippedMetricValues = Array.from(
      document.querySelectorAll<HTMLElement>(
        [
          ".public-figma-metric-deck .public-figma-metric-value",
          "[data-testid='discover-summary-grid'] .public-figma-metric-value",
        ].join(","),
      ),
    )
      .filter((element) => element.scrollWidth > element.clientWidth + 2)
      .map((element) => ({
        text: (element.textContent ?? "").trim(),
        width: Math.round(element.clientWidth),
        scrollWidth: Math.round(element.scrollWidth),
      }));
    const outOfBoundsMetricValues = Array.from(
      document.querySelectorAll<HTMLElement>(
        [
          ".public-figma-metric-deck .public-figma-metric-value",
          "[data-testid='discover-summary-grid'] .public-figma-metric-value",
        ].join(","),
      ),
    )
      .map((element) => {
        const container = element.closest<HTMLElement>(".public-figma-metric-card");
        if (!container) return null;
        const valueRect = element.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const outside =
          valueRect.left < containerRect.left - 1 ||
          valueRect.right > containerRect.right + 1;
        return outside
          ? {
              text: (element.textContent ?? "").trim(),
              valueRight: Math.round(valueRect.right),
              containerRight: Math.round(containerRect.right),
              valueLeft: Math.round(valueRect.left),
              containerLeft: Math.round(containerRect.left),
            }
          : null;
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
    const [firstMetricWidth = 0, secondMetricWidth = 1] = metricColumnWidths;

    return {
      route: routeName,
      shellWidth: shell.width,
      shellLeft: Math.round(shell.element.getBoundingClientRect().left),
      shellRight: Math.round(shell.element.getBoundingClientRect().right),
      canvasWidth: canvas.width,
      canvasLeft: Math.round(canvas.element.getBoundingClientRect().left),
      canvasRight: Math.round(canvas.element.getBoundingClientRect().right),
      canvasTop: canvas.top,
      railWidth: rail.width,
      railTop: railNav.top,
      railRatio: Number((rail.width / Math.max(1, canvas.width)).toFixed(3)),
      brandWidth: brand.width,
      topbarBottom: topbar.bottom,
      titlebarTopbarGap: discoverTitlebarRect
        ? Math.round(discoverTitlebarRect.top - topbar.bottom)
        : null,
      titlebarTopbarOverlap,
      commandBarBottom: commandBar.bottom,
      commandBarHeight: commandBar.height,
      commandGroupVisible: Boolean(
        commandGroup &&
          commandGroupRect &&
          commandGroupRect.width > 2 &&
          commandGroupRect.height > 2 &&
          commandGroupStyle?.display !== "none" &&
          commandGroupStyle?.visibility !== "hidden",
      ),
      commandSearchVisible: Boolean(
        commandSearch &&
          commandSearchRect &&
          commandSearchRect.width > 2 &&
          commandSearchRect.height > 2 &&
          commandSearchStyle?.display !== "none" &&
          commandSearchStyle?.visibility !== "hidden" &&
          commandSearchStyle?.opacity !== "0",
      ),
      commandSearchCanvasCenterDelta:
        commandSearchRect == null ||
        commandSearchRect.width <= 2 ||
        commandSearchRect.height <= 2 ||
        commandSearchStyle?.display === "none" ||
        commandSearchStyle?.visibility === "hidden" ||
        commandSearchStyle?.opacity === "0"
          ? null
          : Math.round(
              Math.abs(
                commandSearchRect.left +
                  commandSearchRect.width / 2 -
                  (canvas.element.getBoundingClientRect().left + canvas.width / 2),
              ),
            ),
      commandCreateWidth: commandCreateRect ? Math.round(commandCreateRect.width) : 0,
      commandCreateHref: commandCreate?.getAttribute("href") ?? null,
      visiblePublicQuickControls,
      titlebarQuickControlOverlaps,
      visibleCreateLinkCount,
      discoverTitlebarLeft: discoverTitlebarRect ? Math.round(discoverTitlebarRect.left) : null,
      discoverTitlebarRight: discoverTitlebarRect ? Math.round(discoverTitlebarRect.right) : null,
      discoverTitlebarTop: discoverTitlebarRect ? Math.round(discoverTitlebarRect.top) : null,
      discoverTitlebarBottom: discoverTitlebarRect ? Math.round(discoverTitlebarRect.bottom) : null,
      titlebarCommandGap: discoverTitlebarRect
        ? Math.round(discoverTitlebarRect.top - commandBar.bottom)
        : null,
      titlebarCanvasInset: {
        left: discoverTitlebarRect
          ? Math.round(discoverTitlebarRect.left - canvas.element.getBoundingClientRect().left)
          : null,
        right: discoverTitlebarRect
          ? Math.round(canvas.element.getBoundingClientRect().right - discoverTitlebarRect.right)
          : null,
        top: discoverTitlebarRect
          ? Math.round(discoverTitlebarRect.top - canvas.element.getBoundingClientRect().top)
          : null,
      },
      titlebarPosition: discoverTitlebarStyle?.position ?? null,
      titlebarBackgroundImage: discoverTitlebarStyle?.backgroundImage ?? null,
      titlebarBorderTopWidth: discoverTitlebarStyle?.borderTopWidth ?? null,
      horizontalOverflow: Math.ceil(
        document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
      clippedLabels,
      outOfBoundsLabels,
      metricColumnWidths,
      metricColumnRatio: Number((firstMetricWidth / Math.max(1, secondMetricWidth)).toFixed(3)),
      firstMetricTop: firstMetricRect ? Math.round(firstMetricRect.top) : null,
      titlebarToMetricGap:
        firstMetricRect && discoverTitlebarRect
          ? Math.round(firstMetricRect.top - discoverTitlebarRect.bottom)
          : null,
      metricHeaderBackgrounds,
      metricIconDisplays,
      metricIconLabelGaps,
      metricInlineGaps,
      metricStackGaps,
      clippedMetricValues,
      outOfBoundsMetricValues,
      discoverMetricBoardHeight: discoverMetricBoardRect
        ? Math.round(discoverMetricBoardRect.height)
        : null,
      discoverCollectionBoardHeight: discoverCollectionBoardRect
        ? Math.round(discoverCollectionBoardRect.height)
        : null,
      discoverMetricBoardTop: discoverMetricBoardRect
        ? Math.round(discoverMetricBoardRect.top)
        : null,
      discoverCollectionBoardTop: discoverCollectionBoardRect
        ? Math.round(discoverCollectionBoardRect.top)
        : null,
      discoverBoardGap:
        discoverMetricBoardRect && discoverCollectionBoardRect
          ? Math.round(discoverCollectionBoardRect.top - discoverMetricBoardRect.bottom)
          : null,
    };
  }, route);
}

async function auditPublicMetricHeaders(
  page: Page,
  route: string,
): Promise<PublicMetricHeaderReport> {
  return page.evaluate((routeName) => {
    const toneClasses = new Set([
      "public-figma-metric-card",
      "public-figma-metric-card-default",
      "public-figma-metric-card-positive",
      "public-figma-metric-card-warning",
    ]);
    const cards = Array.from(
      document.querySelectorAll<HTMLElement>(
        ".public-figma-metric-deck .public-figma-metric-card",
      ),
    );
    const labels = Array.from(
      document.querySelectorAll<HTMLElement>(
        ".public-figma-metric-deck .public-figma-metric-head strong",
      ),
    );
    const missingSemanticClasses = cards
      .filter((card) => {
        const classes = Array.from(card.classList);
        return !classes.some(
          (className) =>
            className.startsWith("public-figma-metric-card-") &&
            !toneClasses.has(className),
        );
      })
      .map((card) => ({
        testId: card.getAttribute("data-testid"),
        classes: card.className,
      }));
    const clippedLabels = labels
      .filter((element) => element.scrollWidth > element.clientWidth + 2)
      .map((element) => ({
        text: (element.textContent ?? "").trim(),
        width: Math.round(element.clientWidth),
        scrollWidth: Math.round(element.scrollWidth),
      }));
    const outOfBoundsLabels = labels
      .map((element) => {
        const container = element.closest<HTMLElement>(".public-figma-metric-head");
        if (!container) return null;
        const labelRect = element.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const outside =
          labelRect.left < containerRect.left - 1 ||
          labelRect.right > containerRect.right + 1;
        return outside
          ? {
              text: (element.textContent ?? "").trim(),
              labelRight: Math.round(labelRect.right),
              containerRight: Math.round(containerRect.right),
              labelLeft: Math.round(labelRect.left),
              containerLeft: Math.round(containerRect.left),
            }
          : null;
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
    const values = Array.from(
      document.querySelectorAll<HTMLElement>(
        ".public-figma-metric-deck .public-figma-metric-value",
      ),
    );
    const clippedMetricValues = values
      .filter((element) => element.scrollWidth > element.clientWidth + 2)
      .map((element) => ({
        text: (element.textContent ?? "").trim(),
        width: Math.round(element.clientWidth),
        scrollWidth: Math.round(element.scrollWidth),
      }));
    const outOfBoundsMetricValues = values
      .map((element) => {
        const container = element.closest<HTMLElement>(".public-figma-metric-card");
        if (!container) return null;
        const valueRect = element.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const outside =
          valueRect.left < containerRect.left - 1 ||
          valueRect.right > containerRect.right + 1;
        return outside
          ? {
              text: (element.textContent ?? "").trim(),
              valueRight: Math.round(valueRect.right),
              containerRight: Math.round(containerRect.right),
              valueLeft: Math.round(valueRect.left),
              containerLeft: Math.round(containerRect.left),
            }
          : null;
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    return {
      route: routeName,
      cardCount: cards.length,
      missingSemanticClasses,
      clippedLabels,
      outOfBoundsLabels,
      clippedMetricValues,
      outOfBoundsMetricValues,
    };
  }, route);
}

test.describe("public Figma shell geometry", () => {
  for (const route of ["/discover", "/arkas", "/dashboard"] as const) {
    test(`keeps public settings gear optically centered on ${route}`, async ({
      page,
    }) => {
      await openPublicRoute(page, route);

      const gear = await page.evaluate(() => {
        const link = document.querySelector<HTMLElement>(
          ".chrome-shell-public-dashboard .chrome-gear-link",
        );
        const svg = link?.querySelector<SVGElement>("svg");
        if (!link || !svg) {
          throw new Error("Public settings gear missing");
        }

        const linkRect = link.getBoundingClientRect();
        const svgRect = svg.getBoundingClientRect();
        const linkStyle = window.getComputedStyle(link);
        const svgStyle = window.getComputedStyle(svg);

        return {
          linkDisplay: linkStyle.display,
          svgDisplay: svgStyle.display,
          xDelta: Math.abs(
            linkRect.left + linkRect.width / 2 - (svgRect.left + svgRect.width / 2),
          ),
          yDelta: Math.abs(
            linkRect.top + linkRect.height / 2 - (svgRect.top + svgRect.height / 2),
          ),
          linkWidth: linkRect.width,
          linkHeight: linkRect.height,
          svgWidth: svgRect.width,
          svgHeight: svgRect.height,
        };
      });

      expect(gear.linkDisplay, JSON.stringify(gear, null, 2)).toBe("grid");
      expect(gear.svgDisplay, JSON.stringify(gear, null, 2)).toBe("block");
      expect(gear.xDelta, JSON.stringify(gear, null, 2)).toBeLessThanOrEqual(1);
      expect(gear.yDelta, JSON.stringify(gear, null, 2)).toBeLessThanOrEqual(1);
      expect(gear.svgWidth, JSON.stringify(gear, null, 2)).toBeGreaterThan(12);
      expect(gear.svgHeight, JSON.stringify(gear, null, 2)).toBeGreaterThan(12);
      expect(gear.linkWidth, JSON.stringify(gear, null, 2)).toBeGreaterThan(32);
      expect(gear.linkHeight, JSON.stringify(gear, null, 2)).toBeGreaterThan(32);
    });
  }

  test("keeps Discover, Arkas, Vaults and Dashboard on the same public shell width", async ({
    page,
  }) => {
    const routes = ["/discover", "/arkas", "/vaults", "/dashboard"] as const;
    const reports: Array<{
      route: string;
      shellLeft: number;
      shellWidth: number;
      railWidth: number;
      gearDeltaX: number;
      gearDeltaY: number;
    }> = [];

    for (const route of routes) {
      await openPublicRoute(page, route);
      reports.push(
        await page.evaluate((routeName) => {
          const shell = document.querySelector<HTMLElement>(
            ".chrome-shell-public-dashboard",
          );
          const rail = document.querySelector<HTMLElement>(
            ".chrome-rail-public-dashboard",
          );
          const gear = document.querySelector<HTMLElement>(
            ".chrome-shell-public-dashboard .chrome-gear-link",
          );
          const gearIcon = gear?.querySelector<SVGElement>("svg");
          if (!shell || !rail || !gear || !gearIcon) {
            throw new Error(`Missing public chrome on ${routeName}`);
          }
          const shellRect = shell.getBoundingClientRect();
          const railRect = rail.getBoundingClientRect();
          const gearRect = gear.getBoundingClientRect();
          const iconRect = gearIcon.getBoundingClientRect();
          return {
            route: routeName,
            shellLeft: Math.round(shellRect.left),
            shellWidth: Math.round(shellRect.width),
            railWidth: Math.round(railRect.width),
            gearDeltaX: Math.abs(
              gearRect.left + gearRect.width / 2 - (iconRect.left + iconRect.width / 2),
            ),
            gearDeltaY: Math.abs(
              gearRect.top + gearRect.height / 2 - (iconRect.top + iconRect.height / 2),
            ),
          };
        }, route),
      );
    }

    const shellWidths = reports.map((report) => report.shellWidth);
    const shellLefts = reports.map((report) => report.shellLeft);
    expect(
      Math.max(...shellWidths) - Math.min(...shellWidths),
      JSON.stringify(reports, null, 2),
    ).toBeLessThanOrEqual(1);
    expect(
      Math.max(...shellLefts) - Math.min(...shellLefts),
      JSON.stringify(reports, null, 2),
    ).toBeLessThanOrEqual(1);
    for (const report of reports) {
      expect(report.railWidth, JSON.stringify(reports, null, 2)).toBeGreaterThanOrEqual(300);
      expect(report.gearDeltaX, JSON.stringify(reports, null, 2)).toBeLessThanOrEqual(1);
      expect(report.gearDeltaY, JSON.stringify(reports, null, 2)).toBeLessThanOrEqual(1);
    }
  });

  test("keeps Discover chrome rail and metric headers within Figma-like proportions", async ({
    page,
  }) => {
    await openPublicRoute(page, "/discover");
    const report = await auditPublicGeometry(page, "discover");

    expect(report.brandWidth, JSON.stringify(report, null, 2)).toBeGreaterThanOrEqual(178);
    expect(report.commandCreateHref, JSON.stringify(report, null, 2)).toContain("/factory/create");
    expect(report.commandCreateWidth, JSON.stringify(report, null, 2)).toBeGreaterThan(0);
    expect(report.commandBarHeight, JSON.stringify(report, null, 2)).toBeLessThanOrEqual(120);
    expect(report.commandGroupVisible, JSON.stringify(report, null, 2)).toBe(false);
    expect(report.commandSearchVisible, JSON.stringify(report, null, 2)).toBe(true);
    expect(report.shellLeft, JSON.stringify(report, null, 2)).toBeGreaterThanOrEqual(56);
    expect(report.shellLeft, JSON.stringify(report, null, 2)).toBeLessThanOrEqual(84);
    expect(report.shellRight, JSON.stringify(report, null, 2)).toBeGreaterThanOrEqual(1280);
    expect(report.commandSearchCanvasCenterDelta, JSON.stringify(report, null, 2)).not.toBeNull();
    expect(report.commandSearchCanvasCenterDelta ?? 999, JSON.stringify(report, null, 2)).toBeLessThanOrEqual(180);
    expect(
      report.visiblePublicQuickControls.filter((control) =>
        /chrome-command-(token|link)/.test(control.selector),
      ),
      JSON.stringify(report, null, 2),
    ).toEqual([]);
    expect(report.titlebarQuickControlOverlaps, JSON.stringify(report, null, 2)).toEqual([]);
    expect(report.titlebarTopbarOverlap, JSON.stringify(report, null, 2)).toBe(false);
    expect(report.titlebarTopbarGap, JSON.stringify(report, null, 2)).not.toBeNull();
    expect(report.titlebarTopbarGap ?? 0, JSON.stringify(report, null, 2)).toBeGreaterThanOrEqual(
      8,
    );
    expect(report.visibleCreateLinkCount, JSON.stringify(report, null, 2)).toBeGreaterThanOrEqual(1);
    expect(report.discoverTitlebarTop, JSON.stringify(report, null, 2)).not.toBeNull();
    expect(report.discoverTitlebarBottom, JSON.stringify(report, null, 2)).not.toBeNull();
    expect(["relative", "absolute"], JSON.stringify(report, null, 2)).toContain(
      report.titlebarPosition,
    );
    expect(report.titlebarBackgroundImage ?? "", JSON.stringify(report, null, 2)).toContain(
      "linear-gradient",
    );
    expect(report.titlebarCanvasInset.left ?? 0, JSON.stringify(report, null, 2)).toBeGreaterThanOrEqual(
      8,
    );
    expect(report.titlebarCanvasInset.right ?? 0, JSON.stringify(report, null, 2)).toBeGreaterThanOrEqual(
      16,
    );
    expect(report.titlebarCanvasInset.top ?? -1, JSON.stringify(report, null, 2)).toBeGreaterThanOrEqual(
      12,
    );
    expect(report.titlebarCanvasInset.top ?? 999, JSON.stringify(report, null, 2)).toBeLessThanOrEqual(
      64,
    );
    expect(report.discoverTitlebarTop ?? 0, JSON.stringify(report, null, 2)).toBeGreaterThanOrEqual(
      report.canvasTop,
    );
    expect(report.canvasTop, JSON.stringify(report, null, 2)).toBeGreaterThanOrEqual(80);
    expect(report.canvasTop, JSON.stringify(report, null, 2)).toBeLessThanOrEqual(168);
    expect(report.canvasTop, JSON.stringify(report, null, 2)).toBeGreaterThan(
      report.topbarBottom,
    );
    expect(report.commandBarBottom, JSON.stringify(report, null, 2)).toBeLessThanOrEqual(132);
    expect(report.canvasTop, JSON.stringify(report, null, 2)).toBeGreaterThan(
      report.commandBarBottom,
    );
    expect(report.titlebarCommandGap, JSON.stringify(report, null, 2)).not.toBeNull();
    expect(report.titlebarCommandGap ?? 0, JSON.stringify(report, null, 2)).toBeGreaterThanOrEqual(
      18,
    );
    expect(report.railTop, JSON.stringify(report, null, 2)).toBeGreaterThanOrEqual(
      report.topbarBottom,
    );
    expect(report.railTop - report.canvasTop, JSON.stringify(report, null, 2)).toBeLessThanOrEqual(
      50,
    );
    expect(report.railWidth, JSON.stringify(report, null, 2)).toBeGreaterThanOrEqual(210);
    expect(report.railWidth, JSON.stringify(report, null, 2)).toBeLessThanOrEqual(310);
    expect(report.railRatio, JSON.stringify(report, null, 2)).toBeGreaterThanOrEqual(0.19);
    expect(report.railRatio, JSON.stringify(report, null, 2)).toBeLessThanOrEqual(0.34);
    expect(report.horizontalOverflow, JSON.stringify(report, null, 2)).toBeLessThanOrEqual(2);
    expect(report.metricColumnWidths, JSON.stringify(report, null, 2)).toHaveLength(4);
    expect(report.firstMetricTop, JSON.stringify(report, null, 2)).not.toBeNull();
    expect(report.titlebarToMetricGap, JSON.stringify(report, null, 2)).not.toBeNull();
    expect(report.titlebarToMetricGap ?? 0, JSON.stringify(report, null, 2)).toBeGreaterThanOrEqual(
      -18,
    );
    expect(report.titlebarToMetricGap ?? 0, JSON.stringify(report, null, 2)).toBeLessThanOrEqual(
      150,
    );
    expect(report.discoverMetricBoardHeight, JSON.stringify(report, null, 2)).not.toBeNull();
    expect(report.discoverCollectionBoardHeight, JSON.stringify(report, null, 2)).not.toBeNull();
    expect(report.discoverMetricBoardTop ?? 0, JSON.stringify(report, null, 2)).toBeGreaterThanOrEqual(
      report.canvasTop,
    );
    expect(report.discoverCollectionBoardTop ?? 0, JSON.stringify(report, null, 2)).toBeGreaterThan(
      report.discoverMetricBoardTop ?? 0,
    );
    expect(report.discoverMetricBoardHeight ?? 0, JSON.stringify(report, null, 2)).toBeGreaterThanOrEqual(
      286,
    );
    expect(report.discoverMetricBoardHeight ?? 0, JSON.stringify(report, null, 2)).toBeLessThanOrEqual(
      560,
    );
    expect(report.discoverCollectionBoardHeight ?? 0, JSON.stringify(report, null, 2)).toBeGreaterThanOrEqual(
      306,
    );
    expect(report.discoverBoardGap ?? 0, JSON.stringify(report, null, 2)).toBeGreaterThanOrEqual(
      8,
    );
    expect(report.discoverBoardGap ?? 0, JSON.stringify(report, null, 2)).toBeLessThanOrEqual(
      26,
    );
    expect(report.metricColumnRatio, JSON.stringify(report, null, 2)).toBeGreaterThanOrEqual(0.55);
    expect(report.metricColumnRatio, JSON.stringify(report, null, 2)).toBeLessThanOrEqual(1.05);
    expect(
      report.metricHeaderBackgrounds.every((background) =>
        background.includes("linear-gradient"),
      ),
      JSON.stringify(report, null, 2),
    ).toBeTruthy();
    expect(
      report.metricIconDisplays.every(
        (display) => display !== "none" && display !== "contents",
      ),
      JSON.stringify(report, null, 2),
    ).toBeTruthy();
    expect(
      report.metricIconLabelGaps.every((gap) => gap >= 8),
      JSON.stringify(report, null, 2),
    ).toBeTruthy();
    expect(
      report.metricStackGaps.every((gap) => gap >= 8),
      JSON.stringify(report, null, 2),
    ).toBeTruthy();
    expect(report.clippedLabels, JSON.stringify(report, null, 2)).toEqual([]);
    expect(report.outOfBoundsLabels, JSON.stringify(report, null, 2)).toEqual([]);
    expect(report.clippedMetricValues, JSON.stringify(report, null, 2)).toEqual([]);
    expect(report.outOfBoundsMetricValues, JSON.stringify(report, null, 2)).toEqual([]);
  });

  test("keeps Dashboard public shell using the same validated geometry lane", async ({ page }) => {
    await openPublicRoute(page, "/dashboard");
    const report = await auditPublicGeometry(page, "dashboard");

    expect(report.brandWidth, JSON.stringify(report, null, 2)).toBeGreaterThanOrEqual(178);
    expect(report.commandCreateHref, JSON.stringify(report, null, 2)).toContain("/factory/create");
    expect(report.commandCreateWidth, JSON.stringify(report, null, 2)).toBeGreaterThan(0);
    expect(report.commandBarHeight, JSON.stringify(report, null, 2)).toBeLessThanOrEqual(120);
    expect(report.commandGroupVisible, JSON.stringify(report, null, 2)).toBe(false);
    expect(report.commandSearchVisible, JSON.stringify(report, null, 2)).toBe(true);
    expect(report.shellLeft, JSON.stringify(report, null, 2)).toBeGreaterThanOrEqual(56);
    expect(report.shellLeft, JSON.stringify(report, null, 2)).toBeLessThanOrEqual(84);
    expect(report.shellRight, JSON.stringify(report, null, 2)).toBeGreaterThanOrEqual(1280);
    expect(report.commandSearchCanvasCenterDelta, JSON.stringify(report, null, 2)).not.toBeNull();
    expect(report.commandSearchCanvasCenterDelta ?? 999, JSON.stringify(report, null, 2)).toBeLessThanOrEqual(180);
    expect(
      report.visiblePublicQuickControls.filter((control) =>
        /chrome-command-(token|link)/.test(control.selector),
      ),
      JSON.stringify(report, null, 2),
    ).toEqual([]);
    expect(report.titlebarQuickControlOverlaps, JSON.stringify(report, null, 2)).toEqual([]);
    expect(report.titlebarTopbarOverlap, JSON.stringify(report, null, 2)).toBe(false);
    expect(report.titlebarTopbarGap, JSON.stringify(report, null, 2)).not.toBeNull();
    expect(report.titlebarTopbarGap ?? 0, JSON.stringify(report, null, 2)).toBeGreaterThanOrEqual(
      8,
    );
    expect(report.visibleCreateLinkCount, JSON.stringify(report, null, 2)).toBeGreaterThanOrEqual(1);
    expect(report.discoverTitlebarTop, JSON.stringify(report, null, 2)).not.toBeNull();
    expect(report.discoverTitlebarBottom, JSON.stringify(report, null, 2)).not.toBeNull();
    expect(["relative", "absolute"], JSON.stringify(report, null, 2)).toContain(
      report.titlebarPosition,
    );
    expect(
      report.titlebarBackgroundImage ?? "",
      JSON.stringify(report, null, 2),
    ).toContain("linear-gradient");
    expect(report.titlebarCanvasInset.left ?? 0, JSON.stringify(report, null, 2)).toBeGreaterThanOrEqual(
      8,
    );
    expect(report.titlebarCanvasInset.right ?? 0, JSON.stringify(report, null, 2)).toBeGreaterThanOrEqual(
      16,
    );
    expect(report.titlebarCanvasInset.top ?? -1, JSON.stringify(report, null, 2)).toBeGreaterThanOrEqual(
      12,
    );
    expect(report.titlebarCanvasInset.top ?? 999, JSON.stringify(report, null, 2)).toBeLessThanOrEqual(
      64,
    );
    expect(report.canvasTop, JSON.stringify(report, null, 2)).toBeGreaterThan(
      report.commandBarBottom,
    );
    expect(report.titlebarCommandGap, JSON.stringify(report, null, 2)).not.toBeNull();
    expect(report.titlebarCommandGap ?? 0, JSON.stringify(report, null, 2)).toBeGreaterThanOrEqual(
      18,
    );
    expect(report.discoverTitlebarTop ?? 0, JSON.stringify(report, null, 2)).toBeGreaterThanOrEqual(
      report.canvasTop,
    );
    expect(report.canvasTop, JSON.stringify(report, null, 2)).toBeGreaterThanOrEqual(80);
    expect(report.canvasTop, JSON.stringify(report, null, 2)).toBeLessThanOrEqual(168);
    expect(report.canvasTop, JSON.stringify(report, null, 2)).toBeGreaterThan(
      report.topbarBottom,
    );
    expect(report.commandBarBottom, JSON.stringify(report, null, 2)).toBeLessThanOrEqual(132);
    expect(report.railTop, JSON.stringify(report, null, 2)).toBeGreaterThanOrEqual(
      report.topbarBottom,
    );
    expect(report.railTop - report.canvasTop, JSON.stringify(report, null, 2)).toBeLessThanOrEqual(
      50,
    );
    expect(report.railWidth, JSON.stringify(report, null, 2)).toBeGreaterThanOrEqual(210);
    expect(report.railWidth, JSON.stringify(report, null, 2)).toBeLessThanOrEqual(310);
    expect(report.railRatio, JSON.stringify(report, null, 2)).toBeGreaterThanOrEqual(0.19);
    expect(report.railRatio, JSON.stringify(report, null, 2)).toBeLessThanOrEqual(0.34);
    expect(report.horizontalOverflow, JSON.stringify(report, null, 2)).toBeLessThanOrEqual(2);
    expect(report.metricColumnWidths, JSON.stringify(report, null, 2)).toHaveLength(4);
    expect(report.firstMetricTop, JSON.stringify(report, null, 2)).not.toBeNull();
    expect(report.titlebarToMetricGap, JSON.stringify(report, null, 2)).not.toBeNull();
    expect(report.titlebarToMetricGap ?? 0, JSON.stringify(report, null, 2)).toBeGreaterThanOrEqual(
      -18,
    );
    expect(report.titlebarToMetricGap ?? 0, JSON.stringify(report, null, 2)).toBeLessThanOrEqual(
      150,
    );
    expect(report.metricColumnRatio, JSON.stringify(report, null, 2)).toBeGreaterThanOrEqual(0.55);
    expect(report.metricColumnRatio, JSON.stringify(report, null, 2)).toBeLessThanOrEqual(1.05);
    expect(
      report.metricHeaderBackgrounds.every((background) =>
        background.includes("linear-gradient"),
      ),
      JSON.stringify(report, null, 2),
    ).toBeTruthy();
    expect(
      report.metricIconDisplays.every(
        (display) => display !== "none" && display !== "contents",
      ),
      JSON.stringify(report, null, 2),
    ).toBeTruthy();
    expect(
      report.metricIconLabelGaps.every((gap) => gap >= 8),
      JSON.stringify(report, null, 2),
    ).toBeTruthy();
    expect(
      report.metricStackGaps.every((gap) => gap >= 8),
      JSON.stringify(report, null, 2),
    ).toBeTruthy();
    expect(report.clippedLabels, JSON.stringify(report, null, 2)).toEqual([]);
    expect(report.outOfBoundsLabels, JSON.stringify(report, null, 2)).toEqual([]);
    expect(report.clippedMetricValues, JSON.stringify(report, null, 2)).toEqual([]);
    expect(report.outOfBoundsMetricValues, JSON.stringify(report, null, 2)).toEqual([]);
  });

  test("keeps Dashboard featured Arka cards compact and contained", async ({ page }) => {
    await openPublicRoute(page, "/dashboard");

    const firstFold = await page.evaluate(() => {
      const deck = document.querySelector<HTMLElement>(
        "[data-testid='dashboard-figma-metric-deck']",
      );
      const metricBoard = document.querySelector<HTMLElement>(".dashboard-discover-metric-board");
      const collectionBoard = document.querySelector<HTMLElement>(".dashboard-discover-collection-board");
      const tabs = document.querySelector<HTMLElement>(
        "[data-testid='dashboard-spotlight-tabs']",
      );
      const featureGrid = document.querySelector<HTMLElement>(
        "[data-testid='dashboard-arkas-table']",
      );
      const cards = Array.from(
        document.querySelectorAll<HTMLElement>(
          ".dashboard-figma-metric-deck > [data-testid^='dashboard-figma-metric-']",
        ),
      );
      const deckRect = deck?.getBoundingClientRect();
      const metricBoardRect = metricBoard?.getBoundingClientRect();
      const collectionBoardRect = collectionBoard?.getBoundingClientRect();
      const tabsRect = tabs?.getBoundingClientRect();
      const featureRect = featureGrid?.getBoundingClientRect();
      return {
        metricIds: cards.map((card) => card.dataset.testid ?? ""),
        metricText: cards.map((card) => (card.textContent ?? "").replace(/\s+/g, " ").trim()),
        metricBoardHeight: metricBoardRect ? Math.round(metricBoardRect.height) : 0,
        collectionBoardHeight: collectionBoardRect ? Math.round(collectionBoardRect.height) : 0,
        boardGap:
          metricBoardRect && collectionBoardRect
            ? Math.round(collectionBoardRect.top - metricBoardRect.bottom)
            : null,
        deckHeight: deckRect ? Math.round(deckRect.height) : 0,
        tabsGap: deckRect && tabsRect ? Math.round(tabsRect.top - deckRect.bottom) : null,
        featureGap:
          tabsRect && featureRect ? Math.round(featureRect.top - tabsRect.bottom) : null,
      };
    });

    expect(firstFold.metricIds, JSON.stringify(firstFold, null, 2)).toEqual([
      "dashboard-figma-metric-arkas",
      "dashboard-figma-metric-nav",
      "dashboard-figma-metric-withdrawals",
      "dashboard-figma-metric-deposits",
      "dashboard-figma-metric-managers",
      "dashboard-figma-metric-assets",
      "dashboard-figma-metric-activity",
      "dashboard-figma-metric-health",
    ]);
    const metricText = firstFold.metricText.join(" ");
    expect(metricText, JSON.stringify(firstFold, null, 2)).toMatch(/TVL/);
    expect(metricText, JSON.stringify(firstFold, null, 2)).toMatch(
      /total value in USD|Valuation unavailable/i,
    );
    expect(metricText, JSON.stringify(firstFold, null, 2)).not.toMatch(/\b(Mgrs)\b/);
    expect(firstFold.metricBoardHeight, JSON.stringify(firstFold, null, 2)).toBeGreaterThanOrEqual(
      160,
    );
    expect(firstFold.metricBoardHeight, JSON.stringify(firstFold, null, 2)).toBeLessThanOrEqual(
      430,
    );
    expect(firstFold.collectionBoardHeight, JSON.stringify(firstFold, null, 2)).toBeGreaterThanOrEqual(
      260,
    );
    expect(firstFold.boardGap ?? 0, JSON.stringify(firstFold, null, 2)).toBeGreaterThanOrEqual(8);
    expect(firstFold.boardGap ?? 0, JSON.stringify(firstFold, null, 2)).toBeLessThanOrEqual(24);
    expect(firstFold.deckHeight, JSON.stringify(firstFold, null, 2)).toBeGreaterThanOrEqual(
      150,
    );
    expect(firstFold.deckHeight, JSON.stringify(firstFold, null, 2)).toBeLessThanOrEqual(360);
    expect(firstFold.tabsGap ?? 0, JSON.stringify(firstFold, null, 2)).toBeGreaterThanOrEqual(
      8,
    );
    expect(firstFold.featureGap ?? 0, JSON.stringify(firstFold, null, 2)).toBeGreaterThanOrEqual(
      8,
    );

    const report = await page.evaluate(() => {
      const isVisible = (element: HTMLElement) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return (
          rect.width > 2 &&
          rect.height > 2 &&
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          style.opacity !== "0"
        );
      };
      const cards = Array.from(
        document.querySelectorAll<HTMLElement>(".dashboard-discover-feature-card"),
      );
      return cards.map((card) => {
        const cardRect = card.getBoundingClientRect();
        const checkedElements = Array.from(
          card.querySelectorAll<HTMLElement>(
            [
              ".dashboard-feature-figma-head",
              ".dashboard-feature-figma-metrics",
              ".dashboard-feature-chart",
              ".dashboard-feature-history-note",
              ".dashboard-feature-price-band",
              ".dashboard-feature-meta",
              ".surface-chip-wrap",
              ".surface-entry-actions",
            ].join(","),
          ),
        ).filter(isVisible);
        const outOfBounds = checkedElements
          .map((element) => {
            const rect = element.getBoundingClientRect();
            const outside =
              rect.left < cardRect.left - 1 ||
              rect.right > cardRect.right + 1 ||
              rect.top < cardRect.top - 1 ||
              rect.bottom > cardRect.bottom + 1;
            return outside
              ? {
                  selector: element.className,
                  text: (element.textContent ?? "").replace(/\s+/g, " ").trim(),
                  card: {
                    left: Math.round(cardRect.left),
                    right: Math.round(cardRect.right),
                    top: Math.round(cardRect.top),
                    bottom: Math.round(cardRect.bottom),
                  },
                  rect: {
                    left: Math.round(rect.left),
                    right: Math.round(rect.right),
                    top: Math.round(rect.top),
                    bottom: Math.round(rect.bottom),
                  },
                }
              : null;
          })
          .filter((item): item is NonNullable<typeof item> => Boolean(item));
        const chart =
          card.querySelector<HTMLElement>(".dashboard-feature-chart") ??
          card.querySelector<HTMLElement>(".dashboard-feature-history-note");
        const chartRect = chart?.getBoundingClientRect();
        const priceBand =
          card.querySelector<HTMLElement>(".dashboard-feature-price-band");
        const priceBandRect = priceBand?.getBoundingClientRect();

        return {
          height: Math.round(cardRect.height),
          width: Math.round(cardRect.width),
          chartHeight: chartRect ? Math.round(chartRect.height) : 0,
          priceBandWidth: priceBandRect ? Math.round(priceBandRect.width) : 0,
          outOfBounds,
          text: (card.textContent ?? "").replace(/\s+/g, " ").trim(),
        };
      });
    });

    expect(report, JSON.stringify(report, null, 2)).toHaveLength(3);
    for (const card of report) {
      expect(card.width, JSON.stringify(report, null, 2)).toBeGreaterThanOrEqual(220);
      expect(card.height, JSON.stringify(report, null, 2)).toBeLessThanOrEqual(620);
      expect(card.chartHeight, JSON.stringify(report, null, 2)).toBe(0);
      expect(card.priceBandWidth, JSON.stringify(report, null, 2)).toBeGreaterThan(0);
      expect(card.outOfBounds, JSON.stringify(report, null, 2)).toEqual([]);
      expect(card.text, JSON.stringify(report, null, 2)).toContain("Assets");
      expect(card.text, JSON.stringify(report, null, 2)).not.toContain("Depositors");
    }
  });

  test("keeps Integrations protocol catalog on the Figma logo-grid rhythm", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await enableOperatorMode(page);
    await mockCatalogApi(page);
    await page.goto("/integrations");
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("product-canvas")).toBeVisible();
    await expect(page.getByTestId("integrations-product-card-grid")).toBeVisible();

    for (const id of ["blend", "soroswap", "aquarius", "balanced"]) {
      await expect(
        page.getByTestId(`integrations-product-card-${id}-asset`),
      ).toBeVisible();
    }

    const report = await page.evaluate(() => {
      const cards = Array.from(
        document.querySelectorAll<HTMLElement>(".integrations-product-card"),
      );
      const grid = document.querySelector<HTMLElement>(
        "[data-testid='integrations-product-card-grid']",
      );
      if (!grid) throw new Error("Integrations protocol grid missing");

      const gridColumns = window
        .getComputedStyle(grid)
        .gridTemplateColumns.split(" ")
        .filter(Boolean).length;
      const cardRects = cards.map((card) => card.getBoundingClientRect());
      const firstTop = cardRects[0]?.top ?? 0;
      const firstRowCount = cardRects.filter(
        (rect) => Math.abs(rect.top - firstTop) <= 3,
      ).length;
      const minCardWidth = Math.min(...cardRects.map((rect) => rect.width));
      const minCardHeight = Math.min(...cardRects.map((rect) => rect.height));
      const expectedAssets = ["blend", "soroswap", "aquarius", "balanced"];
      const assetReports = expectedAssets.map((id) => {
        const image = document.querySelector<HTMLImageElement>(
          `[data-testid='integrations-product-card-${id}-asset']`,
        );
        return {
          id,
          src: image?.getAttribute("src") ?? null,
          naturalWidth: image?.naturalWidth ?? 0,
          naturalHeight: image?.naturalHeight ?? 0,
          visible: image
            ? window.getComputedStyle(image).display !== "none" &&
              image.getBoundingClientRect().width > 20 &&
              image.getBoundingClientRect().height > 20
            : false,
        };
      });
      const clippedBrandAssets = Array.from(
        document.querySelectorAll<HTMLElement>(
          ".integrations-product-brand-has-asset",
        ),
      )
        .map((brand) => {
          const rect = brand.getBoundingClientRect();
          const card = brand.closest<HTMLElement>(".integrations-product-card");
          const cardRect = card?.getBoundingClientRect();
          return {
            text: brand.textContent?.trim() ?? "",
            left: Math.round(rect.left),
            right: Math.round(rect.right),
            top: Math.round(rect.top),
            bottom: Math.round(rect.bottom),
            cardLeft: Math.round(cardRect?.left ?? 0),
            cardRight: Math.round(cardRect?.right ?? 0),
            cardTop: Math.round(cardRect?.top ?? 0),
            cardBottom: Math.round(cardRect?.bottom ?? 0),
            clipped:
              Boolean(cardRect) &&
              (rect.left < cardRect!.left - 1 ||
                rect.right > cardRect!.right + 1 ||
                rect.top < cardRect!.top - 1 ||
                rect.bottom > cardRect!.bottom + 1),
          };
        })
        .filter((item) => item.clipped);
      const overflowingActions = Array.from(
        document.querySelectorAll<HTMLElement>(
          ".integrations-product-card-action",
        ),
      )
        .map((action) => {
          const rect = action.getBoundingClientRect();
          const card = action.closest<HTMLElement>(".integrations-product-card");
          const cardRect = card?.getBoundingClientRect();
          return {
            text: action.textContent?.trim() ?? "",
            right: Math.round(rect.right),
            cardRight: Math.round(cardRect?.right ?? 0),
            overflow:
              Boolean(cardRect) &&
              (rect.left < cardRect!.left - 1 ||
                rect.right > cardRect!.right + 1),
          };
        })
        .filter((item) => item.overflow);

      return {
        cardCount: cards.length,
        gridColumns,
        firstRowCount,
        minCardWidth: Math.round(minCardWidth),
        minCardHeight: Math.round(minCardHeight),
        assetReports,
        clippedBrandAssets,
        overflowingActions,
      };
    });

    expect(report.cardCount, JSON.stringify(report, null, 2)).toBeGreaterThanOrEqual(4);
    expect(report.gridColumns, JSON.stringify(report, null, 2)).toBe(4);
    expect(report.firstRowCount, JSON.stringify(report, null, 2)).toBe(4);
    expect(report.minCardWidth, JSON.stringify(report, null, 2)).toBeGreaterThanOrEqual(220);
    expect(report.minCardHeight, JSON.stringify(report, null, 2)).toBeGreaterThanOrEqual(180);
    expect(
      report.assetReports.filter(
        (asset) =>
          !asset.visible ||
          asset.naturalWidth < 40 ||
          asset.naturalHeight < 24 ||
          !asset.src?.startsWith("/figma/integrations/"),
      ),
      JSON.stringify(report, null, 2),
    ).toEqual([]);
    expect(report.clippedBrandAssets, JSON.stringify(report, null, 2)).toEqual([]);
    expect(report.overflowingActions, JSON.stringify(report, null, 2)).toEqual([]);
  });

  test("keeps the Arkas leaderboard title clear of public chrome command controls", async ({
    page,
  }) => {
    await openPublicRoute(page, "/vaults");

    const report = await page.evaluate(() => {
      const titlebar = document.querySelector<HTMLElement>(".vaults-stage-topline");
      const commandBar = document.querySelector<HTMLElement>(".chrome-topbar");
      const commandControls = Array.from(
        document.querySelectorAll<HTMLElement>(
          [
            ".chrome-topbar .chrome-brand-link",
            ".chrome-topbar .chrome-topbar-search",
            ".chrome-topbar .chrome-topbar-actions",
          ].join(","),
        ),
      );
      const isVisible = (element: HTMLElement) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return (
          rect.width > 2 &&
          rect.height > 2 &&
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          style.opacity !== "0"
        );
      };
      const titleRect = titlebar?.getBoundingClientRect();
      const commandRect = commandBar?.getBoundingClientRect();
      const visibleCommandControls = commandControls
        .filter((element) => isVisible(element))
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            text: (element.textContent ?? "").trim(),
            left: Math.round(rect.left),
            top: Math.round(rect.top),
            right: Math.round(rect.right),
            bottom: Math.round(rect.bottom),
          };
        });
      const overlaps =
        titleRect == null
          ? []
          : visibleCommandControls.filter((control) => {
              return !(
                control.right <= titleRect.left ||
                control.left >= titleRect.right ||
                control.bottom <= titleRect.top ||
                control.top >= titleRect.bottom
              );
            });

      return {
        commandBarClass: commandBar?.className ?? "",
        commandBottom: commandRect ? Math.round(commandRect.bottom) : 0,
        titleTop: titleRect ? Math.round(titleRect.top) : 0,
        titlePosition: titlebar ? window.getComputedStyle(titlebar).position : "missing",
        visibleCommandControls,
        overlaps,
      };
    });

    expect(report.commandBarClass, JSON.stringify(report, null, 2)).toContain("chrome-topbar");
    expect(report.titlePosition, JSON.stringify(report, null, 2)).toBe("relative");
    expect(report.visibleCommandControls.length, JSON.stringify(report, null, 2)).toBeGreaterThan(0);
    expect(report.overlaps, JSON.stringify(report, null, 2)).toEqual([]);
    expect(report.titleTop, JSON.stringify(report, null, 2)).toBeGreaterThan(
      report.commandBottom,
    );
  });

  test("keeps all public metric decks semantically keyed and contained", async ({ page }) => {
    const routes = [
      { path: "/assets", operator: false },
      { path: "/vaults", operator: false },
      {
        path: "/vaults/CA7ALPHAQFK2MZKJY4R5S8N2P1T6V9W3X7Y2Z5ABCD1EFGH2345678IJ",
        operator: false,
      },
    ];

    for (const route of routes) {
      if (route.operator) {
        await enableOperatorMode(page);
      }
      await openPublicRoute(page, route.path);
      const report = await auditPublicMetricHeaders(page, route.path);
      expect(report.cardCount, JSON.stringify(report, null, 2)).toBeGreaterThan(0);
      expect(report.missingSemanticClasses, JSON.stringify(report, null, 2)).toEqual([]);
      expect(report.clippedLabels, JSON.stringify(report, null, 2)).toEqual([]);
      expect(report.outOfBoundsLabels, JSON.stringify(report, null, 2)).toEqual([]);
      expect(report.clippedMetricValues, JSON.stringify(report, null, 2)).toEqual([]);
      expect(report.outOfBoundsMetricValues, JSON.stringify(report, null, 2)).toEqual([]);
    }
  });
});
