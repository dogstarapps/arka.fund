export type PublicSurfaceBrowserProject =
  | "chromium"
  | "firefox-surface-matrix"
  | "webkit-surface-matrix";

export type PublicSurfaceBreakpointKey = "desktop" | "tablet" | "mobile";

export type PublicSurfaceState =
  | "loaded"
  | "empty"
  | "degraded"
  | "retry"
  | "search_filter";

export type PublicSurfaceRouteKind =
  | "discovery"
  | "dashboard"
  | "catalog"
  | "execution"
  | "profile"
  | "create";

export type PublicSurfaceRoute = {
  key: string;
  label: string;
  path: string;
  kind: PublicSurfaceRouteKind;
  loadedAnchorTestId: string;
  requiredStates: readonly PublicSurfaceState[];
  emptyStateTestId?: string;
  degradedStateTestId?: string;
  searchPath?: string;
  searchAnchorTestId?: string;
  searchInputTestId?: string;
  searchValue?: string;
  filterControlTestIds?: readonly string[];
};

export type PublicSurfaceBreakpoint = {
  key: PublicSurfaceBreakpointKey;
  width: number;
  height: number;
};

export const PUBLIC_SURFACE_BROWSER_PROJECTS = [
  "chromium",
  "firefox-surface-matrix",
  "webkit-surface-matrix",
] as const satisfies readonly PublicSurfaceBrowserProject[];

export const PUBLIC_SURFACE_BREAKPOINTS = [
  { key: "desktop", width: 1440, height: 1050 },
  { key: "tablet", width: 834, height: 1120 },
  { key: "mobile", width: 390, height: 900 },
] as const satisfies readonly PublicSurfaceBreakpoint[];

