import { describe, expect, it } from "vitest";
import {
  arkaActivityFixture,
  arkaAssetsFixture,
  arkaHistoryFixture,
  arkaPortfolioFixture,
  fixtureArkasPage,
} from "@/lib/catalog/testFixtures";
import {
  buildVaultActivityHighlights,
  buildVaultDetailCommandDeck,
  buildVaultDetailPublicMetricDeck,
  buildVaultFeaturedInsights,
  buildVaultLeaderboardCards,
  buildVaultLeaderboardRows,
  buildVaultLeaderboardSummary,
  buildVaultPublicMetricDeck,
  buildVaultProfileSignals,
  buildVaultPortfolioHighlights,
  buildVaultRouteSet,
  filterVaultLeaderboardPageByWindow,
} from "@/lib/catalog/vaults";
import { buildCatalogDerivedMetrics } from "@/lib/catalog/leaderboardArkas";

describe("vault leaderboard helpers", () => {
  it("keeps a NAV-blocked vault visible and never displays it as zero USD", () => {
    const original = fixtureArkasPage({ curated: true }).items[0];
    const arka = { ...original, nav:null, navUnavailableReason:"BlendNavUnavailable", economics:original.economics ? {...original.economics,navDenomination:null,navUsdEstimate:null,valuationSource:"unavailable" as const} : undefined };
    const page = { ...fixtureArkasPage({curated:true}), total:1, items:[arka] };
    expect(buildVaultLeaderboardRows(page)[0]).toMatchObject({arkaId:arka.arkaId,nav:null,navDisplay:"Valuation unavailable"});
    expect(buildVaultLeaderboardSummary(page)).toMatchObject({totalNavUsdEstimate:null,missingUsdValuationCount:1});
    const deck = buildVaultDetailPublicMetricDeck({arka,history:arkaHistoryFixture[arka.arkaId],assets:arkaAssetsFixture[arka.arkaId],portfolio:arkaPortfolioFixture[arka.arkaId],activity:arkaActivityFixture[arka.arkaId]});
    expect(deck.find(tile=>tile.id==="nav")).toMatchObject({value:"Valuation unavailable",valueKind:"text",tone:"warning"});
    expect(deck.find(tile=>tile.id==="trend")).toMatchObject({value:"n/a",valueKind:"text"});
  });
  it("summarizes ranked Arkas for the current leaderboard window", () => {
    const page = fixtureArkasPage({ curated: true });
    const summary = buildVaultLeaderboardSummary(page);

    expect(summary.totalNav).toBe("10100000");
    expect(summary.managerCount).toBe(3);
    expect(summary.curatedCount).toBe(3);
    expect(summary.delistedCount).toBe(0);
    expect(summary.averageAssetCount).toBe(3);
    expect(summary.totalNavUsdEstimate).toBeNull();
    expect(summary.missingUsdValuationCount).toBe(1);
  });

  it("builds separated profile and ops routes for a given Arka", () => {
    const routes = buildVaultRouteSet("CA7ALPHA/OPS");

    expect(routes.profileHref).toBe("/vaults/CA7ALPHA%2FOPS");
    expect(routes.opsHref).toBe("/arkas/CA7ALPHA%2FOPS");
  });

  it("builds leaderboard cards with truthful share widths and asset previews", () => {
    const page = fixtureArkasPage({ curated: true });
    const cards = buildVaultLeaderboardCards(page);

    expect(cards).toHaveLength(3);
    expect(cards[0]).toMatchObject({
      rank: 1,
      assetCount: 3,
      whitelistCount: 3,
    });
    expect(cards[0].primaryAssetContract).toContain("CCW67TSZ");
    expect(cards[0].navSharePct).toBeCloseTo(51.48, 2);
    expect(cards[2].navSharePct).toBeCloseTo(17.82, 2);
  });

  it("builds featured insight cards from real selected ranking metrics", () => {
    const page = fixtureArkasPage({ curated: true });
    const metrics = buildCatalogDerivedMetrics(page.items);

    const ranked = buildVaultFeaturedInsights(page, metrics, "ranked", 3);
    expect(ranked.map((item) => item.arkaId.slice(0, 7))).toEqual([
      "CA7ALPH",
      "CA7BETA",
      "CA7GAMM",
    ]);
    expect(ranked[0]).toMatchObject({
      rank: 1,
      metric: {
        id: "ranked",
        value: 1,
        source: "catalog_rank",
      },
      profileHref:
        "/vaults/CA7ALPHAQFK2MZKJY4R5S8N2P1T6V9W3X7Y2Z5ABCD1EFGH2345678IJ",
      opsHref:
        "/arkas/CA7ALPHAQFK2MZKJY4R5S8N2P1T6V9W3X7Y2Z5ABCD1EFGH2345678IJ",
    });
    expect(ranked[0].navSharePct).toBeCloseTo(51.48, 2);

    const profit = buildVaultFeaturedInsights(page, metrics, "profit", 2);
    expect(profit.map((item) => item.arkaId.slice(0, 7))).toEqual([
      "CA7BETA",
      "CA7ALPH",
    ]);
    expect(profit[0].metric).toMatchObject({
      id: "profit",
      value: 460_000,
      source: "catalog",
    });

    const volume = buildVaultFeaturedInsights(page, metrics, "volume", 1);
    expect(volume[0]).toMatchObject({
      metric: {
        id: "volume",
        value: 2_650_000,
        source: "catalog",
      },
    });
  });

  it("builds public vault metric cards from leaderboard and resolved metrics", () => {
    const page = fixtureArkasPage({ curated: true });
    const metrics = buildCatalogDerivedMetrics(page.items);
    const tiles = buildVaultPublicMetricDeck(page, metrics, { windowLabel: "All" });
    const byId = new Map(tiles.map((tile) => [tile.id, tile]));
    const profit = page.items.reduce(
      (accumulator, entry) => accumulator + (metrics[entry.arkaId]?.profit.value ?? 0),
      0,
    );
    const volume = page.items.reduce(
      (accumulator, entry) => accumulator + (metrics[entry.arkaId]?.volume.value ?? 0),
      0,
    );

    expect(tiles.map((tile) => tile.id)).toEqual([
      "managed",
      "arkas",
      "coverage",
      "managers",
      "profit",
      "volume",
      "leaderShare",
      "assetSpan",
    ]);
    expect(byId.get("managed")).toMatchObject({
      value: "Valuation unavailable",
      valueKind: "text",
      tone: "warning",
    });
    expect(byId.get("coverage")).toMatchObject({
      value: "3/3",
      tone: "positive",
    });
    expect(byId.get("profit")).toMatchObject({
      value: String(profit),
      valueKind: "amount",
    });
    expect(byId.get("volume")).toMatchObject({
      value: String(volume),
      valueKind: "amount",
    });
    expect(byId.get("leaderShare")).toMatchObject({
      value: "51.48%",
      valueKind: "percent",
    });
    expect(JSON.stringify(tiles)).not.toMatch(
      /\b(undefined|NaN|fake|stub|placeholder|lorem)\b/i,
    );
  });

  it("builds leaderboard rows with posture and truthful denomination labels", () => {
    const rows = buildVaultLeaderboardRows(fixtureArkasPage({ curated: true }));

    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({
      rank: 1,
      postureLabel: "Curated",
      baseDetail: "active denomination",
    });
    expect(rows[0].baseContract).toContain("CCW67TSZ");
    expect(rows[2].feesLabel).toContain("1.50%");

    const delistedRows = buildVaultLeaderboardRows(fixtureArkasPage({ curated: false }));
    expect(delistedRows).toHaveLength(1);
    expect(delistedRows[0]).toMatchObject({
      postureLabel: "Delisted",
      baseDetail: "active denomination",
    });
    expect(rows[0].feesLabel).toContain("2.00%");
  });

  it("filters leaderboard windows from real indexed sync timestamps", () => {
    const page = fixtureArkasPage({ curated: true });
    const windowed = {
      ...page,
      items: page.items.map((entry, index) => ({
        ...entry,
        syncedAt:
          index === 0
            ? "2026-04-29T12:00:00.000Z"
            : index === 1
              ? "2026-04-26T12:00:00.000Z"
              : "2026-03-20T12:00:00.000Z",
      })),
    };

    expect(filterVaultLeaderboardPageByWindow(windowed, "latest").items).toHaveLength(1);
    expect(filterVaultLeaderboardPageByWindow(windowed, "7d").items).toHaveLength(2);
    expect(filterVaultLeaderboardPageByWindow(windowed, "30d").items).toHaveLength(2);
    expect(filterVaultLeaderboardPageByWindow(windowed, "all").items).toHaveLength(3);
  });

  it("surfaces top portfolio sleeves for profile spotlight cards", () => {
    const portfolio =
      arkaPortfolioFixture.CA7ALPHAQFK2MZKJY4R5S8N2P1T6V9W3X7Y2Z5ABCD1EFGH2345678IJ;
    const highlights = buildVaultPortfolioHighlights(portfolio);

    expect(highlights).toHaveLength(3);
    expect(highlights[0].assetContract).toContain("CCW67TSZ");
    expect(highlights[0].isDenomination).toBe(true);
    expect(highlights[1].marketCount).toBeGreaterThanOrEqual(1);
  });

  it("builds profile signals for curation, manager and issuance posture", () => {
    const arka = fixtureArkasPage({ curated: true }).items[0];
    const signals = buildVaultProfileSignals(arka);

    expect(signals.map((item) => item.id)).toEqual([
      "curation",
      "manager",
      "denomination",
      "shareToken",
    ]);
    expect(signals[0]).toMatchObject({
      value: "Curated",
      detail: "3 allowed assets",
      tone: "positive",
    });
  });

  it("builds activity highlights for confirmed flow, actors and latest action", () => {
    const activity =
      arkaActivityFixture.CA7ALPHAQFK2MZKJY4R5S8N2P1T6V9W3X7Y2Z5ABCD1EFGH2345678IJ;
    const highlights = buildVaultActivityHighlights(activity);

    expect(highlights.map((item) => item.id)).toEqual(["events", "actors", "latest"]);
    expect(highlights[0].value).toBe(String(activity.total));
    expect(highlights[1].value).toBe("2");
    expect(highlights[2].value).toBe("deposit");
  });

  it("builds a vault detail command deck from profile, execution and source data", () => {
    const arka = fixtureArkasPage({ curated: true }).items[0];
    const arkaId = arka.arkaId;
    const deck = buildVaultDetailCommandDeck({
      arka,
      history: arkaHistoryFixture[arkaId],
      assets: arkaAssetsFixture[arkaId],
      portfolio: arkaPortfolioFixture[arkaId],
      activity: arkaActivityFixture[arkaId],
    });

    expect(deck.map((command) => command.id)).toEqual([
      "profile",
      "manager",
      "execution",
      "source",
    ]);
    expect(deck[0]).toMatchObject({
      value: "Curated",
      href: `/vaults/${arkaId}`,
      ctaLabel: "Current profile",
      tone: "positive",
    });
    expect(deck[0].detail).toContain("$0.52 TVL");
    expect(deck[1]).toMatchObject({
      href: expect.stringMatching(/^\/managers\/GCAALPHA/),
      ctaLabel: "Open manager",
    });
    expect(deck[2]).toMatchObject({
      value: "Available",
      href: `/arkas/${arkaId}`,
      ctaLabel: "Open actions",
      tone: "positive",
    });
    expect(deck[3]).toMatchObject({
      value: "Live",
      href: "/status",
      ctaLabel: "Inspect status",
    });
    expect(deck[3].detail).toContain("3 history updates");
    expect(deck[3].detail).toContain("3 portfolio positions");
    expect(deck[3].detail).toContain("4 activity events");
    expect(deck[3].detail).not.toMatch(
      /\b(undefined|NaN|fake|stub|placeholder)\b/i,
    );
  });

  it("builds public vault detail metric cards from profile, portfolio and activity data", () => {
    const arka = fixtureArkasPage({ curated: true }).items[0];
    const arkaId = arka.arkaId;
    const deck = buildVaultDetailPublicMetricDeck({
      arka,
      history: arkaHistoryFixture[arkaId],
      assets: arkaAssetsFixture[arkaId],
      portfolio: arkaPortfolioFixture[arkaId],
      activity: arkaActivityFixture[arkaId],
    });
    const byId = new Map(deck.map((tile) => [tile.id, tile]));

    expect(deck.map((tile) => tile.id)).toEqual([
      "nav",
      "trend",
      "fees",
      "portfolio",
      "activity",
      "whitelist",
    ]);
    expect(byId.get("nav")).toMatchObject({
      value: "5200000",
      valueKind: "amount",
      tone: "positive",
    });
    expect(byId.get("trend")).toMatchObject({
      value: "+4.41%",
      valueKind: "percent",
    });
    expect(byId.get("fees")).toMatchObject({
      value: "Management 2.00% · Performance 12.00%",
      valueKind: "text",
    });
    expect(byId.get("portfolio")).toMatchObject({
      value: "3",
      detail: "1 denomination asset and 2 managed positions.",
    });
    expect(byId.get("activity")).toMatchObject({
      value: "4",
      detail: "4 of 4 recent actions confirmed.",
    });
    expect(byId.get("whitelist")).toMatchObject({
      value: "3",
      tone: "positive",
    });
    expect(JSON.stringify(deck)).not.toMatch(
      /\b(undefined|NaN|fake|stub|placeholder|lorem)\b/i,
    );
  });
});
