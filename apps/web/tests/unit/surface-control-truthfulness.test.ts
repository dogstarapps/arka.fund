import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const SURFACE_FILES = [
  "src/components/product/DashboardSurface.tsx",
  "src/components/product/DiscoverSurface.tsx",
  "src/components/product/VaultLeaderboardSurface.tsx",
  "src/components/product/AssetsSurface.tsx",
  "src/components/product/ManagersSurface.tsx",
  "src/components/product/VaultDetailSurface.tsx",
  "src/components/product/ManagerDetailSurface.tsx",
  "src/components/product/AssetDetailSurface.tsx",
  "src/app/arkas/page.tsx",
  "src/app/arkas/[id]/page.tsx",
  "src/app/coverage/page.tsx",
  "src/app/governance/GovernanceClient.tsx",
  "src/app/integrations/IntegrationsClient.tsx",
  "src/app/contracts/page.tsx",
  "src/app/migrations/page.tsx",
  "src/app/ops/page.tsx",
  "src/app/settings/page.tsx",
  "src/app/status/page.tsx",
  "src/app/tiers/page.tsx",
] as const;

const SERVER_ROUTE_FILES = [
  "src/app/api/leaderboard/arkas/route.ts",
  "src/app/api/leaderboard/managers/route.ts",
] as const;

const CREATE_WIZARD_FILES = [
  "src/app/factory/create/CreateArkaClient.tsx",
  "src/app/globals.css",
] as const;

function readSurfaceSource(filePath: string): string {
  return readFileSync(filePath, "utf8");
}

