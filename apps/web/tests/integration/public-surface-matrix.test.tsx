import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AssetsSurface from "@/components/product/AssetsSurface";
import DashboardSurface from "@/components/product/DashboardSurface";
import DiscoverSurface from "@/components/product/DiscoverSurface";
import ManagersSurface from "@/components/product/ManagersSurface";
import VaultLeaderboardSurface from "@/components/product/VaultLeaderboardSurface";
import {
  CORE_STELLAR_ASSET_REGISTRY,
  buildCoreStellarAssetMetadata,
} from "@/lib/catalog/coreStellarAssetRegistry";
import { resolveCatalogFixture } from "@/lib/catalog/testFixtures";
import {
  PUBLIC_SURFACE_ROUTES,
  getPublicSurfaceMatrixSummary,
  validatePublicSurfaceMatrix,
} from "@/lib/qa/publicSurfaceMatrix";

function emptyPage(limit = 24) {
  return {
    total: 0,
    offset: 0,
    limit,
    items: [],
  };
}

function installEmptyPublicSurfaceFetchMock() {
  return vi.spyOn(global, "fetch").mockImplementation(async (input) => {
    const url =
      typeof input === "string"
        ? new URL(input, "http://localhost")
        : input instanceof URL ? input : new URL(input.url);

    if (url.pathname === "/api/assets/core-registry") {
      return new Response(
        JSON.stringify({
          generatedAt: "2026-05-19T12:00:00.000Z",
          items: CORE_STELLAR_ASSET_REGISTRY.map((entry) =>
            buildCoreStellarAssetMetadata(entry),
          ),
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }

    if (url.pathname === "/api/leaderboard/source") {
      return new Response(
        JSON.stringify({
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
            validatedAt: "2026-05-19",
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
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }

    if (url.pathname === "/api/leaderboard/arkas") {
      return new Response(
        JSON.stringify({
          ok: true,
          source: "api_vault_leaderboard",
          generatedAt: "2026-05-19T12:00:00.000Z",
          query: {
            search: url.searchParams.get("search"),
            curatedOnly: url.searchParams.get("curatedOnly") !== "false",
            sortMetric: url.searchParams.get("sortMetric") ?? "rank",
            sortOrder: url.searchParams.get("sortOrder") ?? "asc",
            limit: 24,
            offset: 0,
            activityFallbackLimit: 60,
          },
          page: emptyPage(),
          derivedMetrics: {},
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }

    if (url.pathname === "/api/leaderboard/managers") {
      return new Response(
        JSON.stringify({
          ok: true,
          source: "api_manager_leaderboard",
          generatedAt: "2026-05-19T12:00:00.000Z",
          query: {
            search: url.searchParams.get("search"),
            sortMetric: url.searchParams.get("sortMetric") ?? "rank",
            sortOrder: url.searchParams.get("sortOrder") ?? "asc",
            limit: 24,
            offset: 0,
          },
          page: emptyPage(),
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }

    const pathname = url.pathname.replace("/api/catalog", "");
    if (pathname === "/v1/arkas" || pathname === "/v1/assets" || pathname === "/v1/managers") {
      return new Response(JSON.stringify(emptyPage()), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    if (/^\/v1\/arkas\/[^/]+\/history$/.test(pathname)) {
      return new Response(JSON.stringify(emptyPage(0)), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    const body = resolveCatalogFixture(pathname, url.searchParams);
    return new Response(JSON.stringify(body), {
      status: pathname.startsWith("/v1/") ? 200 : 404,
      headers: { "content-type": "application/json" },
    });
  });
}

describe("public surface matrix integration", () => {
  afterEach(() => {
    cleanup();
    window.history.replaceState(null, "", "/");
    vi.restoreAllMocks();
  });

  it("keeps the route/state matrix complete before route rendering", () => {
    expect(validatePublicSurfaceMatrix()).toEqual([]);
    expect(getPublicSurfaceMatrixSummary()).toMatchObject({
      routeCount: 10,
      stateCount: 5,
      browserBreakpointRouteScenarios: 90,
    });
    expect(PUBLIC_SURFACE_ROUTES.every((route) => route.path.startsWith("/"))).toBe(true);
  });

  it("renders concrete empty-state anchors used by the public matrix", async () => {
    installEmptyPublicSurfaceFetchMock();

    render(<DiscoverSurface />);
    await waitFor(() => expect(screen.getByTestId("discover-empty")).toBeInTheDocument());
    expect(screen.getByTestId("discover-empty")).toHaveTextContent(
      "No Arkas match this filter",
    );
    cleanup();

    render(<VaultLeaderboardSurface />);
    await waitFor(() => expect(screen.getByTestId("vaults-empty")).toBeInTheDocument());
    expect(screen.getByTestId("vaults-empty")).toHaveTextContent(
      "No Arkas match this filter",
    );
    cleanup();

    render(<AssetsSurface />);
    await waitFor(() => expect(screen.getByTestId("assets-empty")).toBeInTheDocument());
    expect(screen.getByTestId("assets-empty")).toHaveTextContent(
      "No assets found",
    );
    cleanup();

    render(<ManagersSurface />);
    await waitFor(() => expect(screen.getByTestId("managers-empty")).toBeInTheDocument());
    expect(screen.getByTestId("managers-empty")).toHaveTextContent(
      "No managers found",
    );
    cleanup();

    render(<DashboardSurface />);
    await waitFor(() =>
      expect(screen.getByTestId("dashboard-fidelity-shell")).toBeInTheDocument(),
    );
    expect(screen.queryByTestId("dashboard-stage-history-empty")).not.toBeInTheDocument();
    expect(screen.getByTestId("dashboard-figma-metric-deck")).toHaveTextContent("TVL");
  });
});