export const PUBLIC_SURFACE_ROUTES: readonly PublicSurfaceRoute[] = [
  {
    key: "discover",
    label: "Discover",
    path: "/discover",
    kind: "discovery",
    loadedAnchorTestId: "discover-summary-grid",
    requiredStates: ["loaded", "empty", "degraded", "retry", "search_filter"],
    emptyStateTestId: "discover-empty",
    degradedStateTestId: "discover-catalog-offline",
    searchPath: "/discover",
    searchInputTestId: "discover-search-input",
    searchValue: "gamma",
    filterControlTestIds: [
      "discover-feature-tab-profit",
      "discover-section-tab-assets",
    ],
  },
  {
    key: "dashboard",
    label: "Dashboard",
    path: "/dashboard",
    kind: "dashboard",
    loadedAnchorTestId: "dashboard-arkas-panel",
    requiredStates: ["loaded", "empty", "degraded", "retry", "search_filter"],
    emptyStateTestId: "dashboard-featured-empty",
    degradedStateTestId: "dashboard-catalog-offline",
    searchPath: "/dashboard",
    filterControlTestIds: [
      "dashboard-featured-tab-ranked",
      "dashboard-featured-tab-curated",
      "dashboard-featured-tab-fresh",
    ],
  },
  {
    key: "vaults",
    label: "Arkas leaderboard",
    path: "/vaults",
    kind: "catalog",
    loadedAnchorTestId: "vaults-leaderboard-panel",
    requiredStates: ["loaded", "empty", "degraded", "retry", "search_filter"],
    emptyStateTestId: "vaults-empty",
    degradedStateTestId: "vaults-catalog-offline",
    searchPath: "/vaults",
    searchInputTestId: "vaults-search-input",
    searchValue: "beta",
    filterControlTestIds: [
      "vaults-featured-tab-volume",
      "vaults-window-30d",
      "vaults-sort-metric",
    ],
  },
  {
    key: "arkas",
    label: "Arkas",
    path: "/arkas",
    kind: "catalog",
    loadedAnchorTestId: "vaults-leaderboard-panel",
    requiredStates: ["loaded", "empty", "degraded", "retry", "search_filter"],
    emptyStateTestId: "vaults-empty",
    degradedStateTestId: "vaults-catalog-offline",
    searchPath: "/arkas",
    searchInputTestId: "vaults-search-input",
    searchValue: "alpha",
    filterControlTestIds: [
      "vaults-featured-tab-volume",
      "vaults-sort-metric",
      "vaults-curated-toggle",
    ],
  },
  {
    key: "assets",
    label: "Assets",
    path: "/assets",
    kind: "catalog",
    loadedAnchorTestId: "assets-list-panel",
    requiredStates: ["loaded", "empty", "degraded", "retry", "search_filter"],
    emptyStateTestId: "assets-empty",
    degradedStateTestId: "assets-catalog-offline",
    searchPath: "/assets",
    searchInputTestId: "assets-search-input",
    searchValue: "usdc",
    filterControlTestIds: [
      "assets-spotlight-tab-balance-sheet",
      "assets-spotlight-tab-search",
    ],
  },
  {
    key: "managers",
    label: "Managers",
    path: "/managers",
    kind: "catalog",
    loadedAnchorTestId: "managers-list-panel",
    requiredStates: ["loaded", "empty", "degraded", "retry", "search_filter"],
    emptyStateTestId: "managers-empty",
    degradedStateTestId: "managers-catalog-offline",
    searchPath: "/managers",
    searchInputTestId: "managers-search-input",
    searchValue: "alpha",
    filterControlTestIds: [
      "managers-spotlight-tab-curated",
      "managers-sort-metric",
      "managers-sort-order",
    ],
  },
  {
    key: "vault-detail",
    label: "Arka profile",
    path: "/vaults/CA7ALPHAQFK2MZKJY4R5S8N2P1T6V9W3X7Y2Z5ABCD1EFGH2345678IJ",
    kind: "profile",
    loadedAnchorTestId: "vault-detail-hero",
    requiredStates: ["loaded", "degraded", "retry"],
    degradedStateTestId: "vault-detail-error",
  },
  {
    key: "asset-detail",
    label: "Asset profile",
    path: "/assets/CD25MNVTZDL4Y3XBCPCJXGXATV5WUHHOWMYFF4YBEGU5FCPGMYTVG5JY",
    kind: "profile",
    loadedAnchorTestId: "asset-detail-hero",
    requiredStates: ["loaded", "degraded", "retry"],
    degradedStateTestId: "asset-detail-error",
  },
  {
    key: "manager-detail",
    label: "Manager profile",
    path: "/managers/GCAALPHA7RTH9KLMNOPQ2UVWX3YZ56789ABCDEFGHJKLMNPRSTUV4WX",
    kind: "profile",
    loadedAnchorTestId: "manager-detail-hero",
    requiredStates: ["loaded", "degraded", "retry"],
    degradedStateTestId: "manager-detail-error",
  },
  {
    key: "factory-create",
    label: "Create Arka",
    path: "/factory/create?step=review&denomination=BLND&asset=XTAR&intent=blend",
    kind: "create",
    loadedAnchorTestId: "create-review-panel",
    requiredStates: ["loaded", "empty", "degraded", "retry", "search_filter"],
    emptyStateTestId: "create-arka-denomination-empty",
    degradedStateTestId: "create-arka-error",
    searchPath: "/factory/create?step=basics&denomination=BLND&asset=XTAR&intent=blend",
    searchAnchorTestId: "create-profile-panel",
    searchInputTestId: "create-arka-asset-search",
    searchValue: "not-an-indexed-asset",
    filterControlTestIds: ["create-step-basics", "create-step-assets", "create-step-review"],
  },
] as const;

export function getPublicSurfaceRoutesByState(
  state: PublicSurfaceState,
): PublicSurfaceRoute[] {
  return PUBLIC_SURFACE_ROUTES.filter((route) =>
    route.requiredStates.some((requiredState) => requiredState === state),
  );
}