describe("surface control truthfulness", () => {
  it("does not ship placeholder links or unresolved implementation copy", () => {
    const offenders: string[] = [];
    for (const filePath of SURFACE_FILES) {
      const source = readSurfaceSource(filePath);
      if (/href=\{?["'`]#["'`]\}?/.test(source)) {
        offenders.push(`${filePath}: exact # href`);
      }
      if (/href=\{?["'`]javascript:/i.test(source)) {
        offenders.push(`${filePath}: javascript href`);
      }
      if (/\b(TODO|FIXME|lorem|fake|stub|not implemented)\b/i.test(source)) {
        offenders.push(`${filePath}: unresolved implementation copy`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("keeps loading feedback explicit without skeleton placeholders or invented rows", () => {
    const primitiveSource = readSurfaceSource(
      "src/components/product/surfacePrimitives.tsx",
    );
    const styleSource = readSurfaceSource("src/app/globals.css");

    expect(primitiveSource).toContain("SurfaceLoadStatus");
    expect(primitiveSource).toContain('role="status"');
    expect(primitiveSource).toContain('aria-live="polite"');
    expect(styleSource).toContain(".surface-load-status");
    expect(styleSource).not.toMatch(/surface-skeleton|skeleton-row|placeholder-row/i);
  });

  it("keeps visual tab buttons stateful and keyboard-readable", () => {
    const offenders: string[] = [];
    for (const filePath of SURFACE_FILES) {
      const source = readSurfaceSource(filePath);
      const buttonBlocks = source.match(/<button[\s\S]*?<\/button>/g) ?? [];
      for (const block of buttonBlocks) {
        if (!block.includes("surface-tab")) continue;
        if (!/type=["']button["']/.test(block)) {
          offenders.push(`${filePath}: surface-tab button missing type=button`);
        }
        if (!block.includes("aria-pressed")) {
          offenders.push(
            `${filePath}: surface-tab button missing aria-pressed`,
          );
        }
        if (!block.includes("onClick")) {
          offenders.push(`${filePath}: surface-tab button missing onClick`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("keeps Create Arka on the single Figma wizard path without legacy fallback surfaces", () => {
    const forbiddenPatterns = [
      "NEXT_PUBLIC_CREATE_ASSISTANT_LEGACY",
      "create-profile-table",
      "create-plan-table",
      "create-actions-panel",
      "create-assistant-form-card",
      "create-assistant-plan-card",
      "create-assistant-launch-grid",
    ] as const;
    const offenders: string[] = [];

    for (const filePath of CREATE_WIZARD_FILES) {
      const source = readSurfaceSource(filePath);
      for (const pattern of forbiddenPatterns) {
        if (source.includes(pattern)) {
          offenders.push(
            `${filePath}: legacy create wizard surface ${pattern}`,
          );
        }
      }
    }

    const createSource = readSurfaceSource(
      "src/app/factory/create/CreateArkaClient.tsx",
    );
    expect(createSource).toContain('data-testid="create-stepper-rail"');
    expect(createSource).toContain("renderActiveCreateStep()");
    expect(createSource).toContain('data-testid="create-start-panel"');
    expect(createSource).toContain('data-testid="create-profile-panel"');
    expect(createSource).toContain('data-testid="create-fees-panel"');
    expect(createSource).toContain('data-testid="create-assets-management-panel"');
    expect(createSource).toContain('data-testid="create-review-panel"');
    expect(createSource).not.toContain('data-testid="create-deposits-panel"');
    expect(createSource).not.toContain('data-testid="create-redemptions-panel"');
    expect(createSource).not.toContain("buildCreateReviewPreflight");
    expect(createSource).not.toContain('data-testid="create-evidence-rail"');
    expect(createSource).not.toContain('data-testid="create-mandate-visual-board"');
    expect(offenders).toEqual([]);
  });

  it("keeps Create Arka focused on real inputs instead of decorative policy screens", () => {
    const createSource = readSurfaceSource(
      "src/app/factory/create/CreateArkaClient.tsx",
    );

    expect(createSource).toContain('data-testid="create-wallet-connect-button"');
    expect(createSource).toContain('data-testid="create-arka-display-name"');
    expect(createSource).toContain('data-testid="create-arka-deposit-input"');
    expect(createSource).toContain('data-testid="create-assets-management-panel"');
    expect(createSource).not.toContain("CreatePolicyFigmaAsset");
    expect(createSource).not.toContain("deposits-wallet-permission.png");
    expect(createSource).not.toContain("deposits-limits-wallet.png");
  });

  it("keeps Create Arka stage chrome and one compact five-step path", () => {
    const cssSource = readSurfaceSource("src/app/globals.css");
    const createSource = readSurfaceSource(
      "src/app/factory/create/CreateArkaClient.tsx",
    );

    expect(createSource).toContain('className="create-assistant-tab"');
    expect(createSource).toContain("create-stage-banner-soft");
    expect(cssSource).toContain(
      ".create-assistant-shell .create-assistant-tabline",
    );
    expect(cssSource).toContain("grid-template-columns: minmax(14rem, max-content) minmax(0, 1fr) auto");
    expect(cssSource).toContain(".create-assistant-shell .create-assistant-tab::after");
    expect(cssSource).toContain("background: transparent");
    expect(cssSource).toContain(".create-assistant-shell .create-stage-banner-icon::before");
    expect(cssSource).toContain("border-bottom: clamp(1.34rem, 1.7vw, 1.72rem) solid #ffd300");
    expect(createSource).not.toContain("create-${kind}-policy-grid");
    expect(createSource).not.toContain("Redemption Permissions");
    expect(createSource).not.toContain("create-deposits-markline");
    expect(cssSource).toContain(".create-assistant-shell .create-stepper-actions .surface-button");
    expect(cssSource).toContain(".create-assistant-shell .create-stepper-progress .surface-note");
  });

  it("keeps server aggregators away from protected same-origin catalog HTTP reentry", () => {
    const offenders: string[] = [];
    for (const filePath of SERVER_ROUTE_FILES) {
      const source = readSurfaceSource(filePath);
      if (/fetch\([^)]*\/api\/catalog/.test(source)) {
        offenders.push(`${filePath}: direct /api/catalog fetch`);
      }
      if (/new URL\([^)]*\/api\/catalog/.test(source)) {
        offenders.push(`${filePath}: direct /api/catalog URL`);
      }
      if (/fetchCatalogJson/.test(source)) {
        offenders.push(`${filePath}: local fetchCatalogJson helper`);
      }
    }

    expect(offenders).toEqual([]);
  });

  it("keeps Arka execution on stateful workspaces instead of hash-only section anchors", () => {
    const source = readSurfaceSource("src/app/arkas/[id]/page.tsx");

    expect(source).toContain("ARKA_WORKSPACE_TABS");
    expect(source).toContain("setActiveWorkspace");
    expect(source).toContain('data-testid="arka-workspace-tabs"');
    expect(source).not.toMatch(/href=["']#arka-/);
    expect(source).not.toMatch(
      /id=["']arka-(state|flow|execution|credit)-anchor/,
    );
  });

  it("keeps Dashboard on one public summary and one featured Arka collection", () => {
    const source = readSurfaceSource(
      "src/components/product/DashboardSurface.tsx",
    );

    expect(source).toContain('data-testid="dashboard-figma-metric-deck"');
    expect(source).toContain('data-testid="dashboard-arkas-table"');
    expect(source).toContain('data-testid="dashboard-spotlight-tabs"');
    expect(source).not.toContain("DASHBOARD_SECTION_TABS");
    expect(source).not.toContain("buildDashboardSectionCommandDeck");
    expect(source).not.toMatch(/href=["']#dashboard-/);
  });

  it("keeps Discover on one stateful collection instead of duplicate product sections", () => {
    const source = readSurfaceSource(
      "src/components/product/DiscoverSurface.tsx",
    );

    expect(source).toContain('data-testid="discover-feature-tabs"');
    expect(source).toContain('data-testid="discover-figma-preview-grid"');
    expect(source).not.toContain("DISCOVER_SECTION_TABS");
    expect(source).not.toContain("buildDiscoverSectionCommandDeck");
    expect(source).not.toContain('data-testid="discover-section-command-deck"');
    expect(source).not.toMatch(/href=["']#discover-/);
  });

  it("keeps Discover first fold on the T03 geometry contract with product TVL copy", () => {
    const source = readSurfaceSource(
      "src/components/product/DiscoverSurface.tsx",
    );
    const styles = readSurfaceSource("src/app/globals.css");

    expect(source).toContain("discover-t03-first-fold");
    expect(source).toContain("discover-t03-metric-board");
    expect(source).toContain("discover-t03-collection-board");
    expect(source).toContain("discover-t03-toolbar");
    expect(source).toContain('data-testid="discover-summary-grid"');
    expect(source).toContain('data-testid="discover-figma-preview-grid"');
    expect(source).toContain("Performance history will appear after the value changes.");
    expect(styles).toContain("discover-t03-metric-board");
    expect(styles).toContain("discover-t03-collection-board");
    expect(source).toMatch(/\bTVL\b/);
    expect(source).not.toContain("10.1M");
    expect(source).not.toContain("10M");
  });

  it("keeps Dashboard first fold on the T04 geometry contract with real history states", () => {
    const source = readSurfaceSource(
      "src/components/product/DashboardSurface.tsx",
    );
    const styles = readSurfaceSource("src/app/globals.css");

    expect(source).toContain("dashboard-t04-shell");
    expect(source).toContain('data-testid="dashboard-fidelity-shell"');
    expect(source).toContain("dashboard-figma-metric-deck");
    expect(source).toContain("dashboard-discover-collection-board");
    expect(source).toContain("dashboard-t04-feature-card");
    expect(source).toContain('data-testid="dashboard-arkas-table"');
    expect(source).toContain('data-testid="dashboard-spotlight-tabs"');
    expect(source).not.toContain("NAV pending");
    expect(styles).toContain(".dashboard-t04-feature-price-band");
    expect(styles).toContain(".dashboard-t04-feature-price-band");
    expect(source).toMatch(/\bTVL\b/);
    expect(source).not.toContain("10M");
  });

  it("keeps Discover lead labels formatted in catalog helpers, not component heuristics", () => {
    const source = readSurfaceSource(
      "src/components/product/DiscoverSurface.tsx",
    );
    const helperSource = readSurfaceSource(
      "src/lib/catalog/dashboardDiscoverSurfaces.ts",
    );

    expect(helperSource).toContain("data.overview.totalManagers");
    expect(helperSource).toContain("sumVisibleUsdEstimate");
    expect(helperSource).toContain("data.overview.totalAssets");
    expect(helperSource).toContain("entry.whitelistContracts.length");
    expect(helperSource).toContain("entry.denominationContract");
    expect(source).toContain("{tile.detail}");
    expect(source).not.toContain('tile.detail.replace("Lead ", "")');
    expect(source).not.toContain("formatContractLabel(tile.detail");
  });

  it("keeps public dashboard and Discover metric decks Figma-balanced without wrapping active labels", () => {
    const dashboardSource = readSurfaceSource(
      "src/components/product/DashboardSurface.tsx",
    );
    const discoverSource = readSurfaceSource(
      "src/components/product/DiscoverSurface.tsx",
    );
    const styles = readSurfaceSource("src/app/globals.css");
    const dashboardMetricRule =
      [
        ...styles.matchAll(
          /\.dashboard-discover-frame \.dashboard-figma-metric-deck \{[\s\S]*?\}/g,
        ),
      ]
        .map((match) => match[0])
        .find((rule) => rule.includes("0.74fr")) ?? "";
    const discoverMetricRule =
      [...styles.matchAll(/\.discover-stage-grid \{[\s\S]*?\}/g)]
        .map((match) => match[0])
        .find((rule) => rule.includes("repeat(4, minmax(0, 1fr))")) ?? "";
    const metricLabelRule =
      styles.match(
        /\.dashboard-discover-frame \.public-figma-metric-head strong,[\s\S]*?\.discover-fidelity-shell \.public-figma-metric-head strong \{[\s\S]*?\}/,
      )?.[0] ?? "";
    const publicMetricCardRule =
      [
        ...styles.matchAll(
          /\.dashboard-discover-frame \.public-figma-metric-card,[\s\S]*?\.discover-fidelity-shell \.discover-stage-tile \{[\s\S]*?\}/g,
        ),
      ].map((match) => match[0]).at(-1) ?? "";
    const publicMetricHeadRule =
      [
        ...styles.matchAll(
          /\.dashboard-discover-frame \.public-figma-metric-head,[\s\S]*?\.discover-stage-tile-head\.public-figma-metric-head \{[\s\S]*?\}/g,
        ),
      ].map((match) => match[0]).at(-1) ?? "";
    const publicMetricIconRule =
      [
        ...styles.matchAll(
          /\.dashboard-discover-frame \.public-figma-metric-icon,[\s\S]*?\.discover-fidelity-shell \.discover-stage-tile-head \.public-figma-metric-icon \{[\s\S]*?\}/g,
        ),
      ].map((match) => match[0]).at(-1) ?? "";
    const publicMetricValueRule =
      [
        ...styles.matchAll(
          /\.dashboard-discover-frame \.public-figma-metric-value,[\s\S]*?\.discover-stage-tile-value \{[\s\S]*?\}/g,
        ),
      ].map((match) => match[0]).at(-1) ?? "";
    const publicMetricFeesRule =
      styles.match(
        /\.dashboard-discover-frame \.public-figma-metric-card-manager-fees \{[\s\S]*?\}/,
      )?.[0] ?? "";
    const tabRule =
      [
        ...styles.matchAll(
          /\.dashboard-discover-collection-board \.dashboard-discover-tab \{[\s\S]*?\}/g,
        ),
      ]
        .map((match) => match[0])
        .at(-1) ?? "";
    const discoverTitlebarRule =
      [...styles.matchAll(/\.discover-stage-titlebar \{[\s\S]*?\}/g)]
        .map((match) => match[0]);
    const finalNoOverlapTitlebarRule =
      styles.match(
        /\.chrome-shell-public-dashboard \.discover-stage-titlebar,[\s\S]*?\.chrome-shell-public-dashboard \.dashboard-discover-titlebar \{[\s\S]*?\}/,
      )?.[0] ?? "";
    const dashboardFeatureGridRule =
      [
        ...styles.matchAll(
          /\.dashboard-discover-frame \.dashboard-discover-feature-grid \{[\s\S]*?\}/g,
        ),
      ]
        .map((match) => match[0])
        .find((rule) => rule.includes("repeat(3")) ?? "";
    const shellCalibrationRule =
      [...styles.matchAll(/\.chrome-shell-public-dashboard \{[\s\S]*?\}/g)]
        .map((match) => match[0])
        .at(-1) ?? "";
    const publicGridRule =
      [...styles.matchAll(/\.chrome-grid-public-dashboard \{[\s\S]*?\}/g)]
        .map((match) => match[0])
        .at(-1) ?? "";
    expect(dashboardSource).toContain('data-testid="dashboard-fidelity-shell"');
    expect(dashboardMetricRule).toContain("0.74fr");
    expect(dashboardMetricRule).toContain("1.04fr");
    expect(dashboardMetricRule).toContain("1.09fr");
    expect(dashboardMetricRule).toContain("align-items: stretch");
    expect(discoverMetricRule).toContain("repeat(4, minmax(0, 1fr))");
    expect(publicMetricCardRule).toContain("grid-template-columns");
    expect(publicMetricCardRule).toContain("minmax(0, 1fr)");
    expect(publicMetricCardRule).toContain('"label"');
    expect(publicMetricCardRule).toContain('"value"');
    expect(publicMetricCardRule).toContain('"detail"');
    expect(publicMetricFeesRule).toContain('"label"');
    expect(publicMetricFeesRule).toContain('"value"');
    expect(publicMetricFeesRule).toContain('"detail"');
    expect(publicMetricHeadRule).toContain("grid-area: label");
    expect(publicMetricHeadRule).toContain("linear-gradient(100deg");
    expect(publicMetricIconRule).toContain("display: inline-block");
    expect(publicMetricValueRule).toContain("grid-area: value");
    expect(publicMetricValueRule).toContain("justify-self: start");
    expect(publicMetricValueRule).toContain("text-align: left");
    expect(publicMetricValueRule).toContain("white-space: nowrap");
    expect(styles).toContain("minmax(3rem, 1fr) minmax(3.55rem, 42%)");
    expect(styles).toContain("minmax(3.6rem, 1fr) minmax(4.85rem, 46%)");
    expect(styles).toContain("Public Figma metric gradient restoration");
    expect(styles).toContain("text-overflow: clip");
    expect(metricLabelRule).toContain("white-space: nowrap");
    expect(metricLabelRule).toContain("overflow: hidden");
    expect(metricLabelRule).toContain("text-overflow: ellipsis");
    expect(discoverSource.indexOf('data-testid="discover-summary-grid"')).toBeLessThan(
      discoverSource.indexOf('data-testid="discover-stage-toolbar"'),
    );
    expect(discoverSource).toContain('data-testid="discover-stage-titlebar"');
    expect(styles).toContain(".discover-stage-titlebar");
    expect(discoverTitlebarRule.some((rule) => rule.includes("position: absolute"))).toBe(
      true,
    );
    expect(styles).toContain("Public Figma no-overlap hard lock");
    expect(finalNoOverlapTitlebarRule).toContain("position: relative !important");
    expect(finalNoOverlapTitlebarRule).toContain("background: transparent !important");
    expect(finalNoOverlapTitlebarRule).toContain("box-shadow: none !important");
    expect(discoverTitlebarRule.some((rule) => rule.includes("margin:"))).toBe(true);
    expect(tabRule).toContain("min-height: clamp(2.1rem");
    expect(dashboardFeatureGridRule).toContain("repeat(3, minmax(0, 1fr))");
    expect(dashboardFeatureGridRule).toContain("!important");
    expect(styles).toContain("padding-top: clamp(2rem, 2.8vw, 2.9rem)");
    expect(styles).toContain(
      "width: min(1540px, calc(100vw - clamp(8rem, 10.2vw, 9rem)))",
    );
    expect(styles).toContain("Public Figma outer-frame cutover");
    expect(shellCalibrationRule).toContain("width: min(1520px, calc(100vw - 2.8rem))");
    expect(shellCalibrationRule).toContain("padding-top: 1.4rem");
    expect(styles).toContain("transform: translate(-0.56rem, 1.52rem)");
    expect(styles).toContain("transform: translate(0.7rem, 1.48rem)");
    expect(styles).toContain(".chrome-shell-public-dashboard .chrome-grid-public-dashboard");
    expect(styles).toContain("clamp(14.9rem, 17.25vw, 18.4rem)");
    expect(publicGridRule).not.toContain("clamp(20.5rem");
    expect(styles).toContain("Public Discover/Dashboard vertical cutover");
    expect(styles).toContain("min-height: clamp(1.35rem, 1.75vw, 1.92rem) !important");
    expect(styles).toContain("margin-top: clamp(2.62rem, 3.3vw, 3.55rem) !important");
    expect(styles).toContain("Public dashboard metric-header containment cutover, 2026-05-12");
    expect(styles).toContain("No metric values, routes, charts or");
    expect(styles).toContain("grid-column: 3 !important");
    expect(styles).toContain("text-overflow: ellipsis !important");
    expect(dashboardSource).toContain('data-testid="dashboard-figma-metric-deck"');
    expect(dashboardSource).toContain('data-testid="dashboard-arkas-panel"');
    expect(dashboardSource).toContain("public-hero-safe-cutover dashboard-hero-safe-cutover");
    expect(dashboardSource).toContain("public-hero-board-cutover dashboard-hero-board-cutover");
    expect(dashboardSource).toContain("public-hero-titlebar-cutover dashboard-hero-titlebar");
    expect(dashboardSource).toContain("public-hero-metric-deck-cutover dashboard-hero-metric-deck");
    expect(dashboardSource).toContain("public-hero-card-grid-cutover dashboard-hero-card-grid");
    expect(discoverSource).toContain('data-testid="discover-public-metric-board"');
    expect(discoverSource).toContain('data-testid="discover-public-collection-board"');
    expect(discoverSource).toContain("public-hero-safe-cutover discover-hero-safe-cutover");
    expect(discoverSource).toContain("public-hero-board-cutover discover-hero-board-cutover");
    expect(discoverSource).toContain("public-hero-titlebar-cutover discover-hero-titlebar");
    expect(discoverSource).toContain("public-hero-metric-deck-cutover discover-hero-metric-deck");
    expect(discoverSource).toContain("public-hero-card-grid-cutover discover-hero-card-grid");
    expect(discoverSource).toContain("public-hero-toolbar-cutover discover-hero-toolbar");
    expect(discoverSource).toContain("public-screen-safe-zone");
    expect(dashboardSource).toContain("public-screen-safe-zone");
    expect(styles).toContain("Public hero board safe-zone cutover, 2026-05-14");
    expect(styles).toContain("same catalog-backed cards");
    expect(styles).toContain(".chrome-shell-public-dashboard .public-hero-safe-cutover");
    expect(styles).toContain(".chrome-shell-public-dashboard .public-hero-board-cutover");
    expect(styles).toContain(".chrome-shell-public-dashboard .public-hero-titlebar-cutover");
    expect(styles).toContain(".chrome-shell-public-dashboard .public-hero-metric-deck-cutover");
    expect(styles).toContain(".chrome-shell-public-dashboard .public-hero-card-grid-cutover");
    expect(styles).toContain("grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr)) !important");
    expect(styles).toContain("Dashboard two-board final Figma cutover, 2026-05-12");
    expect(styles).toContain('"title route"');
    expect(styles).toContain('"metrics metrics" !important');
    expect(styles).toContain("DashboardSurface data, charts and actions catalog-backed");
    expect(styles).toContain("Public per-screen cutover lock, 2026-05-12");
    expect(styles).toContain("removes the obsolete top command controls");
    expect(styles).toContain("remain catalog-backed by DiscoverSurface/DashboardSurface");
    expect(styles).toContain("height: 0 !important");
    expect(styles).toContain("grid-template-areas:");
    expect(styles).toContain('"discover-title discover-tabs"');
    expect(styles).toContain("grid-area: discover-title !important");
    expect(styles).toContain("pointer-events: none !important");
    expect(styles).toContain("Discover two-board public Figma cutover, 2026-05-12");
    expect(styles).toContain("catalog-backed boards");
    expect(styles).toContain('"discover-public-metrics"');
    expect(styles).toContain('"discover-public-collection" !important');
    expect(discoverSource).toContain('data-testid="discover-figma-card-summary"');
    expect(styles).toContain("Discover featured-card Figma density cutover, 2026-05-12");
    expect(styles).toContain("manager, timestamp, chart path and profile link catalog-backed");
    expect(styles).toContain("Public Dashboard/Discover safe-zone hard cutover, 2026-05-13");
    expect(styles).toContain(".public-screen-safe-zone");
    expect(styles).toContain("contain: layout paint !important");
    expect(styles).toContain("z-index: 4 !important");
    expect(styles).toContain("DiscoverSurface and DashboardSurface keep all NAV");
  });

  it("keeps public TVL labels source-explicit and avoids reused metric glyph groups", () => {
    const helperSource = readSurfaceSource(
      "src/lib/catalog/dashboardDiscoverSurfaces.ts",
    );
    const styles = readSurfaceSource("src/app/globals.css");

    expect(helperSource).toContain('label: "TVL"');
    expect(helperSource).not.toContain('label: "Indexed NAV"');
    expect(helperSource).toContain("total value in USD");
    expect(helperSource).toContain('id: "managers"');
    expect(helperSource).toContain('id: "activity"');
    expect(helperSource).toContain('id: "health"');
    expect(helperSource).toContain('`${bundle.monitoring.snapshotAgeSeconds ?? "n/a"}s since update`');
    expect(helperSource).toContain("need USD pricing before TVL can be shown");
    expect(helperSource).not.toContain("base units");
    expect(helperSource).toContain('id: "assets"');
    expect(helperSource).toContain('id: "curated"');
    expect(helperSource).toContain('id: "routes"');
    expect(helperSource).toContain('id: "base"');
    expect(helperSource).toContain('id: "scope"');
    expect(helperSource).not.toContain('id: "manager-fees"');
    expect(helperSource).not.toContain('id: "protocol-fees"');
    expect(helperSource).toContain('id: "nav"');
    expect(helperSource).not.toContain('id: "tvl"');

    const navIconRule =
      styles.match(
        /\.public-figma-metric-card-nav \.public-figma-metric-icon,[\s\S]*?\.public-figma-metric-card-profit \.public-figma-metric-icon \{[\s\S]*?\}/,
      )?.[0] ?? "";
    const routeIconRule =
      styles.match(
        /\.public-figma-metric-card-routes \.public-figma-metric-icon \{[\s\S]*?\}/,
      )?.[0] ?? "";
    const denominationIconRule =
      styles.match(
        /\.public-figma-metric-card-denomination \.public-figma-metric-icon,[\s\S]*?\.public-figma-metric-card-base \.public-figma-metric-icon \{[\s\S]*?\}/,
      )?.[0] ?? "";
    const withdrawalIconRule =
      styles.match(
        /\.public-figma-metric-card-withdrawals \.public-figma-metric-icon \{[\s\S]*?\}/,
      )?.[0] ?? "";
    const protocolFeesIconRule =
      [
        ...styles.matchAll(
          /\.public-figma-metric-card-protocol-fees \.public-figma-metric-icon::before \{[\s\S]*?\}/g,
        ),
      ]
        .map((match) => match[0])
        .at(-1) ?? "";

    expect(navIconRule).not.toContain("public-figma-metric-card-routes");
    expect(routeIconRule).toContain("border-color: transparent");
    expect(denominationIconRule).toContain("border-color: transparent");
    expect(withdrawalIconRule).toContain("border-radius: 999px");
    expect(protocolFeesIconRule).toContain("rotate(90deg)");
  });

  it("keeps the manager explorer bound to the ranked page without a duplicate table", () => {
    const managerSource = readSurfaceSource(
      "src/components/product/ManagersSurface.tsx",
    );
    const styles = readSurfaceSource("src/app/globals.css");

    expect(managerSource).toContain('data-testid="managers-list"');
    expect(managerSource).toContain("spotlightManagers.map((entry)");
    expect(managerSource).toContain('data-testid="manager-card"');
    expect(managerSource).toContain('href={`/managers/${entry.manager}`}');
    expect(managerSource).toContain("Showing {spotlightManagers.length} managers");
    expect(managerSource).not.toContain("MANAGER_TABLE_PLACEHOLDER");
    expect(managerSource).not.toContain("fakeManagerNav");

    expect(styles).toContain("Managers full result matrix cutover, 2026-05-14");
    expect(styles).toContain("state.data.items");
    expect(styles).toContain(".managers-leaderboard-surface-table-cutover");
    expect(styles).toContain(".managers-leaderboard-row-cutover");
    expect(styles).toContain(
      "T06 Arka/Vault leaderboard row containment closure, 2026-05-18",
    );
    expect(styles).toContain(
      ".managers-fidelity-shell .manager-leaderboard-row-containment",
    );
    expect(styles).toContain(".leaderboard-truncate-token");
    expect(styles).toContain(".manager-row-progress-track");
  });

  it("keeps public detail cutover styling data-backed and anti-placeholder", () => {
    const styles = readSurfaceSource("src/app/globals.css");
    const assetSource = readSurfaceSource(
      "src/components/product/AssetDetailSurface.tsx",
    );
    const managerSource = readSurfaceSource(
      "src/components/product/ManagerDetailSurface.tsx",
    );
    const vaultSource = readSurfaceSource(
      "src/components/product/VaultDetailSurface.tsx",
    );
    const detailSources = [assetSource, managerSource, vaultSource] as const;

    expect(styles).toContain(
      "Public detail profile frame cutover, 2026-05-14",
    );
    expect(styles).toContain("remain catalog/API backed");
    expect(styles).toContain(".public-detail-shell-cutover");
    expect(styles).toContain(".public-detail-related-grid-cutover");
    expect(styles).toContain(".public-detail-table-cutover");
    expect(styles).toContain("grid-template-columns: minmax(0, 1fr) !important");

    expect(assetSource).toContain("loadAssetDetailBundle");
    expect(assetSource).toContain("loadCoreStellarAssetRegistry");
    expect(managerSource).toContain("loadManagerDetailBundle");
    expect(vaultSource).toContain("loadArkaDetailBundle");

    for (const source of detailSources) {
      expect(source).toContain("public-detail-shell-cutover");
      expect(source).toContain("public-detail-panel-cutover");
      expect(source).toContain("public-detail-related-card-cutover");
      expect(source).not.toContain("fakeDetailMetric");
      expect(source).not.toContain("placeholderDetailCard");
      expect(source).not.toContain("visualOnlyDetailRoute");
    }
  });

  it("keeps every public metric deck keyed by semantic metric id for Figma icon containment", () => {
    const publicMetricRenderers = [
      "src/components/product/DashboardSurface.tsx",
      "src/components/product/DiscoverSurface.tsx",
      "src/components/product/VaultLeaderboardSurface.tsx",
      "src/components/product/VaultDetailSurface.tsx",
      "src/components/product/AssetsSurface.tsx",
      "src/app/integrations/IntegrationsClient.tsx",
    ];
    const styles = readSurfaceSource("src/app/globals.css");
    const requiredMetricIconClasses = [
      "managed",
      "nav",
      "footprint",
      "coverage",
      "leaderShare",
      "leadShare",
      "indexed",
      "balanceSheet",
      "portfolio",
      "leader",
      "wallet",
      "fees",
      "activity",
      "health",
      "auto",
      "sodax",
      "balanced",
      "mainnet",
      "withdrawals",
      "deposits",
      "manager-fees",
      "protocol-fees",
      "base",
      "scope",
      "curated",
      "whitelist",
      "assetSpan",
      "debtLinked",
    ];

    for (const filePath of publicMetricRenderers) {
      expect(readSurfaceSource(filePath), filePath).toContain(
        "public-figma-metric-card-${tile.id}",
      );
    }

    for (const metricId of requiredMetricIconClasses) {
      expect(styles, metricId).toContain(
        `.public-figma-metric-card-${metricId} .public-figma-metric-icon`,
      );
    }

    expect(styles).toMatch(
      /\.assets-fidelity-shell \.assets-public-metric-deck \{[\s\S]*?grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);[\s\S]*?\}/,
    );
    expect(styles).toMatch(
      /@media \(max-width: 1024px\) \{[\s\S]*?\.assets-fidelity-shell \.assets-public-metric-deck \{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);[\s\S]*?\}[\s\S]*?\}/,
    );
    expect(styles).toMatch(
      /@media \(max-width: 760px\) \{[\s\S]*?\.assets-fidelity-shell \.assets-public-metric-deck \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\);[\s\S]*?\}[\s\S]*?\}/,
    );
  });

  it("keeps Vault detail tabs and public metrics routed and data-backed", () => {
    const source = readSurfaceSource(
      "src/components/product/VaultDetailSurface.tsx",
    );
    const helperSource = readSurfaceSource("src/lib/catalog/vaults.ts");
    const styles = readSurfaceSource("src/app/globals.css");

    expect(source).toContain("buildVaultDetailPublicMetricDeck");
    expect(source).toContain('data-testid="vault-detail-public-metric-deck"');
    expect(source).toContain('data-testid="vault-detail-tabs"');
    expect(source).toContain("vault-detail-tab-panel vault-overview-grid");
    expect(source).toContain("vault-detail-tab-panel vault-portfolio-grid");
    expect(source).toContain("vault-detail-tab-panel vault-activity-grid");
    expect(source).toContain("vault-detail-tab-panel vault-policies-grid");
    expect(source).toContain("vault-tab-workspace-panel vault-overview-history-panel");
    expect(source).toContain("vault-tab-workspace-panel vault-portfolio-composition-panel");
    expect(source).toContain("vault-tab-workspace-panel vault-activity-summary-panel");
    expect(source).toContain("vault-tab-workspace-panel vault-policies-fees-panel");
    expect(helperSource).toContain("export function buildVaultDetailPublicMetricDeck");
    expect(source).not.toContain('data-testid="vault-detail-command-deck"');
    expect(source).not.toMatch(/href=["']#vault-/);
    expect(styles).toContain("Vault detail visual cutover, 2026-05-13");
    expect(styles).toContain(".vault-detail-fidelity-shell .vault-detail-profile-visual");
    expect(styles).toContain('"copy orbit"');
    expect(styles).toContain('"evidence evidence"');
    expect(styles).toContain(".vault-detail-fidelity-shell .vault-detail-command-deck");
    expect(styles).toContain("Vault detail tab-panel visual cutover, 2026-05-14");
    expect(styles).toContain("same catalog bundle");
    expect(styles).toContain(".vault-detail-fidelity-shell .vault-detail-tab-panel");
    expect(styles).toContain(".vault-detail-fidelity-shell .vault-tab-workspace-panel");
    expect(styles).toContain(".vault-detail-fidelity-shell .vault-portfolio-shell");
    expect(styles).toContain(".vault-detail-fidelity-shell .vault-activity-feed");
    expect(styles).toContain(".vault-detail-fidelity-shell .vault-whitelist-grid");
    expect(styles).toMatch(
      /\.vault-detail-fidelity-shell \.vault-detail-command-deck \{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\) !important;[\s\S]*?\}/,
    );
    expect(styles).toMatch(
      /@media \(max-width: 720px\) \{[\s\S]*?\.vault-detail-fidelity-shell \.vault-detail-public-metric-deck,[\s\S]*?\.vault-detail-fidelity-shell \.vault-detail-command-deck,[\s\S]*?\.vault-detail-fidelity-shell \.vault-detail-profile-evidence \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\) !important;[\s\S]*?\}/,
    );
  });

  it("keeps Asset and Manager detail routes on route-scoped product-frame cutovers", () => {
    const assetSource = readSurfaceSource(
      "src/components/product/AssetDetailSurface.tsx",
    );
    const managerSource = readSurfaceSource(
      "src/components/product/ManagerDetailSurface.tsx",
    );
    const styles = readSurfaceSource("src/app/globals.css");

    expect(assetSource).toContain("asset-detail-fidelity-shell");
    expect(assetSource).toContain("asset-detail-core-fallback-shell");
    expect(assetSource).toContain('data-testid="asset-detail-stage-grid"');
    expect(assetSource).toContain("explorer-detail-stage-grid");
    expect(assetSource).toContain("explorer-detail-stage-cutover asset-detail-stage-cutover");
    expect(assetSource).toContain("explorer-detail-panel explorer-detail-history-panel");
    expect(assetSource).toContain("explorer-detail-panel explorer-detail-risk-panel");
    expect(assetSource).toContain("explorer-detail-panel explorer-detail-linked-panel explorer-related-panel-cutover asset-detail-linked-cutover");
    expect(assetSource).toContain("asset-detail-arkas-grid explorer-related-grid-cutover");
    expect(assetSource).toContain('data-testid="asset-detail-arkas-table"');

    expect(managerSource).toContain("manager-detail-fidelity-shell");
    expect(managerSource).toContain('data-testid="manager-detail-stage-grid"');
    expect(managerSource).toContain("explorer-detail-stage-grid");
    expect(managerSource).toContain("explorer-detail-stage-cutover manager-detail-stage-cutover");
    expect(managerSource).toContain("explorer-detail-panel explorer-detail-history-panel");
    expect(managerSource).not.toContain("manager-detail-coverage-panel");
    expect(managerSource).toContain("explorer-detail-panel explorer-detail-linked-panel explorer-related-panel-cutover manager-detail-linked-cutover");
    expect(managerSource).toContain("manager-detail-arkas-grid explorer-related-grid-cutover");
    expect(managerSource).toContain('data-testid="manager-detail-arkas-table"');
    expect(managerSource).toContain('data-testid="manager-detail-arkas-pagination"');

    expect(styles).toContain("Asset and manager detail product-frame cutover, 2026-05-13");
    expect(styles).toContain("runtime data");
    expect(styles).toContain(".asset-detail-fidelity-shell .control-room-signal-grid");
    expect(styles).toContain(".manager-detail-fidelity-shell .control-room-signal-grid");
    expect(styles).toContain("grid-template-columns: repeat(3, minmax(0, 1fr)) !important");
    expect(styles).toContain(".asset-detail-fidelity-shell .explorer-detail-stage-grid");
    expect(styles).toContain(".manager-detail-fidelity-shell .explorer-detail-stage-grid");
    expect(styles).toContain("grid-template-columns: repeat(2, minmax(0, 1fr)) !important");
    expect(styles).toContain(".asset-detail-fidelity-shell .asset-detail-arkas-grid");
    expect(styles).toContain(".manager-detail-fidelity-shell .manager-detail-arkas-grid");
    expect(styles).toContain(".asset-detail-fidelity-shell .surface-table-row.asset-detail-risk-table");
    expect(styles).toContain(".manager-detail-fidelity-shell .surface-table-row.manager-detail-coverage-table");
    expect(styles).toContain(".asset-detail-core-fallback-shell .surface-actions");
    expect(styles).toContain("Asset and manager detail lane cutover, 2026-05-14");
    expect(styles).toContain("same catalog-backed routes");
    expect(styles).toContain(".asset-detail-fidelity-shell .explorer-detail-stage-cutover");
    expect(styles).toContain(".manager-detail-fidelity-shell .explorer-detail-stage-cutover");
    expect(styles).toContain(".asset-detail-fidelity-shell .explorer-related-grid-cutover");
    expect(styles).toContain(".manager-detail-fidelity-shell .explorer-related-grid-cutover");
    expect(styles).toContain("grid-template-columns: minmax(0, 1fr) !important");
    expect(styles).toContain("repeat(auto-fit, minmax(min(100%, 18.75rem), 1fr)) !important");
    expect(styles).toContain("@media (max-width: 1180px)");
    expect(styles).toContain("@media (max-width: 760px)");
    expect(styles).toContain("white-space: nowrap !important");
    expect(styles).not.toContain("visualOnlyAssetDetailCards");
    expect(styles).not.toContain("visualOnlyManagerDetailCards");
  });

  it("keeps Arka leaderboard rows actionable and metric-backed", () => {
    const source = readSurfaceSource(
      "src/components/product/VaultLeaderboardSurface.tsx",
    );

    expect(source).toContain("buildVaultPublicMetricDeck");
    expect(source).toContain('data-testid="vaults-public-metric-deck"');
    expect(source).toContain('data-testid="vault-leaderboard-card"');
    expect(source).toContain('data-testid="vault-row-actions"');
  });

  it("keeps Assets on one searchable, mode-switchable collection", () => {
    const source = readSurfaceSource(
      "src/components/product/AssetsSurface.tsx",
    );
    const styles = readSurfaceSource("src/app/globals.css");

    expect(source).toContain("assets-fidelity-shell");
    expect(source).toContain('data-testid="assets-list"');
    expect(source).toContain('data-testid="assets-spotlight-tabs"');
    expect(source).toContain('data-testid="asset-card"');
    expect(source).toContain("assets-command-panel-cutover");
    expect(source).toContain("assets-command-toolbar-cutover");
    expect(source).not.toContain('testId="assets-leaderboard-table"');
    expect(source).not.toContain("assets-telemetry-workspace-panel");
    expect(styles).toContain(".assets-fidelity-shell .surface-tab-strip");
    expect(styles).toContain("@media (max-width: 1024px)");
  });

  it("keeps public explorer refresh states measurable without replacing real data", () => {
    const discoverSource = readSurfaceSource(
      "src/components/product/DiscoverSurface.tsx",
    );
    const assetsSource = readSurfaceSource(
      "src/components/product/AssetsSurface.tsx",
    );
    const managersSource = readSurfaceSource(
      "src/components/product/ManagersSurface.tsx",
    );
    const vaultsSource = readSurfaceSource(
      "src/components/product/VaultLeaderboardSurface.tsx",
    );

    expect(discoverSource).toContain('data-testid="discover-fidelity-shell"');
    expect(discoverSource).toContain('testId="discover-refresh-status"');
    expect(discoverSource).toContain("Boolean(state.data)");
    expect(assetsSource).toContain('data-testid="assets-fidelity-shell"');
    expect(assetsSource).toContain('testId="assets-refresh-status"');
    expect(assetsSource).toContain("Boolean(state.data)");
    expect(managersSource).toContain('data-testid="managers-fidelity-shell"');
    expect(managersSource).toContain('testId="managers-refresh-status"');
    expect(managersSource).toContain("Boolean(state.data)");
    expect(vaultsSource).toContain('data-testid="vaults-fidelity-shell"');
    expect(vaultsSource).toContain('testId="vaults-refresh-note"');
    expect(vaultsSource).toContain("Boolean(state.data)");
  });

  it("keeps the Arkas leaderboard lower frame stacked and data-backed", () => {
    const vaultsSource = readSurfaceSource(
      "src/components/product/VaultLeaderboardSurface.tsx",
    );
    const styles = readSurfaceSource("src/app/globals.css");

    expect(vaultsSource).toContain("vaults-stage-panel-cutover");
    expect(vaultsSource).toContain("vaults-leaderboard-panel-cutover");
    expect(vaultsSource).toContain("vaults-listing-toolbar-cutover");
    expect(vaultsSource).toContain("vaults-leaderboard-table-cutover");
    expect(vaultsSource).toContain("vault-leaderboard-card-cutover");
    expect(vaultsSource).toContain("vault-leaderboard-row-containment");
    expect(vaultsSource).toContain('data-row-containment="bounded"');
    expect(vaultsSource).toContain('data-testid="vault-row-arka-id"');
    expect(vaultsSource).toContain('title={row.arkaId}');
    expect(vaultsSource).toContain('data-full-value={row.arkaId}');
    expect(vaultsSource).toContain('data-testid="vault-row-base-contract"');
    expect(vaultsSource).toContain('data-testid="vault-row-actions"');
    expect(vaultsSource).toContain('data-testid="vaults-public-metric-deck"');
    expect(vaultsSource).not.toContain('data-testid="vaults-lower-stack"');
    expect(styles).toContain("Vaults/Assets listing-frame final cutover, 2026-05-14");
    expect(styles).toContain(".vaults-fidelity-shell .vaults-leaderboard-table-cutover");
    expect(styles).toContain(".vaults-fidelity-shell .vault-leaderboard-card-cutover");
    expect(styles).toContain(
      "T06 Arka/Vault leaderboard row containment closure, 2026-05-18",
    );
    expect(styles).toContain(
      ".vaults-fidelity-shell .vault-leaderboard-row-containment",
    );
    expect(styles).toContain(".leaderboard-truncate-token");
    expect(styles).toContain(
      "grid-template-columns: minmax(0, 1fr) !important",
    );
    expect(styles).toContain("@media (max-width: 1180px)");
    expect(styles).toContain("@media (max-width: 760px)");
    expect(styles).toContain("runtime data");
  });

  it("keeps Coverage on stateful workspaces instead of hash-only section anchors", () => {
    const source = readSurfaceSource("src/app/coverage/page.tsx");

    expect(source).toContain("COVERAGE_WORKSPACE_TABS");
    expect(source).toContain("setActiveWorkspace");
    expect(source).toContain('data-testid="coverage-workspace-tabs"');
    expect(source).not.toMatch(/href=["']#coverage-/);
  });

  it("keeps Governance and Coverage command lanes stacked without changing runtime handlers", () => {
    const coverageSource = readSurfaceSource("src/app/coverage/page.tsx");
    const governanceSource = readSurfaceSource("src/app/governance/GovernanceClient.tsx");
    const styles = readSurfaceSource("src/app/globals.css");

    expect(coverageSource).toContain('data-testid="coverage-command-grid"');
    expect(coverageSource).toContain('data-testid="coverage-stake-panel"');
    expect(coverageSource).toContain("coverage-actions-frame-cutover");
    expect(coverageSource).toContain("onClick={onStake}");
    expect(coverageSource).toContain("onClick={onUnstake}");
    expect(coverageSource).toContain("onClick={onClaim}");

    expect(governanceSource).toContain('data-testid="governance-composer-grid"');
    expect(governanceSource).toContain('data-testid="governance-lifecycle-layout"');
    expect(governanceSource).toContain("governance-composer-frame-cutover");
    expect(governanceSource).toContain("governance-lifecycle-frame-cutover");
    expect(governanceSource).toContain("governance-command-card-cutover");
    expect(governanceSource).toContain("governance-lifecycle-command-deck");
    expect(governanceSource).toContain("activateLifecycleCommand(command.id)");
    expect(governanceSource).toContain("queueComposerPackageForGovernance");
    expect(governanceSource).toContain("GovernanceHandoffAction");

    expect(styles).toContain(
      "Governance/Coverage command lane visual cutover, 2026-05-13",
    );
    expect(styles).toContain(
      "wallet/on-chain handlers and runtime values",
    );
    expect(styles).toContain(".governance-fidelity-shell .governance-composer-grid");
    expect(styles).toContain(".governance-fidelity-shell .governance-lifecycle-layout");
    expect(styles).toContain(".coverage-fidelity-shell .coverage-command-grid");
    expect(styles).toContain('grid-template-areas:');
    expect(styles).toContain('"index copy action"');
    expect(styles).toContain('"index readiness readiness" !important');
    expect(styles).toContain(".coverage-fidelity-shell .coverage-secondary-action-grid");
    expect(styles).toContain(
      "Governance/Coverage final command-frame cutover, 2026-05-14",
    );
    expect(styles).toContain("forms, preview JSON, lifecycle commands and coverage fund actions");
    expect(styles).toContain(".governance-fidelity-shell .governance-command-frame");
    expect(styles).toContain(".coverage-fidelity-shell .coverage-command-frame");
    expect(styles).toContain(".governance-fidelity-shell .governance-lifecycle-command-deck");
    expect(styles).toContain(".coverage-fidelity-shell .coverage-secondary-action-stack-cutover");
    expect(styles).toContain("grid-template-columns: minmax(0, 1fr) !important");
    expect(styles).toContain("@media (max-width: 1180px)");
    expect(styles).toContain("@media (max-width: 680px)");
    expect(styles).not.toContain("visualOnlyGovernanceCommands");
    expect(styles).not.toContain("visualOnlyCoverageActions");
  });

  it("keeps Integrations split into routed protocol commands and compact detail views", () => {
    const source = readSurfaceSource("src/app/integrations/IntegrationsClient.tsx");
    const helperSource = readSurfaceSource(
      "src/lib/workflows/integrationWorkspaces.ts",
    );

    expect(source).toContain("buildIntegrationProtocolCommandDeck");
    expect(source).toContain("INTEGRATION_ROUTING_VIEW_TABS");
    expect(source).toContain('data-testid="integrations-command-deck"');
    expect(source).toContain('data-testid="integrations-routing-view-tabs"');
    expect(source).toContain("integrations-command-${command.id}-link");
    expect(helperSource).toContain("buildIntegrationProtocolCommandDeck");
    expect(helperSource).toContain('href: "/arkas"');
    expect(source).not.toMatch(/href=["']#integrations-/);
  });

  it("keeps the Integrations/operator visual cutover readable without changing runtime data", () => {
    const styles = readSurfaceSource("src/app/globals.css");
    const integrationsSource = readSurfaceSource("src/app/integrations/IntegrationsClient.tsx");
    const statusSource = readSurfaceSource("src/app/status/page.tsx");
    const coverageSource = readSurfaceSource("src/app/coverage/page.tsx");
    const tiersSource = readSurfaceSource("src/app/tiers/page.tsx");

    expect(styles).toContain("Integrations/operator route visual cutover, 2026-05-13");
    expect(styles).toContain("Integrations Figma asset cutover, 2026-05-13");
    expect(styles).toContain("Contracts/Integrations command-frame audit cutover, 2026-05-14");
    expect(styles).toContain(".integrations-fidelity-shell .integrations-product-card-grid");
    expect(styles).toContain("grid-template-columns: repeat(4, minmax(0, 1fr)) !important");
    expect(styles).toContain(".integrations-fidelity-shell .integrations-product-brand-asset");
    expect(styles).toContain("@media (min-width: 1281px) and (max-width: 1440px)");
    expect(styles).toContain(".integrations-fidelity-shell .integrations-command-deck");
    expect(styles).toContain(".integrations-fidelity-shell .integrations-routing-table-cutover");
    expect(styles).toContain(".integrations-fidelity-shell .integrations-balanced-intent-card-cutover");
    expect(styles).toContain("grid-template-columns: repeat(2, minmax(0, 1fr)) !important");
    expect(styles).toContain(".operator-workspace-stage.control-room-stage-grid");
    expect(styles).toContain("grid-template-columns: minmax(0, 1fr) !important");
    expect(styles).toContain("@media (max-width: 1440px)");
    expect(styles).toContain("@media (max-width: 760px)");
    expect(integrationsSource).toContain("INTEGRATION_FIGMA_BRAND_ASSETS");
    expect(integrationsSource).toContain('AQUARIUS: "/figma/integrations/aquarius.png"');
    expect(integrationsSource).toContain('BALANCED: "/figma/integrations/balanced.png"');
    expect(integrationsSource).toContain('BLEND: "/figma/integrations/blend.png"');
    expect(integrationsSource).toContain('SOROSWAP: "/figma/integrations/soroswap.png"');
    expect(integrationsSource).toContain("integrations-product-brand-asset");
    expect(integrationsSource).toContain("integrations-workspace-frame-cutover");
    expect(integrationsSource).toContain("integrations-routing-table-cutover");
    expect(integrationsSource).toContain("integrations-balanced-intent-card-cutover");
    expect(integrationsSource).toContain("integrationProtocolCatalogCards.map");
    expect(integrationsSource).toContain("integrationProtocolCommands.map");
    expect(integrationsSource).toContain("integrationWorkspaceState.signals.map");
    expect(integrationsSource).not.toContain("visualOnlyProtocolCards");
    expect(statusSource).toContain('data-testid="status-workspace-summary"');
    expect(coverageSource).toContain('testId="coverage-overview-panel"');
    expect(tiersSource).toContain('data-testid="tiers-workspace-summary"');
  });

  it("keeps the Settings/Status utility cutover visual-only and data-backed", () => {
    const styles = readSurfaceSource("src/app/globals.css");
    const settingsSource = readSurfaceSource("src/app/settings/page.tsx");
    const statusSource = readSurfaceSource("src/app/status/page.tsx");

    expect(styles).toContain(
      "Settings/Status utility lane visual cutover, 2026-05-13",
    );
    expect(styles).toContain(".settings-fidelity-shell .settings-utility-grid");
    expect(styles).toContain(".status-fidelity-shell .status-utility-grid");
    expect(styles).toContain(".settings-fidelity-shell .settings-raw-workspace-panel .surface-code-block");
    expect(styles).toContain(".status-fidelity-shell .status-routing-benchmark-table");
    expect(styles).toContain("@media (max-width: 760px)");

    expect(settingsSource).toContain("settings-fidelity-shell");
    expect(settingsSource).toContain('data-testid="settings-utility-grid"');
    expect(settingsSource).toContain("settings-config-workspace-panel");
    expect(settingsSource).toContain("settings-guardrails-workspace-panel");
    expect(settingsSource).toContain("settings-raw-workspace-panel");
    expect(settingsSource).toContain("readAppHealthSnapshot");
    expect(settingsSource).toContain("buildSettingsGroups(env)");
    expect(settingsSource).not.toContain("visualOnlySettingsRows");

    expect(statusSource).toContain("status-fidelity-shell");
    expect(statusSource).toContain('data-testid="status-utility-grid"');
    expect(statusSource).toContain("status-runtime-health-card status-command-card");
    expect(statusSource).toContain("status-routing-workspace-panel");
    expect(statusSource).toContain("readAppHealthSnapshot");
    expect(statusSource).toContain("readRebalanceBenchmarkSnapshot");
    expect(statusSource).not.toContain("visualOnlyStatusRows");
  });

  it("keeps Ops/Migrations/Tiers visual cutovers on real runtime lanes", () => {
    const styles = readSurfaceSource("src/app/globals.css");
    const opsSource = readSurfaceSource("src/app/ops/page.tsx");
    const migrationsSource = readSurfaceSource("src/app/migrations/page.tsx");
    const tiersSource = readSurfaceSource("src/app/tiers/page.tsx");

    expect(styles).toContain(
      "Ops/Migrations/Tiers utility lane visual cutover, 2026-05-13",
    );
    expect(styles).toContain(".ops-fidelity-shell .ops-utility-grid");
    expect(styles).toContain(".migrations-fidelity-shell .migrations-utility-grid");
    expect(styles).toContain(".tiers-fidelity-shell .tiers-utility-grid");
    expect(styles).toContain(".migrations-fidelity-shell .surface-code-block");
    expect(styles).toContain(".tiers-fidelity-shell .tiers-runtime-read-card .surface-spotlight-head");

    expect(opsSource).toContain("ops-fidelity-shell");
    expect(opsSource).toContain("ops-utility-grid");
    expect(opsSource).toContain("ops-health-workspace-panel");
    expect(opsSource).toContain("ops-routing-workspace-panel");
    expect(opsSource).toContain("ops-runbook-workspace-panel");
    expect(opsSource).toContain("isGovernorReadable");
    expect(opsSource).toContain("readAdapterRouter");
    expect(opsSource).not.toContain("visualOnlyOpsRows");

    expect(migrationsSource).toContain("migrations-fidelity-shell");
    expect(migrationsSource).toContain("migrations-utility-grid");
    expect(migrationsSource).toContain("migration-plan-workspace-panel");
    expect(migrationsSource).toContain("migration-simulation-workspace-panel");
    expect(migrationsSource).toContain("migration-handoff-workspace-panel");
    expect(migrationsSource).toContain('fetch("/api/migrations/simulate"');
    expect(migrationsSource).toContain("writeGovernedComposerDraft");
    expect(migrationsSource).not.toContain("visualOnlyMigrationRows");

    expect(tiersSource).toContain("tiers-fidelity-shell");
    expect(tiersSource).toContain("tiers-utility-grid");
    expect(tiersSource).toContain("tiers-command-card");
    expect(tiersSource).toContain("tiers-scorecard-workspace-panel");
    expect(tiersSource).toContain("tiers-actions-workspace-panel");
    expect(tiersSource).toContain("buildManagerTierAddPoints");
    expect(tiersSource).toContain("submitSignedTx");
    expect(tiersSource).not.toContain("visualOnlyTierRows");
  });

  it("keeps Contracts control-center cutover on real typed/raw and lifecycle lanes", () => {
    const styles = readSurfaceSource("src/app/globals.css");
    const contractsSource = readSurfaceSource("src/app/contracts/page.tsx");

    expect(styles).toContain(
      "Contracts control-center visual cutover, 2026-05-13",
    );
    expect(styles).toContain(".contracts-fidelity-shell .contracts-execution-grid");
    expect(styles).toContain(".contracts-fidelity-shell .contracts-control-table-cutover");
    expect(styles).toContain(".contracts-fidelity-shell .contracts-audit-table-cutover");
    expect(styles).toContain(".contracts-fidelity-shell .contracts-mutation-matrix-table");
    expect(styles).toContain(".contracts-fidelity-shell .contracts-storage-lifecycle-table");
    expect(styles).toContain("@media (max-width: 760px)");

    expect(contractsSource).toContain("contracts-fidelity-shell");
    expect(contractsSource).toContain("contracts-operator-summary");
    expect(contractsSource).toContain("contracts-execution-grid");
    expect(contractsSource).toContain("contracts-typed-workspace-panel");
    expect(contractsSource).toContain("contracts-command-frame-cutover");
    expect(contractsSource).toContain("contracts-audit-row-cutover");
    expect(contractsSource).toContain("contracts-raw-workspace-panel");
    expect(contractsSource).toContain("contracts-mutation-workspace-panel");
    expect(contractsSource).toContain("contracts-storage-workspace-panel");
    expect(contractsSource).toContain("buildContractsMutationMatrixSnapshot");
    expect(contractsSource).toContain("buildContractsStorageLifecycleSnapshot");
    expect(contractsSource).toContain('fetch("/api/contracts/mutation-matrix"');
    expect(contractsSource).toContain('fetch("/api/contracts/storage-lifecycle"');
    expect(contractsSource).toContain("shouldBlockTypedWrite");
    expect(contractsSource).toContain("shouldBlockRawWrite");
    expect(contractsSource).not.toContain("visualOnlyContractRows");
    expect(contractsSource).not.toContain("fakeContractMatrix");
  });

  it("keeps Assets and Managers public indexes in bounded data-backed cutover lanes", () => {
    const styles = readSurfaceSource("src/app/globals.css");
    const assetsSource = readSurfaceSource(
      "src/components/product/AssetsSurface.tsx",
    );
    const managersSource = readSurfaceSource(
      "src/components/product/ManagersSurface.tsx",
    );

    expect(styles).toContain(
      "Assets/Managers public index visual cutover, 2026-05-13",
    );
    expect(styles).toContain(".assets-fidelity-shell .assets-workspace-grid");
    expect(styles).toContain(".managers-fidelity-shell .managers-workspace-grid");
    expect(styles).toContain(".assets-fidelity-shell .assets-command-toolbar");
    expect(styles).toContain(".managers-fidelity-shell .managers-command-toolbar");
    expect(styles).toContain("Managers filter deck alignment closure, 2026-05-18");
    expect(styles).toContain(".managers-fidelity-shell .managers-filter-deck-cutover");
    expect(styles).toContain(".managers-fidelity-shell .managers-filter-primary-row");
    expect(styles).toContain(".assets-fidelity-shell .assets-core-registry-grid");
    expect(styles).toContain(".managers-fidelity-shell .managers-operator-summary");
    expect(styles).toContain("grid-template-columns: minmax(0, 1fr) !important");
    expect(styles).toContain("No asset, manager, NAV, scope or");

    expect(assetsSource).toContain("assets-fidelity-shell");
    expect(assetsSource).toContain('data-testid="assets-workspace-grid"');
    expect(assetsSource).toContain("assets-core-registry-workspace-panel");
    expect(assetsSource).toContain("assets-list-workspace-panel");
    expect(assetsSource).not.toContain("assets-telemetry-workspace-panel");
    expect(assetsSource).toContain("loadAssetsPage");
    expect(assetsSource).toContain("loadCoreStellarAssetRegistry");
    expect(assetsSource).not.toContain("visualOnlyAssetRows");
    expect(assetsSource).not.toContain("fakeAssetMetrics");

    expect(managersSource).toContain("managers-fidelity-shell");
    expect(managersSource).toContain("managers-operator-summary");
    expect(managersSource).toContain('data-testid="managers-workspace-grid"');
    expect(managersSource).toContain("managers-list-workspace-panel");
    expect(managersSource).toContain("managers-command-toolbar");
    expect(managersSource).toContain("managers-filter-deck-cutover");
    expect(managersSource).toContain('data-testid="managers-filter-primary-row"');
    expect(managersSource).not.toContain('data-testid="managers-filter-status-row"');
    expect(managersSource).not.toContain("managers-telemetry-workspace-panel");
    expect(managersSource).toContain("loadManagersResolvedPage");
    expect(managersSource).not.toContain("visualOnlyManagerRows");
    expect(managersSource).not.toContain("fakeManagerMetrics");
  });

  it("keeps transaction review rails bounded without replacing wallet-backed handlers", () => {
    const styles = readSurfaceSource("src/app/globals.css");
    const primitiveSource = readSurfaceSource(
      "src/components/product/surfacePrimitives.tsx",
    );
    const governanceSource = readSurfaceSource("src/app/governance/GovernanceClient.tsx");
    const coverageSource = readSurfaceSource("src/app/coverage/page.tsx");
    const contractsSource = readSurfaceSource("src/app/contracts/page.tsx");

    expect(primitiveSource).toContain("transaction-surface-review-card");
    expect(primitiveSource).toContain("transaction-surface-rail");
    expect(primitiveSource).toContain("transaction-surface-confirm-dialog");
    expect(primitiveSource).toContain('data-testid="transaction-confirm-dialog"');
    expect(primitiveSource).toContain('role="dialog"');
    expect(primitiveSource).toContain('aria-modal="true"');

    expect(styles).toContain(
      "Transactional review/confirmation rail cutover, 2026-05-14",
    );
    expect(styles).toContain(
      "same Soroban builders, wallet confirmation handlers, DAO guards and runtime",
    );
    expect(styles).toContain(
      ".governance-fidelity-shell .transaction-surface-review-card",
    );
    expect(styles).toContain(
      ".coverage-fidelity-shell .transaction-surface-review-card",
    );
    expect(styles).toContain(
      ".contracts-fidelity-shell .transaction-surface-review-card",
    );
    expect(styles).toContain(
      ".transaction-surface-confirm-dialog .transaction-dialog-actions",
    );
    expect(styles).toContain("max-height: calc(100dvh");
    expect(styles).toContain("grid-template-columns: repeat(2, minmax(0, 1fr)) !important");
    expect(styles).toContain("overflow-wrap: anywhere !important");

    expect(governanceSource).toContain("buildGovernorVote");
    expect(governanceSource).toContain("buildGovernorClose");
    expect(governanceSource).toContain("buildGovernorExecute");
    expect(governanceSource).toContain("setConfirmIntent(commandId)");
    expect(governanceSource).toContain("TransactionConfirmDialog");
    expect(coverageSource).toContain("buildCoverageFundStake");
    expect(coverageSource).toContain("buildCoverageFundUnstake");
    expect(coverageSource).toContain("buildCoverageFundClaim");
    expect(coverageSource).toContain("onClick={onStake}");
    expect(coverageSource).toContain("onClick={onUnstake}");
    expect(coverageSource).toContain("onClick={onClaim}");
    expect(contractsSource).toContain("buildContractInvokeRaw");
    expect(contractsSource).toContain("simulateContractReadonly");
    expect(contractsSource).toContain("shouldBlockTypedWrite");
    expect(contractsSource).toContain("shouldBlockRawWrite");
    expect(contractsSource).not.toContain("fakeTransactionRail");
    expect(contractsSource).not.toContain("visualOnlyConfirmDialog");
  });

  it("keeps AppChrome navigation rail on a bounded visual cutover without ungated utility links", () => {
    const styles = readSurfaceSource("src/app/globals.css");
    const chromeSource = readSurfaceSource("src/components/product/AppChrome.tsx");

    expect(chromeSource).toContain("chrome-shell-visual-cutover");
    expect(chromeSource).toContain("chrome-grid-visual-cutover");
    expect(chromeSource).toContain("chrome-main-visual-cutover");
    expect(chromeSource).toContain("chrome-rail-screen-cutover");
    expect(chromeSource).toContain("chrome-rail-nav-cutover");
    expect(chromeSource).not.toContain('data-testid="chrome-wallet-card"');
    expect(chromeSource).toContain("chrome-advanced-console-cutover");
    expect(chromeSource).toContain("isOperatorOnlyProductPath(pathname)");
    expect(chromeSource).toContain("resolveOperatorConsoleItem(pathname)");
    expect(chromeSource).toContain("requestOperatorChallenge");
    expect(chromeSource).toContain("OPERATOR_CONSOLE_NAV.map");

    expect(styles).toContain(
      "App chrome navigation rail visual cutover, 2026-05-14",
    );
    expect(styles).toContain(
      "no route, wallet action, operator capability or",
    );
    expect(styles).toContain("--chrome-rail-cutover-width: clamp(17.75rem, 18.4vw, 20.8rem)");
    expect(styles).toContain(".chrome-shell-visual-cutover .chrome-grid-visual-cutover");
    expect(styles).toContain(".chrome-shell-visual-cutover .chrome-rail-screen-cutover");
    expect(styles).toContain(".chrome-shell-visual-cutover .chrome-rail-nav-cutover");
    expect(styles).toContain(".chrome-shell-visual-cutover .chrome-advanced-console-cutover");
    expect(styles).toContain("grid-template-columns: minmax(0, 1fr) var(--chrome-rail-cutover-width) !important");
    expect(styles).toContain("grid-template-columns: repeat(2, minmax(0, 1fr))");
    expect(chromeSource).not.toContain("visualOnlyChromeRail");
    expect(chromeSource).not.toContain("fakeSidebarEntry");
  });

  it("keeps secondary operator route cutover visual-only and backed by real surfaces", () => {
    const styles = readSurfaceSource("src/app/globals.css");
    const settingsSource = readSurfaceSource("src/app/settings/page.tsx");
    const statusSource = readSurfaceSource("src/app/status/page.tsx");
    const opsSource = readSurfaceSource("src/app/ops/page.tsx");
    const tiersSource = readSurfaceSource("src/app/tiers/page.tsx");
    const migrationsSource = readSurfaceSource("src/app/migrations/page.tsx");

    expect(styles).toContain(
      "Secondary operator route cutover, 2026-05-14",
    );
    expect(styles).toContain(
      "keep their live reads, wallet",
    );
    expect(styles).toContain(".secondary-operator-shell-cutover");
    expect(styles).toContain(".secondary-operator-panel-cutover");
    expect(styles).toContain(".secondary-operator-table-cutover");
    expect(styles).toContain(".secondary-operator-form-cutover");
    expect(styles).toContain(
      "grid-template-columns: repeat(auto-fit, minmax(var(--secondary-operator-min-card), 1fr)) !important",
    );

    for (const source of [
      settingsSource,
      statusSource,
      opsSource,
      tiersSource,
      migrationsSource,
    ]) {
      expect(source).toContain("secondary-operator-shell-cutover");
      expect(source).toContain("secondary-operator-summary-cutover");
      expect(source).toContain("secondary-operator-tabs-cutover");
      expect(source).toContain("secondary-operator-stage-cutover");
      expect(source).toContain("secondary-operator-panel-cutover");
      expect(source).not.toContain("visualOnlyOperatorRoute");
      expect(source).not.toContain("operatorRoutePlaceholder");
    }

    expect(statusSource).toContain("readAppHealthSnapshot");
    expect(statusSource).toContain("readRebalanceBenchmarkSnapshot");
    expect(opsSource).toContain("isGovernorReadable");
    expect(opsSource).toContain("readAdapterRouter");
    expect(tiersSource).toContain("readManagerTierPoints");
    expect(tiersSource).toContain("buildManagerTierAddPoints");
    expect(migrationsSource).toContain("/api/migrations/inspect");
    expect(migrationsSource).toContain("/api/migrations/simulate");
  });

  it("keeps dense-shell status pills non-breaking after wrapping safety nets", () => {
    const styles = readSurfaceSource("src/app/globals.css");
    const globalStatusRules = [
      ...styles.matchAll(/\.status-pill \{[\s\S]*?\}/g),
    ].map((match) => match[0]);
    const finalGlobalStatusRule = globalStatusRules.at(-1);
    const statusRules = [
      ...styles.matchAll(
        /\.control-room-fidelity-shell \.status-pill,[\s\S]*?\.integrations-fidelity-shell \.status-pill \{[\s\S]*?\}/g,
      ),
    ].map((match) => match[0]);
    const finalStatusRule = statusRules.at(-1);
    const assetStatusRule =
      styles.match(
        /\.assets-fidelity-shell \.assets-leaderboard-surface-table \.status-pill,[\s\S]*?\.assets-fidelity-shell \.surface-spotlight-head \.status-pill \{[\s\S]*?\}/,
      )?.[0] ?? "";
    const specificityOverride =
      styles.match(
        /\.surface-stack \.status-pill,[\s\S]*?\.assets-fidelity-shell \.status-pill \{[\s\S]*?\}/,
      )?.[0] ?? "";

    expect(finalGlobalStatusRule).toBeTruthy();
    expect(finalGlobalStatusRule).toContain("white-space: nowrap");
    expect(finalGlobalStatusRule).toContain("overflow-wrap: normal");
    expect(finalGlobalStatusRule).toContain("word-break: keep-all");
    expect(finalGlobalStatusRule).not.toContain("overflow-wrap: anywhere");

    expect(finalStatusRule).toBeTruthy();
    expect(finalStatusRule).toContain("white-space: nowrap");
    expect(finalStatusRule).toContain("overflow-wrap: normal");
    expect(finalStatusRule).toContain("word-break: keep-all");
    expect(finalStatusRule).not.toContain("overflow-wrap: anywhere");

    expect(assetStatusRule).toContain("white-space: nowrap");
    expect(assetStatusRule).toContain("overflow-wrap: normal");
    expect(assetStatusRule).toContain("word-break: keep-all");
    expect(assetStatusRule).not.toContain("overflow-wrap: anywhere");

    expect(specificityOverride).toContain("white-space: nowrap !important");
    expect(specificityOverride).toContain("overflow-wrap: normal !important");
    expect(specificityOverride).toContain("word-break: keep-all !important");

    const anyWrappingStatusRuleIndex = styles.lastIndexOf(
      ".governance-fidelity-shell .status-pill",
    );
    const finalStatusRuleIndex = styles.lastIndexOf(
      ".integrations-fidelity-shell .status-pill",
    );
    expect(finalStatusRuleIndex).toBeGreaterThan(anyWrappingStatusRuleIndex - 1);
  });
});
