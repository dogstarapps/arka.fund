import { describe, expect, it } from "vitest";
import {
  fixtureAssetsPage,
  fixtureManagersPage,
} from "@/lib/catalog/testFixtures";
import {
  buildAssetPublicMetricTiles,
  buildAssetMarketMetrics,
  buildAssetSpotlightCards,
  buildAssetTelemetrySignals,
  buildManagerSpotlightCards,
  buildManagerTelemetrySignals,
  computeShareBps,
  computeSharePct,
  computeSpotlightWidthByRank,
  computeSpotlightWidthByShare,
  sortAssetsForSpotlight,
  sortManagersForSpotlight,
} from "@/lib/catalog/explorerSurfaces";

describe("explorer surface helpers", () => {
  it("computes share basis points for ranked concentration", () => {
    expect(computeShareBps("250", "1000")).toBe(2500);
    expect(computeShareBps("0", "1000")).toBe(0);
  });

  it("keeps spotlight share widths exact instead of inflating small values", () => {
    expect(computeSharePct("10", "1000")).toBe(1);
    expect(computeSpotlightWidthByShare("10", "1000")).toBe(1);
    expect(computeSpotlightWidthByShare("800", "1000")).toBe(80);
    expect(computeSpotlightWidthByShare("1000", "1000")).toBe(100);
  });

  it("clamps spotlight widths derived from rank", () => {
    expect(computeSpotlightWidthByRank(1)).toBe(100);
    expect(computeSpotlightWidthByRank(3)).toBe(33);
    expect(computeSpotlightWidthByRank(25)).toBe(18);
  });

  it("builds manager spotlight cards with truthful NAV share", () => {
    const page = fixtureManagersPage();
    page.items[0] = {
      ...page.items[0]!,
      identity: {
        manager: page.items[0]!.manager,
        displayName: "Arka.fund Core Manager",
        description: "Curated Mainnet manager",
        avatarUrl: null,
        websiteUrl: "https://arka.fund/",
        socialUrl: null,
        trustState: "curated",
        updatedAt: "2026-07-20T10:00:00.000Z",
        updatedBy: page.items[0]!.manager,
      },
    };
    const cards = buildManagerSpotlightCards(page);

    expect(cards).toHaveLength(3);
    expect(cards[0]).toMatchObject({
      rank: 1,
      arkaCount: 2,
      curatedArkaCount: 1,
    });
    expect(cards[0].identity?.displayName).toBe("Arka.fund Core Manager");
    expect(cards[0].navSharePct).toBeCloseTo(55.65, 2);
    expect(cards[2].navSharePct).toBeCloseTo(16.28, 2);
  });

  it("builds asset spotlight cards with truthful estimated value share", () => {
    const page = fixtureAssetsPage();
    const cards = buildAssetSpotlightCards(page);

    expect(cards).toHaveLength(5);
    expect(cards[0]).toMatchObject({
      rank: 1,
      arkaCount: 4,
      managerCount: 3,
    });
    expect(cards[0].managedSharePct).toBeCloseTo(6.45, 2);
    expect(cards[4].managedSharePct).toBeCloseTo(9.67, 2);
  });

  it("derives asset market price proxy and movement from indexed history", () => {
    const page = fixtureAssetsPage();
    const usdc = page.items[0]!;
    const metrics = buildAssetMarketMetrics(usdc, [
      {
        ...usdc,
        netPositionValue: "380000",
        syncedAt: "2026-04-10T00:00:00.000Z",
      },
      {
        ...usdc,
        netPositionValue: "400000",
        syncedAt: "2026-04-11T00:00:00.000Z",
      },
    ]);

    expect(metrics.priceProxyBps).toBe(898);
    expect(metrics.movementBps).toBe(526);
    expect(metrics.movementTone).toBe("positive");
    expect(metrics.movementSource).toBe("history");
    expect(
      buildAssetMarketMetrics(usdc, [{ ...usdc, syncedAt: "2026-04-11T00:00:00.000Z" }]),
    ).toMatchObject({
      movementBps: null,
      movementSource: "insufficient_history",
    });
  });

  it("builds public asset metric tiles from catalog values instead of decorative copy", () => {
    const page = fixtureAssetsPage();
    const tiles = buildAssetPublicMetricTiles(page, { search: "usdc" });
    const byId = new Map(tiles.map((tile) => [tile.id, tile]));
    const totalValue = page.items.reduce(
      (accumulator, item) => accumulator + BigInt(item.netManagedUsdEstimate ?? "0"),
      BigInt(0),
    );
    const valueLeader = [...page.items].sort((left, right) => {
      const diff = BigInt(right.netManagedUsdEstimate ?? "0") - BigInt(left.netManagedUsdEstimate ?? "0");
      if (diff !== BigInt(0)) return diff > BigInt(0) ? 1 : -1;
      return left.rank - right.rank;
    })[0]!;
    const collateralLinkedCount = page.items.filter(
      (item) => BigInt(item.collateralAmount) > BigInt(0),
    ).length;
    const totalDebtLinked = page.items.filter(
      (item) => BigInt(item.debtAmount) > BigInt(0),
    ).length;

    expect(tiles.map((tile) => tile.id)).toEqual([
      "indexed",
      "footprint",
      "leader",
      "leadShare",
      "balanceSheet",
      "debtLinked",
      "scope",
    ]);
    expect(byId.get("indexed")).toMatchObject({
      value: String(page.total),
      valueKind: "integer",
    });
    expect(byId.get("footprint")).toMatchObject({
      label: "TVL",
      value: totalValue.toString(),
      valueKind: "amount",
      detail: "Total USD value across these assets.",
    });
    expect(byId.get("leader")).toMatchObject({
      label: "Largest exposure",
      value: valueLeader.assetContract,
    });
    expect(byId.get("leadShare")).toMatchObject({
      label: "Largest exposure value",
      value: valueLeader.netManagedUsdEstimate,
      valueKind: "amount",
    });
    expect(byId.get("balanceSheet")).toMatchObject({
      label: "Collateral",
      value: `${collateralLinkedCount}/${page.items.length}`,
      valueKind: "text",
      tone: collateralLinkedCount > 0 ? "warning" : "positive",
    });
    expect(byId.get("debtLinked")).toMatchObject({
      value: `${totalDebtLinked}/${page.items.length}`,
    });
    expect(byId.get("scope")).toMatchObject({
      value: "Focused",
      detail: 'Filtered around "usdc" without changing the ranked asset set.',
    });
    expect(JSON.stringify(tiles)).not.toMatch(
      /\b(undefined|NaN|fake|stub|placeholder|lorem)\b/i,
    );
  });

  it("does not turn an unpriced asset into a USD total", () => {
    const page = fixtureAssetsPage();
    page.items[0] = { ...page.items[0]!, netManagedUsdEstimate: null };

    const tiles = buildAssetPublicMetricTiles(page, { search: "" });
    const byId = new Map(tiles.map((tile) => [tile.id, tile]));
    const cards = buildAssetSpotlightCards(page);

    expect(byId.get("footprint")).toMatchObject({
      value: "Valuation unavailable",
      valueKind: "text",
    });
    expect(cards[0]?.managedSharePct).toBe(0);
  });

  it("builds manager and asset telemetry signals for the current search posture", () => {
    const managers = buildManagerTelemetrySignals(fixtureManagersPage(), { search: "beta" });
    const assets = buildAssetTelemetrySignals(fixtureAssetsPage(), { search: "" });

    expect(managers[2]).toMatchObject({
      label: "Search posture",
      value: "Focused",
      detail: "filtered around beta",
    });
    expect(assets[2]).toMatchObject({
      label: "Search posture",
      value: "Full set",
      detail: "showing full ranked asset set",
    });
  });

  it("sorts manager and asset spotlight lanes by real alternate modes", () => {
    const managers = sortManagersForSpotlight(fixtureManagersPage().items, "search", "beta");
    const assets = sortAssetsForSpotlight(fixtureAssetsPage().items, "balanceSheet", "");
    const coreAssets = sortAssetsForSpotlight(fixtureAssetsPage().items, "core", "");

    expect(managers[0]?.manager).toContain("GCBBETA");
    expect(assets[0]?.assetContract).toBe(
      "CD25MNVTZDL4Y3XBCPCJXGXATV5WUHHOWMYFF4YBEGU5FCPGMYTVG5JY",
    );
    expect(coreAssets[0]?.assetContract).toBe(
      "CD25MNVTZDL4Y3XBCPCJXGXATV5WUHHOWMYFF4YBEGU5FCPGMYTVG5JY",
    );
  });
});