export function getPublicSurfaceMatrixSummary() {
  const routeCount = PUBLIC_SURFACE_ROUTES.length;
  const breakpointCount = PUBLIC_SURFACE_BREAKPOINTS.length;
  const browserCount = PUBLIC_SURFACE_BROWSER_PROJECTS.length;
  const browserBreakpointRouteScenarios =
    routeCount * breakpointCount * browserCount;
  const stateScenarioCount = PUBLIC_SURFACE_ROUTES.reduce(
    (total, route) => total + route.requiredStates.length,
    0,
  );

  return {
    routeCount,
    stateCount: new Set(
      PUBLIC_SURFACE_ROUTES.flatMap((route) => route.requiredStates),
    ).size,
    stateScenarioCount,
    breakpointCount,
    browserCount,
    browserBreakpointRouteScenarios,
    routeKeys: PUBLIC_SURFACE_ROUTES.map((route) => route.key),
    states: [
      ...new Set(PUBLIC_SURFACE_ROUTES.flatMap((route) => route.requiredStates)),
    ],
  };
}

export function validatePublicSurfaceMatrix(): string[] {
  const issues: string[] = [];
  const routeKeys = new Set<string>();
  const paths = new Set<string>();

  for (const route of PUBLIC_SURFACE_ROUTES) {
    const loadedAnchorTestId = route.loadedAnchorTestId as string;
    const searchPath = route.searchPath as string | undefined;
    const searchInputTestId = route.searchInputTestId as string | undefined;
    const searchValue = route.searchValue as string | undefined;

    if (routeKeys.has(route.key)) {
      issues.push(`Duplicate route key: ${route.key}`);
    }
    routeKeys.add(route.key);

    if (paths.has(route.path)) {
      issues.push(`Duplicate route path: ${route.path}`);
    }
    paths.add(route.path);

    if (!route.path.startsWith("/")) {
      issues.push(`Route ${route.key} does not use an absolute app path.`);
    }
    if (!loadedAnchorTestId) {
      issues.push(`Route ${route.key} is missing a loaded anchor test id.`);
    }
    if (route.requiredStates.includes("empty") && !route.emptyStateTestId) {
      issues.push(`Route ${route.key} declares empty coverage without an empty state anchor.`);
    }
    if (
      route.requiredStates.includes("degraded") &&
      !route.degradedStateTestId
    ) {
      issues.push(`Route ${route.key} declares degraded coverage without a degraded anchor.`);
    }
    if (
      route.requiredStates.includes("retry") &&
      !route.degradedStateTestId &&
      route.key !== "factory-create" &&
      route.key !== "arkas"
    ) {
      issues.push(`Route ${route.key} declares retry coverage without a retry surface.`);
    }
    if (
      route.requiredStates.includes("search_filter") &&
      !searchPath
    ) {
      issues.push(`Route ${route.key} declares search/filter coverage without a state path.`);
    }
    if (route.requiredStates.includes("search_filter")) {
      const hasSearchInput = Boolean(searchInputTestId && searchValue);
      const hasFilterControls = Boolean(route.filterControlTestIds?.length);
      if (!hasSearchInput && !hasFilterControls) {
        issues.push(`Route ${route.key} declares search/filter coverage without controls.`);
      }
    }
  }

  for (const required of [
    "discover",
    "dashboard",
    "vaults",
    "arkas",
    "assets",
    "managers",
    "vault-detail",
    "asset-detail",
    "manager-detail",
    "factory-create",
  ]) {
    if (!routeKeys.has(required)) {
      issues.push(`Missing required public route: ${required}`);
    }
  }

  for (const state of [
    "loaded",
    "empty",
    "degraded",
    "retry",
    "search_filter",
  ] as const satisfies readonly PublicSurfaceState[]) {
    if (getPublicSurfaceRoutesByState(state).length === 0) {
      issues.push(`Missing coverage for public state: ${state}`);
    }
  }

  return issues;
}
