import { describe, expect, it } from "vitest";
import {
  PUBLIC_SURFACE_BREAKPOINTS,
  PUBLIC_SURFACE_BROWSER_PROJECTS,
  PUBLIC_SURFACE_ROUTES,
  getPublicSurfaceMatrixSummary,
  getPublicSurfaceRoutesByState,
  validatePublicSurfaceMatrix,
} from "@/lib/qa/publicSurfaceMatrix";

describe("public surface matrix", () => {
  it("defines the exact T13 browser, breakpoint and route matrix", () => {
    expect(PUBLIC_SURFACE_BROWSER_PROJECTS).toEqual([
      "chromium",
      "firefox-surface-matrix",
      "webkit-surface-matrix",
    ]);
    expect(PUBLIC_SURFACE_BREAKPOINTS.map((breakpoint) => breakpoint.key)).toEqual([
      "desktop",
      "tablet",
      "mobile",
    ]);
    expect(PUBLIC_SURFACE_ROUTES.map((route) => route.key)).toEqual([
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
    ]);
  });

  it("keeps loaded, empty, degraded, retry and search-filter states represented", () => {
    expect(validatePublicSurfaceMatrix()).toEqual([]);
    expect(getPublicSurfaceMatrixSummary()).toMatchObject({
      routeCount: 10,
      stateCount: 5,
      breakpointCount: 3,
      browserCount: 3,
      browserBreakpointRouteScenarios: 90,
    });

    expect(getPublicSurfaceRoutesByState("loaded").length).toBe(10);
    expect(getPublicSurfaceRoutesByState("empty").map((route) => route.key)).toEqual([
      "discover",
      "dashboard",
      "vaults",
      "arkas",
      "assets",
      "managers",
      "factory-create",
    ]);
    expect(getPublicSurfaceRoutesByState("degraded").length).toBe(10);
    expect(getPublicSurfaceRoutesByState("retry").length).toBe(10);
    expect(getPublicSurfaceRoutesByState("search_filter").map((route) => route.key)).toEqual([
      "discover",
      "dashboard",
      "vaults",
      "arkas",
      "assets",
      "managers",
      "factory-create",
    ]);
  });

  it("requires concrete anchors for every state-bearing route", () => {
    for (const route of PUBLIC_SURFACE_ROUTES) {
      expect(route.loadedAnchorTestId, route.key).toBeTruthy();
      if (route.requiredStates.includes("empty")) {
        expect(route.emptyStateTestId, route.key).toBeTruthy();
      }
      if (route.requiredStates.includes("degraded")) {
        expect(route.degradedStateTestId, route.key).toBeTruthy();
      }
      if (route.requiredStates.includes("search_filter")) {
        expect(route.searchPath, route.key).toMatch(/^\//);
        expect(
          Boolean(route.searchInputTestId && route.searchValue) ||
            Boolean(route.filterControlTestIds?.length),
          route.key,
        ).toBe(true);
      }
    }
  });
});
