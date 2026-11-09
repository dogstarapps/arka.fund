import React from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import AssetsSurface from "@/components/product/AssetsSurface";
import AssetDetailSurface from "@/components/product/AssetDetailSurface";
import ManagerDetailSurface from "@/components/product/ManagerDetailSurface";
import ManagersSurface from "@/components/product/ManagersSurface";
import {
  fixtureManagersPage,
  resolveCatalogFixture,
} from "@/lib/catalog/testFixtures";
import {
  normalizeManagerSortMetric,
  normalizeManagerSortOrder,
  rankManagerLeaderboardEntries,
} from "@/lib/catalog/leaderboardManagers";
import type { ManagerLeaderboardResolvedPageResponse } from "@/lib/catalog/types";

vi.mock("@/lib/walletKit", () => ({
  getWalletsKit: vi.fn(() => ({
    getAddress: vi.fn(async () => ({ address: "GMANAGERTEST" })),
    signMessage: vi.fn(async () => ({ signedMessage: "signed-message" })),
  })),
  connectWallet: vi.fn(async () => "GMANAGERTEST"),
  signMessageWithWallet: vi.fn(async () => "signed-message"),
}));

function installCatalogFetchMock() {
  return vi.spyOn(global, "fetch").mockImplementation(async (input) => {
    const url =
      typeof input === "string"
        ? new URL(input, "http://localhost")
        : input instanceof URL ? input : new URL(input.url);
    if (url.pathname === "/api/assets/core-registry") {
      return new Response(
        JSON.stringify({
          generatedAt: "2026-04-25T18:00:00.000Z",
          items: [
            {
              id: "xlm",
              label: "Stellar Lumens",
              symbol: "XLM",
              kind: "native",
              description: "Native Stellar asset",
              homeDomain: null,
              classicCode: "XLM",
              classicIssuer: null,
              metadataContract: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
              selectableContract: "CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA",
              iconUrl: "/assets/core/xlm.png",
              fallbackIconUrl: "/assets/core/xlm.png",
              iconSource: "registry_png",
              tomlState: "not_applicable",
              tomlUrl: null,
              iconProvenanceLabel: "native registry icon",
              lookupKeys: ["xlm", "CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA"],
            },
            {
              id: "usdc",
              label: "USD Coin",
              symbol: "USDC",
              kind: "classic",
              description: "Circle-issued dollar stablecoin",
              homeDomain: "circle.com",
              classicCode: "USDC",
              classicIssuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
              metadataContract: "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75",
              selectableContract: "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75",
              iconUrl: "https://cdn.circle.com/usdc.png",
              fallbackIconUrl: "/assets/core/usdc.png",
              iconSource: "stellar_toml",
              tomlState: "resolved",
              tomlUrl: "https://circle.com/.well-known/stellar.toml",
              iconProvenanceLabel: "stellar.toml verified",
              lookupKeys: [
                "usdc",
                "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75",
                "CDTKPWPLOURQA2SGTKTUQOWRCBZEORB4BWBOMJ3D3ZTQQSGE5F6JBQLV",
              ],
            },
            {
              id: "aqua",
              label: "Aqua",
              symbol: "AQUA",
              kind: "classic",
              description: "Aquarius ecosystem token",
              homeDomain: "aqua.network",
              classicCode: "AQUA",
              classicIssuer: "GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA",
              metadataContract: "CAUIKL3IYGMERDRUN6YSCLWVAKIFG5Q4YJHUKM4S4NJZQIA3BAS6OJPK",
              selectableContract: "CAUIKL3IYGMERDRUN6YSCLWVAKIFG5Q4YJHUKM4S4NJZQIA3BAS6OJPK",
              iconUrl: "https://cdn.aqua.network/aqua.png",
              fallbackIconUrl: "/assets/core/aqua.png",
              iconSource: "stellar_toml",
              tomlState: "resolved",
              tomlUrl: "https://aqua.network/.well-known/stellar.toml",
              iconProvenanceLabel: "stellar.toml verified",
              lookupKeys: ["aqua", "CAUIKL3IYGMERDRUN6YSCLWVAKIFG5Q4YJHUKM4S4NJZQIA3BAS6OJPK"],
            },
            {
              id: "xtar",
              label: "Dogstar",
              symbol: "XTAR",
              kind: "classic",
              description: "Dogstar token",
              homeDomain: "dogstarcoin.com",
              classicCode: "XTAR",
              classicIssuer: "GAORYJ3KBDGIM7FFSKVUJHJ5NEFWIRDIAGGBJBJS7TY6ECZS53257IG4",
              metadataContract: "CDCKFBZYF2AQCSM3JOF2ZM27O3Y6AJAI4OTCQKAFNZ3FHBYUTFOKICIY",
              selectableContract: "CDCKFBZYF2AQCSM3JOF2ZM27O3Y6AJAI4OTCQKAFNZ3FHBYUTFOKICIY",
              iconUrl: "https://cdn.dogstarcoin.com/xtar.png",
              fallbackIconUrl: "/assets/core/xtar.png",
              iconSource: "stellar_toml",
              tomlState: "resolved",
              tomlUrl: "https://dogstarcoin.com/.well-known/stellar.toml",
              iconProvenanceLabel: "stellar.toml verified",
              lookupKeys: ["xtar"],
            },
            {
              id: "blnd",
              label: "Blend",
              symbol: "BLND",
              kind: "classic",
              description: "Blend governance token",
              homeDomain: null,
              classicCode: "BLND",
              classicIssuer: "GDJEHTBE6ZHUXSWFI642DCGLUOECLHPF3KSXHPXTSTJ7E3JF6MQ5EZYY",
              metadataContract: "CD25MNVTZDL4Y3XBCPCJXGXATV5WUHHOWMYFF4YBEGU5FCPGMYTVG5JY",
              selectableContract: "CD25MNVTZDL4Y3XBCPCJXGXATV5WUHHOWMYFF4YBEGU5FCPGMYTVG5JY",
              iconUrl: "/assets/core/blnd.png",
              fallbackIconUrl: "/assets/core/blnd.png",
              iconSource: "registry_png",
              tomlState: "missing_home_domain",
              tomlUrl: null,
              iconProvenanceLabel: "registry icon; no home domain",
              lookupKeys: ["blnd", "CD25MNVTZDL4Y3XBCPCJXGXATV5WUHHOWMYFF4YBEGU5FCPGMYTVG5JY"],
            },
          ],
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );
    }
    if (url.pathname === "/api/leaderboard/managers") {
      const query = url.searchParams;
      const sortMetric = normalizeManagerSortMetric(query.get("sortMetric"));
      const sortOrder = normalizeManagerSortOrder(sortMetric, query.get("sortOrder"));
      const parsedLimit = Number.parseInt(query.get("limit") ?? "24", 10);
      const parsedOffset = Number.parseInt(query.get("offset") ?? "0", 10);
      const limit = Number.isFinite(parsedLimit) ? parsedLimit : 24;
      const offset = Number.isFinite(parsedOffset) ? parsedOffset : 0;
      const page = fixtureManagersPage({
        search: query.get("search") ?? undefined,
        limit: 24,
      });
      const rankedItems = rankManagerLeaderboardEntries(
        page.items,
        sortMetric,
        sortOrder,
      );
      const pagedItems = rankedItems.slice(offset, offset + limit);
      const payload: ManagerLeaderboardResolvedPageResponse = {
        ok: true,
        source: "api_manager_leaderboard",
        generatedAt: "2026-04-16T12:00:00.000Z",
        query: {
          search: query.get("search"),
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
      };
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    const pathname = url.pathname.replace("/api/catalog", "");
    const body = resolveCatalogFixture(pathname, url.searchParams);
    const status =
      typeof body === "object" && body !== null && "error" in body ? 404 : 200;
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  });
}

function buildCoreRegistryResponse() {
  return new Response(
    JSON.stringify({
      generatedAt: "2026-04-25T18:00:00.000Z",
      items: [
        {
          id: "xlm",
          label: "Stellar Lumens",
          symbol: "XLM",
          kind: "native",
          description: "Native Stellar asset",
          homeDomain: null,
          classicCode: "XLM",
          classicIssuer: null,
          metadataContract: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
          selectableContract: "CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA",
          iconUrl: "/assets/core/xlm.png",
          fallbackIconUrl: "/assets/core/xlm.png",
          iconSource: "registry_png",
          lookupKeys: ["xlm", "CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA"],
        },
        {
          id: "usdc",
          label: "USD Coin",
          symbol: "USDC",
          kind: "classic",
          description: "Circle-issued dollar stablecoin",
          homeDomain: "circle.com",
          classicCode: "USDC",
          classicIssuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
          metadataContract: "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75",
          selectableContract: "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75",
          iconUrl: "https://cdn.circle.com/usdc.png",
          fallbackIconUrl: "/assets/core/usdc.png",
          iconSource: "stellar_toml",
          lookupKeys: [
            "usdc",
            "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75",
            "CDTKPWPLOURQA2SGTKTUQOWRCBZEORB4BWBOMJ3D3ZTQQSGE5F6JBQLV",
          ],
        },
      ],
    }),
    {
      status: 200,
      headers: { "content-type": "application/json" },
    },
  );
}

function buildManagerLeaderboardResponse(url: URL) {
  const query = url.searchParams;
  const sortMetric = normalizeManagerSortMetric(query.get("sortMetric"));
  const sortOrder = normalizeManagerSortOrder(sortMetric, query.get("sortOrder"));
  const parsedLimit = Number.parseInt(query.get("limit") ?? "24", 10);
  const parsedOffset = Number.parseInt(query.get("offset") ?? "0", 10);
  const limit = Number.isFinite(parsedLimit) ? parsedLimit : 24;
  const offset = Number.isFinite(parsedOffset) ? parsedOffset : 0;
  const page = fixtureManagersPage({
    search: query.get("search") ?? undefined,
    limit: 24,
  });
  const rankedItems = rankManagerLeaderboardEntries(
    page.items,
    sortMetric,
    sortOrder,
  );
  const pagedItems = rankedItems.slice(offset, offset + limit);
  const payload: ManagerLeaderboardResolvedPageResponse = {
    ok: true,
    source: "api_manager_leaderboard",
    generatedAt: "2026-04-16T12:00:00.000Z",
    query: {
      search: query.get("search"),
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
  };
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function buildCatalogResponse(url: URL) {
  const pathname = url.pathname.replace("/api/catalog", "");
  const body = resolveCatalogFixture(pathname, url.searchParams);
  const status =
    typeof body === "object" && body !== null && "error" in body ? 404 : 200;
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function createDeferredFetchGate() {
  let resolveGate: (() => void) | undefined;
  const gate = new Promise<void>((resolve) => {
    resolveGate = resolve;
  });
  return {
    async wait() {
      await gate;
    },
    release() {
      resolveGate?.();
    },
  };
}

describe("manager and asset explorers", () => {
  afterEach(() => {
    cleanup();
    window.history.replaceState(null, "", "/");
    vi.restoreAllMocks();
  });

  it("filters manager leaderboard results and links to detail", async () => {
    installCatalogFetchMock();
    const user = userEvent.setup();

    render(<ManagersSurface />);

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: /managers leaderboard/i }),
      ).toBeInTheDocument(),
    );

    await waitFor(() =>
      expect(screen.getByTestId("managers-list")).toBeInTheDocument(),
    );
    expect(screen.getByTestId("managers-fidelity-shell")).toHaveClass(
      "managers-fidelity-shell",
    );
    expect(screen.getByTestId("managers-hero-aside")).toHaveClass(
      "managers-operator-summary",
    );
    expect(screen.getByTestId("managers-workspace-grid")).toHaveClass(
      "managers-workspace-grid",
    );
    expect(screen.getByTestId("managers-list-panel")).toHaveClass(
      "managers-list-workspace-panel",
    );
    expect(screen.getByTestId("managers-filter-deck")).toHaveClass(
      "managers-filter-deck-cutover",
    );
    expect(screen.getByTestId("managers-filter-primary-row")).toContainElement(
      screen.getByTestId("managers-search-input"),
    );
    expect(screen.getByTestId("managers-filter-primary-row")).toContainElement(
      screen.getByTestId("managers-sort-controls"),
    );
    expect(screen.getByTestId("managers-spotlight-tabs")).toHaveTextContent(
      "Lead TVL",
    );
    expect(screen.queryByTestId("managers-telemetry-panel")).not.toBeInTheDocument();
    expect(screen.queryByTestId("managers-leaderboard-table")).not.toBeInTheDocument();
    expect(screen.queryByTestId("managers-sort-pill")).not.toBeInTheDocument();
    expect(screen.getAllByTestId("manager-card")).toHaveLength(3);
    expect(
      within(screen.getAllByTestId("manager-card")[0]!).getByText("USD TVL"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("managers-list")).not.toHaveTextContent("of listed TVL");
    expect(screen.getByTestId("managers-hero-aside")).toHaveTextContent("Total TVL");
    expect(screen.getByTestId("managers-hero-aside")).not.toHaveTextContent("Lead share");
    expect(
      within(screen.getAllByTestId("manager-card")[0]!).getByRole("link", {
        name: /open manager detail/i,
      }),
    ).toHaveAttribute("href", expect.stringMatching(/^\/managers\/G/));

    await user.type(screen.getByTestId("managers-search-input"), "beta");
    await user.click(screen.getByTestId("managers-spotlight-tab-search"));

    await waitFor(() =>
      expect(
        within(screen.getAllByTestId("manager-card")[0]!).getAllByText(/GCBBETA/i)
          .length,
      ).toBeGreaterThan(0),
    );

    await user.selectOptions(screen.getByTestId("managers-sort-metric"), "arkas");
    await waitFor(() =>
      expect(screen.getByTestId("managers-list-panel")).toHaveTextContent(
        "sorted by Arka count",
      ),
    );

    await waitFor(() =>
      expect(screen.getAllByTestId("manager-card")).toHaveLength(1),
    );
    expect(screen.getByTestId("managers-list-panel")).toHaveTextContent(
      "GCBBETA",
    );
  });

  it("restores manager controls from the URL and keeps search bookmarkable", async () => {
    installCatalogFetchMock();
    const user = userEvent.setup();
    window.history.replaceState(
      null,
      "",
      "/managers?q=beta&spotlight=curated&sort=arkas&order=asc",
    );

    render(<ManagersSurface />);

    await waitFor(() =>
      expect(screen.getByTestId("managers-list")).toBeInTheDocument(),
    );
    expect(screen.getByTestId("managers-search-input")).toHaveValue("beta");
    expect(screen.getByTestId("managers-spotlight-tab-curated")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByTestId("managers-sort-metric")).toHaveValue("arkas");
    expect(screen.getByTestId("managers-sort-order")).toHaveValue("asc");
    expect(screen.getByTestId("managers-list-panel")).toHaveTextContent(
      "sorted by Arka count",
    );

    await user.type(screen.getByTestId("managers-search-input"), "x");

    await waitFor(() =>
      expect(window.location.search).toContain("q=betax"),
    );
    expect(window.location.search).toContain("spotlight=curated");
    expect(window.location.search).toContain("sort=arkas");
    expect(window.location.search).toContain("order=asc");
  });

  it("announces manager refresh while preserving the previous ranked result set", async () => {
    const gate = createDeferredFetchGate();
    vi.spyOn(global, "fetch").mockImplementation(async (input) => {
      const url =
        typeof input === "string"
          ? new URL(input, "http://localhost")
          : input instanceof URL ? input : new URL(input.url);
      if (url.pathname === "/api/leaderboard/managers") {
        if (url.searchParams.get("search")?.toLowerCase() === "beta") {
          await gate.wait();
        }
        return buildManagerLeaderboardResponse(url);
      }
      return buildCatalogResponse(url);
    });

    render(<ManagersSurface />);

    await waitFor(() =>
      expect(screen.getByTestId("managers-list-panel")).toHaveTextContent(
        "GCAALPHA",
      ),
    );

    fireEvent.change(screen.getByTestId("managers-search-input"), {
      target: { value: "beta" },
    });

    await waitFor(() =>
      expect(screen.getByTestId("managers-refresh-status")).toHaveAttribute(
        "role",
        "status",
      ),
    );
    expect(screen.getByTestId("managers-fidelity-shell")).toHaveAttribute(
      "aria-busy",
      "true",
    );
    expect(screen.getByTestId("managers-list-panel")).toHaveTextContent(
      "GCAALPHA",
    );

    gate.release();

    await waitFor(() =>
      expect(screen.queryByTestId("managers-refresh-status")).not.toBeInTheDocument(),
    );
    expect(screen.getByTestId("managers-fidelity-shell")).toHaveAttribute(
      "aria-busy",
      "false",
    );
    expect(screen.getByTestId("managers-list-panel")).toHaveTextContent(
      "GCBBETA",
    );
  });

  it("renders asset detail with trajectory and linked Arkas", async () => {
    installCatalogFetchMock();

    render(
      <AssetDetailSurface assetId="CD25MNVTZDL4Y3XBCPCJXGXATV5WUHHOWMYFF4YBEGU5FCPGMYTVG5JY" />,
    );

    await waitFor(() =>
      expect(screen.getByTestId("asset-detail-hero")).toBeInTheDocument(),
    );

    expect(screen.getByTestId("asset-detail-fidelity-shell")).toBeInTheDocument();
    expect(screen.getByTestId("asset-detail-fidelity-shell")).toHaveClass(
      "public-detail-shell-cutover",
    );
    expect(screen.getByTestId("asset-detail-stage-grid")).toHaveClass(
      "explorer-detail-stage-cutover",
    );
    expect(screen.getByTestId("asset-detail-stage-grid")).toHaveClass(
      "public-detail-stage-grid-cutover",
    );
    expect(screen.getByTestId("asset-detail-hero")).toHaveClass(
      "public-detail-hero-grid-cutover",
    );
    expect(screen.getByTestId("asset-detail-hero")).toHaveTextContent(
      "BLND",
    );
    expect(screen.getByTestId("asset-detail-hero")).toHaveTextContent(
      "CD25MNVTZD",
    );
    expect(screen.getByTestId("asset-detail-net-position")).toHaveTextContent(
      "$0.28",
    );
    expect(screen.getByTestId("asset-detail-history-panel")).toHaveTextContent(
      "Mar",
    );
    expect(screen.getByTestId("asset-detail-history-panel")).toHaveClass(
      "public-detail-panel-cutover",
    );
    expect(screen.getByTestId("asset-detail-risk-panel")).toHaveClass(
      "public-detail-panel-cutover",
    );
    expect(screen.getByTestId("asset-detail-risk-panel")).toHaveTextContent(
      "Liquid share",
    );
    expect(screen.getByTestId("asset-detail-arkas-panel")).toHaveClass(
      "public-detail-related-panel-cutover",
    );
    expect(screen.getByTestId("asset-detail-arkas-table")).toHaveTextContent(
      "Position",
    );
    expect(screen.getByTestId("asset-detail-arkas-table")).toHaveClass(
      "explorer-related-grid-cutover",
    );
    expect(screen.getByTestId("asset-detail-arkas-table")).toHaveClass(
      "public-detail-related-grid-cutover",
    );
    expect(screen.getAllByTestId("asset-detail-arka-card")).toHaveLength(2);
    expect(screen.getAllByTestId("asset-detail-arka-card")[0]).toHaveClass(
      "public-detail-related-card-cutover",
    );
  });

  it("renders core registry asset detail without inventing exposure when catalog has no asset row", async () => {
    installCatalogFetchMock();

    render(
      <AssetDetailSurface assetId="CDCKFBZYF2AQCSM3JOF2ZM27O3Y6AJAI4OTCQKAFNZ3FHBYUTFOKICIY" />,
    );

    await waitFor(() =>
      expect(screen.getByTestId("asset-detail-core-registry-fallback")).toBeInTheDocument(),
    );

    expect(screen.getByRole("heading", { name: /^XTAR$/i })).toBeInTheDocument();
    expect(screen.getByTestId("asset-detail-core-registry-fallback")).toHaveClass(
      "public-detail-shell-cutover",
    );
    expect(screen.getByTestId("asset-detail-core-hero")).toHaveClass(
      "public-detail-hero-grid-cutover",
    );
    expect(screen.getByTestId("asset-detail-core-stage-grid")).toHaveClass(
      "public-detail-stage-grid-cutover",
    );
    expect(screen.getByTestId("asset-detail-core-hero")).toHaveTextContent("No exposure");
    expect(screen.getByTestId("asset-detail-core-metadata-panel")).toHaveClass(
      "public-detail-panel-cutover",
    );
    expect(screen.getByTestId("asset-detail-core-exposure-panel")).toHaveClass(
      "public-detail-panel-cutover",
    );
    expect(screen.getByTestId("asset-detail-core-metadata-table")).toHaveTextContent("XTAR");
    expect(screen.getByTestId("asset-detail-core-metadata-table")).toHaveClass(
      "public-detail-table-cutover",
    );
    expect(screen.getByTestId("asset-detail-core-metadata-table")).toHaveTextContent(
      "GAORYJ3KBDGI",
    );
    expect(screen.getByTestId("asset-detail-core-metadata-table")).toHaveTextContent(
      "53257IG4",
    );
    expect(screen.getByTestId("asset-detail-core-exposure-panel")).toHaveTextContent(
      "No exposure yet",
    );
    expect(screen.queryByTestId("asset-detail-net-position")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open asset explorer/i })).toHaveAttribute(
      "href",
      "/assets",
    );
    expect(screen.getByRole("link", { name: /create arka/i })).toHaveAttribute(
      "href",
      "/factory/create?asset=CDCKFBZYF2AQCSM3JOF2ZM27O3Y6AJAI4OTCQKAFNZ3FHBYUTFOKICIY",
    );
  });

  it("does not label a known asset as not indexed while the catalog is unavailable", async () => {
    vi.spyOn(global, "fetch").mockImplementation(async (input) => {
      const url =
        typeof input === "string"
          ? new URL(input, "http://localhost")
          : input instanceof URL ? input : new URL(input.url);
      expect(url.pathname).toMatch(/^\/api\/(assets\/core-registry|catalog)/);
      return new Response(
        JSON.stringify({
          message: "NEXT_PUBLIC_CATALOG_API_BASE_URL is not configured",
        }),
        {
          status: 503,
          headers: { "content-type": "application/json" },
        },
      );
    });

    render(
      <AssetDetailSurface assetId="CD25MNVTZDL4Y3XBCPCJXGXATV5WUHHOWMYFF4YBEGU5FCPGMYTVG5JY" />,
    );

    await waitFor(() =>
      expect(screen.getByTestId("asset-detail-core-registry-fallback")).toBeInTheDocument(),
    );

    expect(screen.getByTestId("asset-detail-core-hero")).toHaveTextContent(
      "Data unavailable",
    );
    expect(screen.getByTestId("asset-detail-core-exposure-panel")).toHaveTextContent(
      "Exposure temporarily unavailable",
    );
    expect(screen.getByTestId("asset-detail-core-exposure-panel")).not.toHaveTextContent(
      "No exposure yet",
    );
  });

  it("renders manager detail with telemetry and managed Arka cards", async () => {
    installCatalogFetchMock();

    render(
      <ManagerDetailSurface managerId="GCBBETA77RTH9KLMNOPQ2UVWX3YZ56789ABCDEFGHJKLMNPRSTUV4Y" />,
    );

    await waitFor(() =>
      expect(screen.getByTestId("manager-detail-hero")).toBeInTheDocument(),
    );

    expect(screen.getByTestId("manager-detail-fidelity-shell")).toBeInTheDocument();
    expect(screen.getByTestId("manager-detail-fidelity-shell")).toHaveClass(
      "public-detail-shell-cutover",
    );
    expect(screen.getByTestId("manager-detail-stage-grid")).toHaveClass(
      "explorer-detail-stage-cutover",
    );
    expect(screen.getByTestId("manager-detail-stage-grid")).toHaveClass(
      "public-detail-stage-grid-cutover",
    );
    expect(screen.getByTestId("manager-detail-hero")).toHaveClass(
      "public-detail-hero-grid-cutover",
    );
    expect(screen.getByTestId("manager-detail-trend")).toBeInTheDocument();
    expect(screen.getByTestId("manager-detail-history-panel")).toHaveClass(
      "public-detail-panel-cutover",
    );
    expect(screen.queryByText("Mandate overview")).not.toBeInTheDocument();
    expect(screen.getByTestId("manager-detail-arkas-panel")).toHaveClass(
      "public-detail-related-panel-cutover",
    );
    expect(screen.getByTestId("manager-detail-arkas-table")).toHaveTextContent(
      "Open Arka profile",
    );
    expect(screen.getByTestId("manager-detail-arkas-table")).toHaveClass(
      "explorer-related-grid-cutover",
    );
    expect(screen.getByTestId("manager-detail-arkas-table")).toHaveClass(
      "public-detail-related-grid-cutover",
    );
    expect(screen.getAllByTestId("manager-detail-arka-card")).toHaveLength(1);
    expect(screen.getAllByTestId("manager-detail-arka-card")[0]).toHaveClass(
      "public-detail-related-card-cutover",
    );
    expect(screen.getByTestId("manager-detail-arkas-table")).not.toHaveTextContent(
      "Share token",
    );
  });

  it("sanitizes catalog configuration errors and keeps retry visible", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          error: "catalog_not_configured",
          message: "Set CATALOG_API_BASE_URL or NEXT_PUBLIC_CATALOG_API_BASE_URL.",
        }),
        {
          status: 503,
          headers: { "content-type": "application/json" },
        },
      ),
    );

    render(<ManagersSurface />);

    await waitFor(() =>
      expect(screen.getByTestId("managers-catalog-offline")).toBeInTheDocument(),
    );

    expect(screen.getByTestId("managers-catalog-offline")).toHaveTextContent(
      "Manager explorer data is not available",
    );
    expect(screen.getByTestId("managers-catalog-offline")).toHaveTextContent(
      "could not be loaded right now",
    );
    expect(screen.getByTestId("managers-catalog-offline")).not.toHaveTextContent(
      "CATALOG_API_BASE_URL",
    );
    const retryButtons = screen.getAllByRole("button", { name: /retry/i });
    expect(retryButtons.length).toBeGreaterThanOrEqual(1);
  });

  it("uses fallback-aware offline copy for asset explorer configuration failures", async () => {
    vi.spyOn(global, "fetch").mockImplementation(async (input) => {
      const url =
        typeof input === "string"
          ? new URL(input, "http://localhost")
          : input instanceof URL ? input : new URL(input.url);
      if (url.pathname === "/api/assets/core-registry") {
        return new Response(JSON.stringify({ generatedAt: "2026-04-25T18:00:00.000Z", items: [] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(
        JSON.stringify({
          error: "catalog_not_configured",
          message: "Set CATALOG_API_BASE_URL or NEXT_PUBLIC_CATALOG_API_BASE_URL.",
        }),
        {
          status: 503,
          headers: { "content-type": "application/json" },
        },
      );
    });

    render(<AssetsSurface />);

    await waitFor(() =>
      expect(screen.getByTestId("assets-catalog-offline")).toBeInTheDocument(),
    );

    expect(screen.getByTestId("assets-catalog-offline")).toHaveTextContent(
      "Asset explorer data is not available",
    );
    expect(screen.getByTestId("assets-catalog-offline")).toHaveTextContent(
      "could not be loaded right now",
    );
    expect(screen.queryByTestId("assets-telemetry-catalog-offline")).not.toBeInTheDocument();
  });

  it("reorders asset spotlight cards with truthful alternate lanes", async () => {
    installCatalogFetchMock();
    const user = userEvent.setup();

    render(<AssetsSurface />);

    await waitFor(() =>
      expect(screen.getByTestId("assets-list")).toBeInTheDocument(),
    );

    expect(screen.getByTestId("assets-workspace-grid")).toHaveClass(
      "assets-workspace-grid",
    );
    expect(screen.getByTestId("assets-list-panel")).toHaveClass(
      "assets-list-workspace-panel",
    );
    expect(screen.getByTestId("assets-hero-aside")).toHaveTextContent(
      "Assets",
    );
    expect(screen.getByTestId("assets-public-metric-footprint")).toHaveTextContent(
      "TVL",
    );
    expect(screen.getByTestId("assets-public-metric-footprint")).not.toHaveTextContent(
      /\b\d+(?:\.\d)?B\b|Managed footprint/i,
    );
    expect(screen.getByTestId("assets-public-metric-footprint")).toHaveClass(
      "public-figma-metric-card-footprint",
    );
    expect(screen.getByTestId("assets-public-metric-indexed")).toHaveTextContent(
      "Assets",
    );
    expect(screen.getByTestId("assets-public-metric-indexed")).toHaveClass(
      "public-figma-metric-card-indexed",
    );
    expect(screen.getByTestId("assets-public-metric-balanceSheet")).toHaveTextContent(
      "Collateral",
    );
    expect(screen.getByTestId("assets-public-metric-balanceSheet")).toHaveClass(
      "public-figma-metric-card-balanceSheet",
    );
    expect(screen.queryByTestId("assets-core-registry-panel")).not.toBeInTheDocument();
    expect(screen.getByTestId("assets-spotlight-tabs")).toHaveTextContent(
      "Core exposure",
    );
    expect(screen.getByTestId("assets-list-panel")).toHaveClass(
      "assets-command-panel-cutover",
    );
    expect(screen.queryByTestId("assets-command-evidence")).not.toBeInTheDocument();
    expect(screen.queryByTestId("assets-leaderboard-table")).not.toBeInTheDocument();
    expect(
      within(screen.getAllByTestId("asset-card")[0]!).getByText(/^BLND$/i),
    ).toBeInTheDocument();
    expect(
      within(screen.getAllByTestId("asset-card")[0]!).getByText(/CD25MNVTZD/i),
    ).toBeInTheDocument();
    expect(
      within(screen.getAllByTestId("asset-card")[0]!).getByText(/Value share 45.16%/),
    ).toBeInTheDocument();
    expect(
      within(screen.getAllByTestId("asset-card")[0]!).getByRole("link", {
        name: /open asset detail/i,
      }),
    ).toHaveAttribute(
      "href",
      "/assets/CD25MNVTZDL4Y3XBCPCJXGXATV5WUHHOWMYFF4YBEGU5FCPGMYTVG5JY",
    );

    await user.click(screen.getByTestId("assets-spotlight-tab-balance-sheet"));

    await waitFor(() =>
      expect(
        within(screen.getAllByTestId("asset-card")[0]!).getByText(/CD25MNVTZD/i),
      ).toBeInTheDocument(),
    );
  });

  it("restores asset controls from the URL and keeps spotlight state bookmarkable", async () => {
    installCatalogFetchMock();
    const user = userEvent.setup();
    window.history.replaceState(
      null,
      "",
      "/assets?q=BLND&spotlight=balanceSheet",
    );

    render(<AssetsSurface />);

    await waitFor(() =>
      expect(screen.getByTestId("assets-list")).toBeInTheDocument(),
    );
    expect(screen.getByTestId("assets-search-input")).toHaveValue("BLND");
    expect(screen.getByTestId("assets-spotlight-tab-balance-sheet")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByTestId("assets-list-panel")).toHaveTextContent(/BLND|CBLND/i);
    expect(screen.queryByTestId("assets-public-metric-scope")).not.toBeInTheDocument();

    await user.type(screen.getByTestId("assets-search-input"), "x");

    await waitFor(() =>
      expect(window.location.search).toContain("q=BLNDx"),
    );
    expect(screen.getByTestId("assets-search-input")).toHaveFocus();
    expect(window.location.search).toContain("spotlight=balanceSheet");
  });

  it("announces asset refresh while preserving indexed rows during a slower filter", async () => {
    const gate = createDeferredFetchGate();
    vi.spyOn(global, "fetch").mockImplementation(async (input) => {
      const url =
        typeof input === "string"
          ? new URL(input, "http://localhost")
          : input instanceof URL ? input : new URL(input.url);
      if (url.pathname === "/api/assets/core-registry") {
        return buildCoreRegistryResponse();
      }
      if (
        url.pathname === "/api/catalog/v1/assets" &&
        url.searchParams.get("search")?.toLowerCase() === "usdc"
      ) {
        await gate.wait();
      }
      return buildCatalogResponse(url);
    });

    render(<AssetsSurface />);

    await waitFor(() =>
      expect(screen.getByTestId("assets-list-panel")).toHaveTextContent("USDC"),
    );
    expect(screen.getAllByTestId("asset-card").length).toBeGreaterThan(0);

    fireEvent.change(screen.getByTestId("assets-search-input"), {
      target: { value: "usdc" },
    });

    await waitFor(() =>
      expect(screen.getByTestId("assets-refresh-status")).toHaveAttribute(
        "role",
        "status",
      ),
    );
    expect(screen.getByTestId("assets-fidelity-shell")).toHaveAttribute(
      "aria-busy",
      "true",
    );
    expect(screen.getByTestId("assets-list-panel")).toHaveTextContent("USDC");
    expect(screen.getAllByTestId("asset-card").length).toBeGreaterThan(0);

    gate.release();

    await waitFor(() =>
      expect(screen.queryByTestId("assets-refresh-status")).not.toBeInTheDocument(),
    );
    expect(screen.getByTestId("assets-fidelity-shell")).toHaveAttribute(
      "aria-busy",
      "false",
    );
    expect(screen.getByTestId("assets-list-panel")).toHaveTextContent("USDC");
  });
});
