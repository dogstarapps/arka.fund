import { describe, expect, it } from "vitest";
import {
  applyActivityFallbackMetric,
  buildCatalogDerivedMetrics,
  deriveActivityMetrics,
  normalizeVaultSortMetric,
  normalizeVaultSortOrder,
  rankVaultLeaderboardEntries,
} from "@/lib/catalog/leaderboardArkas";
import { fixtureArkasPage } from "@/lib/catalog/testFixtures";
import type { ActivityEntry } from "@/lib/catalog/types";

describe("vault leaderboard ranking helpers", () => {
  it("normalizes metric/order query params", () => {
    expect(normalizeVaultSortMetric("profit")).toBe("profit");
    expect(normalizeVaultSortMetric("invalid")).toBe("rank");
    expect(normalizeVaultSortOrder("rank", null)).toBe("asc");
    expect(normalizeVaultSortOrder("profit", null)).toBe("desc");
    expect(normalizeVaultSortOrder("profit", "asc")).toBe("asc");
  });

  it("ranks by catalog profit and volume", () => {
    const page = fixtureArkasPage({ curated: true, limit: 24 });
    const metrics = buildCatalogDerivedMetrics(page.items);

    const byProfit = rankVaultLeaderboardEntries(
      page.items,
      "profit",
      "desc",
      metrics,
    );
    expect(byProfit[0]?.arkaId).toContain("CA7BETA");

    const byVolume = rankVaultLeaderboardEntries(
      page.items,
      "volume",
      "desc",
      metrics,
    );
    expect(byVolume[0]?.arkaId).toContain("CA7ALPHA");
  });

  it("uses activity fallback when catalog metric is unavailable", () => {
    const page = fixtureArkasPage({ curated: true, limit: 24 });
    const alphaId = page.items[0]?.arkaId;
    if (!alphaId) throw new Error("Fixture is empty.");

    const withoutProfit = page.items.map((entry) =>
      entry.arkaId === alphaId ? { ...entry, profitBase: null } : entry,
    );
    const catalogMetrics = buildCatalogDerivedMetrics(withoutProfit);
    expect(catalogMetrics[alphaId]?.profit.value).toBeNull();

    const fallbackMetrics = applyActivityFallbackMetric(catalogMetrics, "profit", {
      [alphaId]: 999_000,
    });
    expect(fallbackMetrics[alphaId]?.profit.value).toBe(999_000);
    expect(fallbackMetrics[alphaId]?.profit.source).toBe("activity");

    const ranked = rankVaultLeaderboardEntries(
      withoutProfit,
      "profit",
      "desc",
      fallbackMetrics,
    );
    expect(ranked[0]?.arkaId).toBe(alphaId);
  });

  it("derives profit/volume from activity entries", () => {
    const entries: ActivityEntry[] = [
      {
        eventId: "evt-1",
        cursor: "evt-1",
        arkaId: "CAAA",
        manager: "GAAA",
        kind: "deposit",
        ledger: 1,
        ledgerClosedAt: "2026-04-16T00:00:00.000Z",
        txHash: "0x1",
        transactionIndex: 0,
        operationIndex: 0,
        inSuccessfulContractCall: true,
        user: null,
        assetContract: "CASSET",
        marketId: null,
        amount: "1000",
        shares: null,
        netOut: null,
        stepCount: null,
      },
      {
        eventId: "evt-2",
        cursor: "evt-2",
        arkaId: "CAAA",
        manager: "GAAA",
        kind: "profit",
        ledger: 2,
        ledgerClosedAt: "2026-04-16T00:00:01.000Z",
        txHash: "0x2",
        transactionIndex: 0,
        operationIndex: 0,
        inSuccessfulContractCall: true,
        user: null,
        assetContract: "CASSET",
        marketId: null,
        amount: "250",
        shares: null,
        netOut: null,
        stepCount: null,
      },
    ];

    expect(deriveActivityMetrics(entries)).toEqual({
      profit: 250,
      volume: 1250,
    });
  });
});
