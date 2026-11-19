import { describe, expect, it } from "vitest";
import {
  OPERATOR_SURFACE_BROWSER_PROJECTS,
  OPERATOR_SURFACE_ROUTES,
  OPERATOR_SURFACE_STATES,
  getOperatorSurfaceMatrixSummary,
  getOperatorSurfaceRoutesByState,
  validateOperatorSurfaceMatrix,
  type OperatorSurfaceState,
} from "@/lib/qa/operatorSurfaceMatrix";
import { OPERATOR_CONSOLE_NAV } from "@/lib/workflows/productNavigation";

describe("operator surface matrix", () => {
  it("defines the exact T14 browser, route and protected-navigation matrix", () => {
    expect(OPERATOR_SURFACE_BROWSER_PROJECTS).toEqual([
      "chromium",
      "firefox-surface-matrix",
      "webkit-surface-matrix",
    ]);
    expect(OPERATOR_SURFACE_STATES).toEqual([
      "unauthorized",
      "authorized",
      "api_degraded",
      "soroban_read_failure",
      "retry_recovery",
      "stale_cached_data",
    ]);
    expect(OPERATOR_SURFACE_ROUTES.map((route) => route.path)).toEqual(
      OPERATOR_CONSOLE_NAV.map((item) => item.href),
    );
    expect(OPERATOR_SURFACE_ROUTES.map((route) => route.key)).toEqual([
      "governance-console",
      "integrations-operator",
      "migrations",
      "ops",
      "contracts",
      "settings",
      "status",
      "tiers",
    ]);
  });

  it("keeps every T14 state represented with concrete route coverage", () => {
    expect(validateOperatorSurfaceMatrix()).toEqual([]);
    expect(getOperatorSurfaceMatrixSummary()).toMatchObject({
      routeCount: 8,
      browserCount: 3,
      stateCount: 6,
      browserRouteScenarios: 24,
      browserStateScenarios: 87,
    });

    expect(getOperatorSurfaceRoutesByState("unauthorized").length).toBe(8);
    expect(getOperatorSurfaceRoutesByState("authorized").length).toBe(8);
    expect(getOperatorSurfaceRoutesByState("api_degraded").map((route) => route.key)).toEqual([
      "integrations-operator",
      "migrations",
      "contracts",
      "settings",
      "status",
    ]);
    expect(
      getOperatorSurfaceRoutesByState("soroban_read_failure").map(
        (route) => route.key,
      ),
    ).toEqual(["ops", "tiers"]);
    expect(getOperatorSurfaceRoutesByState("retry_recovery").map((route) => route.key)).toEqual([
      "integrations-operator",
      "migrations",
      "ops",
      "status",
      "tiers",
    ]);
    expect(getOperatorSurfaceRoutesByState("stale_cached_data").map((route) => route.key)).toEqual([
      "migrations",
    ]);
  });

  it("requires fallback, retry, state-retention and sensitive-action anchors where declared", () => {
    for (const route of OPERATOR_SURFACE_ROUTES) {
      const requiredStates = route.requiredStates as readonly OperatorSurfaceState[];
      expect(route.loadedAnchorTestId, route.key).toBeTruthy();
      expect(route.activeTestId, route.key).toBeTruthy();

      if (
        requiredStates.includes("api_degraded") ||
        requiredStates.includes("soroban_read_failure") ||
        requiredStates.includes("stale_cached_data")
      ) {
        expect(route.fallbackAnchorTestIds.length, route.key).toBeGreaterThan(0);
      }

      if (requiredStates.includes("retry_recovery")) {
        expect(route.retryControlTestIds.length, route.key).toBeGreaterThan(0);
      }

      if (
        requiredStates.includes("retry_recovery") &&
        route.key !== "ops" &&
        route.key !== "status"
      ) {
        expect(route.statefulInputTestIds.length, route.key).toBeGreaterThan(0);
      }
    }

    const sensitiveRoutes = OPERATOR_SURFACE_ROUTES.filter(
      (route) => route.sensitiveActionTestIds.length > 0,
    ).map((route) => route.key);

    expect(sensitiveRoutes).toEqual([
      "governance-console",
      "integrations-operator",
      "migrations",
      "contracts",
      "tiers",
    ]);
  });
});
