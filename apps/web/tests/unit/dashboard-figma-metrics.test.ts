import { describe, expect, it } from "vitest";
import {
  buildDashboardFigmaMetricTiles,
  buildDiscoverStageTiles,
} from "@/lib/catalog/dashboardDiscoverSurfaces";
import { resolveCatalogFixture } from "@/lib/catalog/testFixtures";
import type {
  ArkaHistoryPoint,
  DashboardBundle,
  DashboardComposition,
  DashboardOverview,
  DiscoverBundle,
  MonitoringStatus,
  Page,
  RankedArkaCatalogEntry,
  RankedAssetCatalogEntry,
  RankedManagerCatalogEntry,
} from "@/lib/catalog/types";

function buildDashboardBundle(): DashboardBundle {
  const arkas = resolveCatalogFixture(
    "/v1/arkas",
    new URLSearchParams(),
  ) as Page<RankedArkaCatalogEntry>;

  return {
    overview: resolveCatalogFixture(
      "/v1/dashboard/overview",
      new URLSearchParams(),
    ) as DashboardOverview,
    composition: resolveCatalogFixture(
      "/v1/dashboard/composition",
      new URLSearchParams(),
    ) as DashboardComposition,
    monitoring: resolveCatalogFixture(
      "/v1/monitoring/status",
      new URLSearchParams(),
    ) as MonitoringStatus,
    managers: resolveCatalogFixture(
      "/v1/managers",
      new URLSearchParams(),
    ) as Page<RankedManagerCatalogEntry>,
    arkas,
    featuredHistory: Object.fromEntries(
      arkas.items.map((entry) => [
        entry.arkaId,
        resolveCatalogFixture(
          `/v1/arkas/${entry.arkaId}/history`,
          new URLSearchParams([
            ["order", "asc"],
            ["limit", "24"],
          ]),
        ) as Page<ArkaHistoryPoint>,
      ]),
    ),
  };
}

function buildDiscoverBundle(): DiscoverBundle {
  return {
    overview: resolveCatalogFixture(
      "/v1/dashboard/overview",
      new URLSearchParams(),
    ) as DashboardOverview,
    arkas: resolveCatalogFixture(
      "/v1/arkas",
      new URLSearchParams(),
    ) as Page<RankedArkaCatalogEntry>,
    managers: resolveCatalogFixture(
      "/v1/managers",
      new URLSearchParams(),
    ) as Page<RankedManagerCatalogEntry>,
    assets: resolveCatalogFixture(
      "/v1/assets",
      new URLSearchParams(),
    ) as Page<RankedAssetCatalogEntry>,
  };
}

describe("Figma-style public metric decks", () => {
  it("builds Dashboard metric cards from catalog data instead of decorative copy", () => {
    const bundle = buildDashboardBundle();
    const tiles = buildDashboardFigmaMetricTiles(bundle);

    expect(tiles.map((tile) => tile.id)).toEqual([
      "arkas",
      "nav",
      "withdrawals",
      "deposits",
      "managers",
      "assets",
      "activity",
      "health",
    ]);
    expect(tiles.find((tile) => tile.id === "nav")).toMatchObject({
      label: "TVL",
      value: "11050000",
      valueKind: "amount",
      detail: "total value in USD",
      tone: "positive",
    });
    expect(tiles.find((tile) => tile.id === "withdrawals")).toMatchObject({
      value: String(bundle.overview.activity.counts.redeem),
      detail: "redemptions recorded",
    });
    expect(tiles.find((tile) => tile.id === "deposits")).toMatchObject({
      value: String(bundle.overview.activity.counts.deposit),
      detail: "deposits recorded",
    });
    expect(tiles.find((tile) => tile.id === "managers")).toMatchObject({
      label: "Managers",
      value: String(bundle.overview.totalManagers),
      detail: `${bundle.managers.total} manager profiles`,
    });
    expect(tiles.find((tile) => tile.id === "assets")).toMatchObject({
      label: "Assets",
      value: String(bundle.overview.totalAssets),
      detail: `${bundle.composition.items.length} current exposures`,
    });
    expect(tiles.find((tile) => tile.id === "activity")).toMatchObject({
      label: "Recent actions",
      value: String(bundle.overview.activity.totalEvents),
      detail: `${bundle.overview.activity.uniqueUsers} wallets involved`,
    });
    expect(tiles.find((tile) => tile.id === "health")).toMatchObject({
      label: "Health",
      value: bundle.monitoring.healthy ? "Healthy" : "Offline",
      detail: `${bundle.monitoring.snapshotAgeSeconds ?? "n/a"}s since update`,
    });
    expect(tiles.find((tile) => tile.id === "profit")).toBeUndefined();
    expect(tiles.find((tile) => tile.id === "volume")).toBeUndefined();
    expect(tiles.find((tile) => tile.id === "manager-fees")).toBeUndefined();

    for (const tile of tiles) {
      expect(tile.label).not.toMatch(/\b(fake|stub|placeholder|todo)\b/i);
      expect(tile.value).not.toMatch(/\b(undefined|NaN)\b/i);
      expect(tile.detail).not.toMatch(/\b(fake|stub|placeholder|todo|undefined|NaN)\b/i);
    }
  });

  it("keeps the Discover metric deck aligned with the same real catalog totals", () => {
    const bundle = buildDiscoverBundle();
    const tiles = buildDiscoverStageTiles(bundle, { curatedOnly: true });

    expect(tiles).toHaveLength(8);
    expect(tiles.find((tile) => tile.id === "arkas")).toMatchObject({
      value: String(bundle.overview.totalArkas),
    });
    expect(tiles.find((tile) => tile.id === "managers")).toMatchObject({
      value: String(bundle.overview.totalManagers),
      detail: `${bundle.managers.items.length} visible managers`,
    });
    expect(tiles.find((tile) => tile.id === "assets")).toMatchObject({
      value: String(bundle.overview.totalAssets),
      detail: `${bundle.assets.items.length} tracked exposures`,
    });
    expect(tiles.find((tile) => tile.id === "nav")).toMatchObject({
      label: "TVL",
      value: "Valuation unavailable",
      detail: "1 Arka needs USD pricing before TVL can be shown",
    });
    expect(tiles.find((tile) => tile.id === "curated")).toMatchObject({
      label: "Curated",
      value: String(bundle.arkas.items.filter((entry) => entry.curated).length),
      detail: expect.stringContaining("delisted"),
    });
    expect(tiles.find((tile) => tile.id === "routes")).toMatchObject({
      label: "Allowed assets",
      value: String(
        bundle.arkas.items.reduce(
          (total, entry) => total + entry.whitelistContracts.length,
          0,
        ),
      ),
      detail: "current mandates",
    });
    expect(tiles.find((tile) => tile.id === "base")).toMatchObject({
      label: "Denominations",
      value: String(
        new Set(
          bundle.arkas.items
            .map((entry) => entry.denominationContract)
            .filter(Boolean),
        ).size,
      ),
      detail: "accounting assets",
    });
    expect(tiles.find((tile) => tile.id === "scope")).toMatchObject({
      label: "Scope",
      value: "Curated",
      detail: "curated shortlist",
      tone: "positive",
    });
    const tileIds = tiles.map((tile) => tile.id as string);
    expect(tileIds).not.toContain("withdrawals");
    expect(tileIds).not.toContain("deposits");
    expect(tileIds).not.toContain("manager-fees");
    expect(tileIds).not.toContain("profit");
    expect(tileIds).not.toContain("protocol-fees");
    expect(tileIds).not.toContain("volume");
  });
});
