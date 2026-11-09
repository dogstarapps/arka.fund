import { OPERATOR_CONSOLE_NAV } from "@/lib/workflows/productNavigation";

export type OperatorSurfaceBrowserProject =
  | "chromium"
  | "firefox-surface-matrix"
  | "webkit-surface-matrix";

export type OperatorSurfaceState =
  | "unauthorized"
  | "authorized"
  | "api_degraded"
  | "soroban_read_failure"
  | "retry_recovery"
  | "stale_cached_data";

export type OperatorSurfaceRouteKey =
  | "governance-console"
  | "integrations-operator"
  | "migrations"
  | "ops"
  | "contracts"
  | "settings"
  | "status"
  | "tiers";

export type OperatorSurfaceRoute = {
  key: OperatorSurfaceRouteKey;
  label: string;
  path: string;
  heading: string;
  activeTestId: string;
  loadedAnchorTestId: string;
  requiredStates: readonly OperatorSurfaceState[];
  fallbackAnchorTestIds: readonly string[];
  retryControlTestIds: readonly string[];
  statefulInputTestIds: readonly string[];
  sensitiveActionTestIds: readonly string[];
  apiEndpoints: readonly string[];
};

export const OPERATOR_SURFACE_BROWSER_PROJECTS = [
  "chromium",
  "firefox-surface-matrix",
  "webkit-surface-matrix",
] as const satisfies readonly OperatorSurfaceBrowserProject[];

export const OPERATOR_SURFACE_STATES = [
  "unauthorized",
  "authorized",
  "api_degraded",
  "soroban_read_failure",
  "retry_recovery",
  "stale_cached_data",
] as const satisfies readonly OperatorSurfaceState[];

