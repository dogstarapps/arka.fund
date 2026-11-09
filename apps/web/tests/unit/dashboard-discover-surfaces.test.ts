import { describe, expect, it } from "vitest";
import {
  buildDashboardActivitySignals,
  buildDashboardFeaturedEmptyCopy,
  buildDashboardFeaturedArkas,
  buildDashboardStageSummary,
  buildDiscoverFeaturedArkas,
  buildDiscoverStageTiles,
  buildDiscoverSummarySignals,
  sortDiscoverFeaturedEntries,
} from "@/lib/catalog/dashboardDiscoverSurfaces";
import { resolveCatalogFixture } from "@/lib/catalog/testFixtures";
import type {
  DashboardOverview,
  DiscoverBundle,
  Page,
  ArkaHistoryPoint,
  RankedArkaCatalogEntry,
  RankedAssetCatalogEntry,
  RankedManagerCatalogEntry,
} from "@/lib/catalog/types";

describe("dashboardDiscoverSurfaces", () => {
  it("builds featured dashboard Arkas with truthful share percentages", () => {
    const arkas = resolveCatalogFixture("/v1/arkas", new URLSearchParams()) as Page<RankedArkaCatalogEntry>;
    const overview = resolveCatalogFixture("/v1/dashboard/overview", new URLSearchParams()) as DashboardOverview;
    const featured = buildDashboardFeaturedArkas(arkas.items, overview.totalNav);

    expect(featured).toHaveLength(3);
    expect(featured[0].rank).toBe(1);
    expect(featured[0].leadAssetContract).toContain("CCW67TSZ");
    expect(featured[0].navSharePct).toBeCloseTo(47.05, 2);
    expect(featured[0].navSharePct).toBeLessThanOrEqual(100);
    expect(featured[2].navSharePct).toBeCloseTo(16.28, 2);
  });

  it("combines credit activity into a single dashboard signal", () => {
    const overview = resolveCatalogFixture("/v1/dashboard/overview", new URLSearchParams()) as DashboardOverview;
    const signals = buildDashboardActivitySignals(overview.activity);

    expect(signals.map((signal) => signal.id)).toEqual(["deposit", "redeem", "credit"]);
    expect(signals[2].count).toBe(
      overview.activity.counts.lend +
        overview.activity.counts.borrow +
        overview.activity.counts.repay +
        overview.activity.counts.withdraw,
    );
  });

  it("builds a bounded stage summary for the dashboard hero chart", () => {
    const overview = resolveCatalogFixture("/v1/dashboard/overview", new URLSearchParams()) as DashboardOverview;
    const arkas = resolveCatalogFixture("/v1/arkas", new URLSearchParams()) as Page<RankedArkaCatalogEntry>;
    const managers = resolveCatalogFixture("/v1/managers", new URLSearchParams()) as Page<RankedManagerCatalogEntry>;
    const composition = resolveCatalogFixture("/v1/dashboard/composition", new URLSearchParams()) as import("@/lib/catalog/types").DashboardComposition;
    const monitoring = resolveCatalogFixture("/v1/dashboard/monitoring", new URLSearchParams()) as import("@/lib/catalog/types").MonitoringStatus;
    const featuredHistory = Object.fromEntries(
      arkas.items.map((entry) => [
        entry.arkaId,
        resolveCatalogFixture(
          `/v1/arkas/${entry.arkaId}/history`,
          new URLSearchParams([["order", "asc"], ["limit", "24"]]),
        ) as Page<ArkaHistoryPoint>,
      ]),
    );

    const stage = buildDashboardStageSummary({
      overview,
      arkas,
      featuredHistory,
      managers,
      composition,
      monitoring,
    });

    expect(stage.stageValue).toBe(overview.totalNavUsdEstimate);
    expect(stage.stageDeltaLabel).toBe("n/a");
    expect(stage.stageDeltaDetail).toBe(
      "USD value history will appear once two indexed valuations are available.",
    );
    expect(stage.rangeOptions.every((option) => !option.enabled)).toBe(true);
    expect(stage.rangeOptions.find((option) => option.id === "1w")).toMatchObject({
      enabled: false,
      pointCount: 0,
      unavailableReason: "USD value history will appear once two indexed valuations are available.",
    });
    expect(stage.rangeOptions.find((option) => option.id === "1d")).toMatchObject({
      enabled: false,
      pointCount: 0,
      unavailableReason: "USD value history will appear once two indexed valuations are available.",
    });
    expect(stage.selectedRange).toBe("all");
    expect(stage.points).toEqual([]);
  });

  it("does not invent dashboard chart points when history is not indexed", () => {
    const overview = resolveCatalogFixture("/v1/dashboard/overview", new URLSearchParams()) as DashboardOverview;
    const arkas = resolveCatalogFixture("/v1/arkas", new URLSearchParams()) as Page<RankedArkaCatalogEntry>;
    const managers = resolveCatalogFixture("/v1/managers", new URLSearchParams()) as Page<RankedManagerCatalogEntry>;
    const composition = resolveCatalogFixture("/v1/dashboard/composition", new URLSearchParams()) as import("@/lib/catalog/types").DashboardComposition;
    const monitoring = resolveCatalogFixture("/v1/dashboard/monitoring", new URLSearchParams()) as import("@/lib/catalog/types").MonitoringStatus;

    const stage = buildDashboardStageSummary({
      overview,
      arkas,
      featuredHistory: {},
      managers,
      composition,
      monitoring,
    });

    expect(stage.stageValue).toBe(overview.totalNavUsdEstimate);
    expect(stage.points).toEqual([]);
    expect(stage.chartLabels).toEqual([]);
    expect(stage.rangeOptions.every((option) => !option.enabled)).toBe(true);
    expect(stage.rangeOptions.every((option) => option.pointCount === 0)).toBe(true);
    expect(
      stage.rangeOptions.every(
        (option) =>
          option.unavailableReason ===
          "USD value history will appear once two indexed valuations are available.",
      ),
    ).toBe(true);
    expect(stage.points.some((point) => point.id.startsWith("fallback-"))).toBe(false);
  });

  it("describes dashboard featured empty states by active lane", () => {
    expect(buildDashboardFeaturedEmptyCopy("ranked")).toMatchObject({
      title: "No ranked Arkas",
      body: "No Arkas are available yet.",
    });
    expect(buildDashboardFeaturedEmptyCopy("curated")).toMatchObject({
      title: "No curated Arkas",
      body: "No curated Arkas are available yet.",
    });
    expect(buildDashboardFeaturedEmptyCopy("fresh")).toMatchObject({
      title: "No recently synced Arkas",
      body: "No recently added Arkas are available yet.",
    });
  });

  it("builds discover summary signals for search and scope", () => {
    const bundle: DiscoverBundle = {
      overview: resolveCatalogFixture("/v1/dashboard/overview", new URLSearchParams()) as DashboardOverview,
      arkas: resolveCatalogFixture("/v1/arkas", new URLSearchParams()) as Page<RankedArkaCatalogEntry>,
      managers: resolveCatalogFixture("/v1/managers", new URLSearchParams()) as Page<RankedManagerCatalogEntry>,
      assets: resolveCatalogFixture("/v1/assets", new URLSearchParams()) as Page<RankedAssetCatalogEntry>,
    };
    const signals = buildDiscoverSummarySignals(bundle, {
      curatedOnly: false,
      search: "gamma",
    });

    expect(signals[0]).toMatchObject({
      id: "arkas",
      value: String(bundle.arkas.total),
      detail: 'matching "gamma"',
    });
    expect(signals[3]).toMatchObject({
      id: "scope",
      value: "All",
      detail: "full view",
    });
  });

  it("builds discover stage tiles from live bundle totals", () => {
    const bundle: DiscoverBundle = {
      overview: resolveCatalogFixture("/v1/dashboard/overview", new URLSearchParams()) as DashboardOverview,
      arkas: resolveCatalogFixture("/v1/arkas", new URLSearchParams()) as Page<RankedArkaCatalogEntry>,
      managers: resolveCatalogFixture("/v1/managers", new URLSearchParams()) as Page<RankedManagerCatalogEntry>,
      assets: resolveCatalogFixture("/v1/assets", new URLSearchParams()) as Page<RankedAssetCatalogEntry>,
    };
    const tiles = buildDiscoverStageTiles(bundle, { curatedOnly: true });

    expect(tiles).toHaveLength(8);
    expect(tiles[0]).toMatchObject({
      id: "arkas",
      value: String(bundle.arkas.total),
    });
    expect(tiles[1]).toMatchObject({
      id: "nav",
      label: "TVL",
      value: "Valuation unavailable",
      detail: "1 Arka needs USD pricing before TVL can be shown",
      tone: "warning",
    });
    expect(tiles.find((tile) => tile.id === "managers")).toMatchObject({
      label: "Managers",
      value: String(bundle.overview.totalManagers),
    });
    expect(tiles.find((tile) => tile.id === "assets")).toMatchObject({
      label: "Assets",
      value: String(bundle.overview.totalAssets),
    });
    expect(tiles.find((tile) => tile.id === "curated")).toMatchObject({
      label: "Curated",
      value: String(bundle.arkas.items.filter((entry) => entry.curated).length),
    });
    expect(tiles.find((tile) => tile.id === "routes")).toMatchObject({
      label: "Allowed assets",
      detail: "current mandates",
    });
    expect(tiles.find((tile) => tile.id === "base")).toMatchObject({
      label: "Denominations",
      detail: "accounting assets",
    });
    expect(tiles.find((tile) => tile.id === "scope")).toMatchObject({
      label: "Scope",
      value: "Curated",
      detail: "curated shortlist",
    });
    const tileIds = tiles.map((tile) => tile.id as string);
    expect(tileIds).not.toContain("withdrawals");
    expect(tileIds).not.toContain("deposits");
    expect(tileIds).not.toContain("manager-fees");
    expect(tileIds).not.toContain("profit");
    expect(tileIds).not.toContain("protocol-fees");
  });

  it("builds featured discover Arkas with truthful allocation bands", () => {
    const arkas = resolveCatalogFixture("/v1/arkas", new URLSearchParams()) as Page<RankedArkaCatalogEntry>;
    const featured = buildDiscoverFeaturedArkas(arkas.items);

    expect(featured).toHaveLength(3);
    expect(featured[0]).toMatchObject({
      rank: 1,
      assetCount: 3,
      whitelistCount: 3,
      curated: true,
    });
    expect(featured[0].feesLabel).toContain("2.00%");
    expect(featured[0].allocationBands).toHaveLength(3);
    expect(featured[0].allocationBands[0]).toMatchObject({
      isDenomination: true,
    });
    expect(featured[0].allocationBands[0].sharePct).toBeCloseTo(44.68, 2);
  });

  it("sorts discover featured entries by profit, search matches and latest sync", () => {
    const arkas = resolveCatalogFixture("/v1/arkas", new URLSearchParams()) as Page<RankedArkaCatalogEntry>;

    const profitSorted = sortDiscoverFeaturedEntries(arkas.items, "profit");
    const searchSorted = sortDiscoverFeaturedEntries(arkas.items, "search", "gamma");
    const freshSorted = sortDiscoverFeaturedEntries(arkas.items, "fresh");

    expect(profitSorted[0]?.arkaId).toContain("CA7BETA");
    expect(searchSorted[0]?.arkaId).toContain("CA7GAMMA");
    expect(Date.parse(freshSorted[0]?.syncedAt ?? "")).toBeGreaterThanOrEqual(
      Date.parse(freshSorted[1]?.syncedAt ?? ""),
    );
  });
});