export const OPERATOR_SURFACE_ROUTES = [
  {
    key: "governance-console",
    label: "DAO Console",
    path: "/governance/console",
    heading: "Governance Console",
    activeTestId: "chrome-utility-dao-console",
    loadedAnchorTestId: "governance-composer-panel",
    requiredStates: ["unauthorized", "authorized"],
    fallbackAnchorTestIds: ["governance-composer-product-decision"],
    retryControlTestIds: [],
    statefulInputTestIds: [
      "governance-composer-template-select",
      "governance-composer-contract-input",
    ],
    sensitiveActionTestIds: [
      "governance-composer-queue-button",
      "governance-composer-handoff-link",
      "governance-publication-restore-button",
    ],
    apiEndpoints: [],
  },
  {
    key: "integrations-operator",
    label: "Integration Ops",
    path: "/integrations/operator",
    heading: "Integrations Operator",
    activeTestId: "chrome-utility-integration-ops",
    loadedAnchorTestId: "integrations-workspace-summary",
    requiredStates: [
      "unauthorized",
      "authorized",
      "api_degraded",
      "retry_recovery",
    ],
    fallbackAnchorTestIds: ["integrations-balanced-intent-error"],
    retryControlTestIds: [
      "integrations-balanced-intent-load-button",
      "integrations-balanced-intent-quote-button",
      "integrations-balanced-intent-status-button",
      "integrations-balanced-intent-confirm-button",
    ],
    statefulInputTestIds: [
      "integrations-balanced-intent-token-in",
      "integrations-balanced-intent-token-out",
      "integrations-balanced-intent-amount",
      "integrations-balanced-intent-status-input",
    ],
    sensitiveActionTestIds: ["integrations-balanced-intent-quote-button"],
    apiEndpoints: [
      "/api/intents/balanced/quote",
      "/api/intents/balanced/status",
      "/api/intents/balanced/confirm",
    ],
  },
  {
    key: "migrations",
    label: "Migrations",
    path: "/migrations",
    heading: "Migration Workspace",
    activeTestId: "chrome-utility-migrations",
    loadedAnchorTestId: "migration-plan-panel",
    requiredStates: [
      "unauthorized",
      "authorized",
      "api_degraded",
      "retry_recovery",
      "stale_cached_data",
    ],
    fallbackAnchorTestIds: [
      "migration-error",
      "migration-simulation-error",
      "migration-inspection-mode-note",
    ],
    retryControlTestIds: ["migration-inspect-button", "migration-simulate-button"],
    statefulInputTestIds: [
      "migration-source-input",
      "migration-target-input",
      "migration-registry-input",
      "migration-implementation-hash-input",
      "migration-share-token-hash-input",
    ],
    sensitiveActionTestIds: [
      "migration-open-implementation-governance",
      "migration-open-share-token-governance",
      "migration-open-registry-governance",
    ],
    apiEndpoints: ["/api/migrations/inspect", "/api/migrations/simulate"],
  },
  {
    key: "ops",
    label: "Ops",
    path: "/ops",
    heading: "Operations",
    activeTestId: "chrome-utility-ops",
    loadedAnchorTestId: "ops-workspace-summary",
    requiredStates: [
      "unauthorized",
      "authorized",
      "soroban_read_failure",
      "retry_recovery",
    ],
    fallbackAnchorTestIds: ["ops-error", "ops-health-panel"],
    retryControlTestIds: ["ops-refresh-button"],
    statefulInputTestIds: [],
    sensitiveActionTestIds: [],
    apiEndpoints: ["soroban-rpc", "/api/health"],
  },
  {
    key: "contracts",
    label: "Contracts",
    path: "/contracts",
    heading: "Contract Control Center",
    activeTestId: "chrome-utility-contracts",
    loadedAnchorTestId: "contracts-preset-panel",
    requiredStates: ["unauthorized", "authorized", "api_degraded"],
    fallbackAnchorTestIds: [
      "contracts-mutation-matrix-panel",
      "contracts-storage-lifecycle-panel",
      "contracts-raw-error",
    ],
    retryControlTestIds: ["contracts-raw-read-button", "contracts-raw-write-button"],
    statefulInputTestIds: [
      "contracts-raw-contract-input",
      "contracts-raw-method-input",
      "contracts-raw-args-input",
    ],
    sensitiveActionTestIds: [
      "contracts-run-preset-button",
      "contracts-raw-write-button",
    ],
    apiEndpoints: [
      "/api/contracts/mutation-matrix",
      "/api/contracts/storage-lifecycle",
    ],
  },
  {
    key: "settings",
    label: "Settings",
    path: "/settings",
    heading: "Settings",
    activeTestId: "chrome-utility-settings",
    loadedAnchorTestId: "settings-config-panel",
    requiredStates: ["unauthorized", "authorized", "api_degraded"],
    fallbackAnchorTestIds: [
      "settings-config-panel",
      "settings-guardrails-panel",
      "settings-raw-panel",
    ],
    retryControlTestIds: [],
    statefulInputTestIds: [],
    sensitiveActionTestIds: [],
    apiEndpoints: ["/api/health"],
  },
  {
    key: "status",
    label: "Status",
    path: "/status",
    heading: "Status",
    activeTestId: "chrome-utility-status",
    loadedAnchorTestId: "status-baseline-panel",
    requiredStates: [
      "unauthorized",
      "authorized",
      "api_degraded",
      "retry_recovery",
    ],
    fallbackAnchorTestIds: [
      "status-health-error",
      "status-runtime-health-posture",
      "status-routing-benchmark-error",
    ],
    retryControlTestIds: [
      "status-health-refresh-button",
      "status-routing-benchmark-refresh-button",
    ],
    statefulInputTestIds: [],
    sensitiveActionTestIds: [],
    apiEndpoints: ["/api/health", "/api/routing/rebalance/benchmark"],
  },
  {
    key: "tiers",
    label: "Tiers",
    path: "/tiers",
    heading: "Manager Tiers",
    activeTestId: "chrome-utility-tiers",
    loadedAnchorTestId: "tiers-workspace-summary",
    requiredStates: [
      "unauthorized",
      "authorized",
      "soroban_read_failure",
      "retry_recovery",
    ],
    fallbackAnchorTestIds: ["tiers-read-error", "tiers-runtime-read-posture"],
    retryControlTestIds: ["tiers-refresh-button"],
    statefulInputTestIds: ["tiers-manager-input", "tiers-delta-input"],
    sensitiveActionTestIds: ["tiers-add-points-button"],
    apiEndpoints: ["soroban-rpc"],
  },
] as const satisfies readonly OperatorSurfaceRoute[];

export function getOperatorSurfaceRoutesByState(
  state: OperatorSurfaceState,
): OperatorSurfaceRoute[] {
  return OPERATOR_SURFACE_ROUTES.filter((route) =>
    route.requiredStates.some((requiredState) => requiredState === state),
  );
}

export function getOperatorSurfaceMatrixSummary() {
  const routeCount = OPERATOR_SURFACE_ROUTES.length;
  const browserCount = OPERATOR_SURFACE_BROWSER_PROJECTS.length;
  const stateScenarioCount = OPERATOR_SURFACE_ROUTES.reduce(
    (total, route) => total + route.requiredStates.length,
    0,
  );

  return {
    routeCount,
    browserCount,
    stateCount: new Set(
      OPERATOR_SURFACE_ROUTES.flatMap((route) => route.requiredStates),
    ).size,
    stateScenarioCount,
    browserRouteScenarios: routeCount * browserCount,
    browserStateScenarios: stateScenarioCount * browserCount,
    routeKeys: OPERATOR_SURFACE_ROUTES.map((route) => route.key),
    states: OPERATOR_SURFACE_STATES,
  };
}

export function validateOperatorSurfaceMatrix(): string[] {
  const issues: string[] = [];
  const keys = new Set<string>();
  const paths = new Set<string>();
  const navigationPaths = OPERATOR_CONSOLE_NAV.map((item) => item.href);
  const matrixPaths = OPERATOR_SURFACE_ROUTES.map((route) => route.path);

  if (navigationPaths.join("|") !== matrixPaths.join("|")) {
    issues.push(
      `Operator route matrix is not aligned with protected navigation: ${matrixPaths.join(", ")}`,
    );
  }

  for (const route of OPERATOR_SURFACE_ROUTES) {
    const loadedAnchorTestId: string = route.loadedAnchorTestId;
    const activeTestId: string = route.activeTestId;
    const requiredStates: readonly OperatorSurfaceState[] = route.requiredStates;
    const fallbackAnchorTestIds: readonly string[] = route.fallbackAnchorTestIds;
    const retryControlTestIds: readonly string[] = route.retryControlTestIds;
    const statefulInputTestIds: readonly string[] = route.statefulInputTestIds;
    const apiEndpoints: readonly string[] = route.apiEndpoints;

    if (keys.has(route.key)) {
      issues.push(`Duplicate operator route key: ${route.key}`);
    }
    keys.add(route.key);

    if (paths.has(route.path)) {
      issues.push(`Duplicate operator route path: ${route.path}`);
    }
    paths.add(route.path);

    if (!route.path.startsWith("/")) {
      issues.push(`Route ${route.key} does not use an absolute app path.`);
    }
    if (!loadedAnchorTestId) {
      issues.push(`Route ${route.key} is missing a loaded anchor.`);
    }
    if (!activeTestId) {
      issues.push(`Route ${route.key} is missing a chrome active anchor.`);
    }
    if (!requiredStates.includes("unauthorized")) {
      issues.push(`Route ${route.key} is missing unauthorized coverage.`);
    }
    if (!requiredStates.includes("authorized")) {
      issues.push(`Route ${route.key} is missing authorized coverage.`);
    }
    if (
      requiredStates.some((state) =>
        ["api_degraded", "soroban_read_failure", "stale_cached_data"].includes(
          state,
        ),
      ) &&
      fallbackAnchorTestIds.length === 0
    ) {
      issues.push(`Route ${route.key} declares fallback coverage without anchors.`);
    }
    if (
      requiredStates.includes("retry_recovery") &&
      retryControlTestIds.length === 0
    ) {
      issues.push(`Route ${route.key} declares retry coverage without controls.`);
    }
    if (
      requiredStates.includes("retry_recovery") &&
      route.key !== "ops" &&
      route.key !== "status" &&
      statefulInputTestIds.length === 0
    ) {
      issues.push(`Route ${route.key} declares retry coverage without state inputs.`);
    }
    if (
      requiredStates.includes("api_degraded") &&
      apiEndpoints.length === 0
    ) {
      issues.push(`Route ${route.key} declares API degradation without endpoints.`);
    }
  }

  for (const state of OPERATOR_SURFACE_STATES) {
    if (getOperatorSurfaceRoutesByState(state).length === 0) {
      issues.push(`Missing operator state coverage: ${state}`);
    }
  }

  return issues;
}
