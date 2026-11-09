import { describe, expect, it } from "vitest";
import mainnetDeployments from "../../config/deployments.mainnet.json";
import {
  extractReleaseArkaIds,
  resolveOnchainCatalogCandidateArkas,
  resolveOnchainCatalogPayload,
  resolveOnchainCatalogRegistryId,
  type OnchainCatalogSnapshot,
} from "@/lib/catalog/onchainFallback";
import type { CatalogEconomicMetrics } from "@/lib/catalog/types";

const syncedAt = "2026-04-23T10:00:00.000Z";

function snapshot(): OnchainCatalogSnapshot {
  return {
    source: "onchain_fallback",
    candidateSource: "registry",
    syncedAt,
    failures: [],
    arkas: [
      {
        rank: 1,
        arkaId: "CARKAALPHA",
        manager: "GMANAGERA",
        curated: true,
        delisted: false,
        nav: "500",
        profitBase: null,
        volumeBase: null,
        denominationContract: "CUSDC",
        whitelistContracts: ["CUSDC", "CBLEND"],
        shareToken: "CSHAREALPHA",
        fees: { mgmtBps: 200, perfBps: 1200, depositBps: 0, redeemBps: 10 },
        syncedAt,
        assets: [
          {
            assetContract: "CUSDC",
            isDenomination: true,
            liquidBalance: "300",
            collateralAmount: "0",
            debtAmount: "0",
            netManagedAmount: "300",
            netPositionValue: "0",
            marketIds: [],
            syncedAt,
          },
          {
            assetContract: "CBLEND",
            isDenomination: false,
            liquidBalance: "50",
            collateralAmount: "250",
            debtAmount: "100",
            netManagedAmount: "200",
            netPositionValue: "150",
            marketIds: ["0"],
            syncedAt,
          },
        ],
      },
      {
        rank: 2,
        arkaId: "CARKABETA",
        manager: "GMANAGERB",
        curated: false,
        delisted: false,
        nav: "200",
        profitBase: null,
        volumeBase: null,
        denominationContract: "CUSDC",
        whitelistContracts: ["CUSDC"],
        shareToken: null,
        fees: { mgmtBps: 100, perfBps: 900, depositBps: 0, redeemBps: 0 },
        syncedAt,
        assets: [
          {
            assetContract: "CUSDC",
            isDenomination: true,
            liquidBalance: "200",
            collateralAmount: "0",
            debtAmount: "0",
            netManagedAmount: "200",
            netPositionValue: "0",
            marketIds: [],
            syncedAt,
          },
        ],
      },
    ],
    managers: [
      {
        rank: 1,
        manager: "GMANAGERA",
        arkaCount: 1,
        curatedArkaCount: 1,
        delistedArkaCount: 0,
        totalNav: "500",
        syncedAt,
      },
      {
        rank: 2,
        manager: "GMANAGERB",
        arkaCount: 1,
        curatedArkaCount: 0,
        delistedArkaCount: 0,
        totalNav: "200",
        syncedAt,
      },
    ],
    assets: [
      {
        rank: 1,
        assetContract: "CUSDC",
        arkaCount: 2,
        managerCount: 2,
        denominationArkaCount: 2,
        liquidBalance: "500",
        collateralAmount: "0",
        debtAmount: "0",
        netManagedAmount: "500",
        netPositionValue: "0",
        syncedAt,
      },
      {
        rank: 2,
        assetContract: "CBLEND",
        arkaCount: 1,
        managerCount: 1,
        denominationArkaCount: 0,
        liquidBalance: "50",
        collateralAmount: "250",
        debtAmount: "100",
        netManagedAmount: "200",
        netPositionValue: "150",
        syncedAt,
      },
    ],
  };
}

function snapshotWithObservedHistory(): OnchainCatalogSnapshot {
  const previousSyncedAt = "2026-04-22T10:00:00.000Z";
  return {
    ...snapshot(),
    observedHistory: {
      arkas: {
        CARKAALPHA: [
          {
            arkaId: "CARKAALPHA",
            syncedAt: previousSyncedAt,
            nav: "400",
            manager: "GMANAGERA",
            curated: true,
            delisted: false,
            shareToken: "CSHAREALPHA",
            rank: 1,
          },
          {
            arkaId: "CARKAALPHA",
            syncedAt,
            nav: "500",
            manager: "GMANAGERA",
            curated: true,
            delisted: false,
            shareToken: "CSHAREALPHA",
            rank: 1,
          },
        ],
        CARKABETA: [
          {
            arkaId: "CARKABETA",
            syncedAt: previousSyncedAt,
            nav: "150",
            manager: "GMANAGERB",
            curated: false,
            delisted: false,
            shareToken: null,
            rank: 2,
          },
          {
            arkaId: "CARKABETA",
            syncedAt,
            nav: "200",
            manager: "GMANAGERB",
            curated: false,
            delisted: false,
            shareToken: null,
            rank: 2,
          },
        ],
      },
      managers: {
        GMANAGERA: [
          {
            manager: "GMANAGERA",
            syncedAt: previousSyncedAt,
            totalNav: "400",
            arkaCount: 1,
            curatedArkaCount: 1,
            delistedArkaCount: 0,
            rank: 1,
          },
          {
            manager: "GMANAGERA",
            syncedAt,
            totalNav: "500",
            arkaCount: 1,
            curatedArkaCount: 1,
            delistedArkaCount: 0,
            rank: 1,
          },
        ],
        GMANAGERB: [
          {
            manager: "GMANAGERB",
            syncedAt: previousSyncedAt,
            totalNav: "150",
            arkaCount: 1,
            curatedArkaCount: 0,
            delistedArkaCount: 0,
            rank: 2,
          },
          {
            manager: "GMANAGERB",
            syncedAt,
            totalNav: "200",
            arkaCount: 1,
            curatedArkaCount: 0,
            delistedArkaCount: 0,
            rank: 2,
          },
        ],
      },
      assets: {
        CUSDC: [
          {
            assetContract: "CUSDC",
            syncedAt: previousSyncedAt,
            arkaCount: 2,
            managerCount: 2,
            denominationArkaCount: 2,
            liquidBalance: "450",
            collateralAmount: "0",
            debtAmount: "0",
            netManagedAmount: "450",
            netPositionValue: "0",
            rank: 1,
          },
          {
            assetContract: "CUSDC",
            syncedAt,
            arkaCount: 2,
            managerCount: 2,
            denominationArkaCount: 2,
            liquidBalance: "500",
            collateralAmount: "0",
            debtAmount: "0",
            netManagedAmount: "500",
            netPositionValue: "0",
            rank: 1,
          },
        ],
        CBLEND: [
          {
            assetContract: "CBLEND",
            syncedAt: previousSyncedAt,
            arkaCount: 1,
            managerCount: 1,
            denominationArkaCount: 0,
            liquidBalance: "50",
            collateralAmount: "200",
            debtAmount: "100",
            netManagedAmount: "150",
            netPositionValue: "100",
            rank: 2,
          },
          {
            assetContract: "CBLEND",
            syncedAt,
            arkaCount: 1,
            managerCount: 1,
            denominationArkaCount: 0,
            liquidBalance: "50",
            collateralAmount: "250",
            debtAmount: "100",
            netManagedAmount: "200",
            netPositionValue: "150",
            rank: 2,
          },
        ],
      },
    },
  };
}

function economics(input: {
  navDenomination: string;
  navUsdEstimate: string | null;
  valuationSource: CatalogEconomicMetrics["valuationSource"];
  oracleStatus: CatalogEconomicMetrics["oracleStatus"];
  weights: CatalogEconomicMetrics["portfolioWeights"];
}): CatalogEconomicMetrics {
  return {
    denominationAsset: {
      contract: "CUSDC",
      symbol: "USDC",
      label: "USD Coin",
      decimals: 7,
      usdPegged: true,
    },
    navDenomination: input.navDenomination,
    navUsdEstimate: input.navUsdEstimate,
    sharePrice: null,
    returns: {
      "1d": { amount: null, bps: null },
      "7d": { amount: null, bps: null },
      "30d": { amount: null, bps: null },
      "1y": { amount: null, bps: null },
      all: { amount: null, bps: null },
    },
    pnl: { amount: null, bps: null },
    volume: { amount: null, bps: null },
    flows: {
      depositVolume: null,
      redeemVolume: null,
      netUserFlow: null,
      activeUsers: null,
    },
    fees: { mgmtBps: 0, perfBps: 0, depositBps: 0, redeemBps: 0 },
    portfolioWeights: input.weights,
    oracleStatus: input.oracleStatus,
    valuationSource: input.valuationSource,
    missingPriceReasons: [],
  };
}

describe("on-chain catalog fallback resolver", () => {
  it("uses the bundled mainnet registry before stale public env values", () => {
    const registry = resolveOnchainCatalogRegistryId({
      ARKAFUND_NETWORK_TARGET: "mainnet",
      NEXT_PUBLIC_ARKA_REGISTRY: "CD7NVBDWH7YDCAJGPESKANQMQGNC2FCNX7WBUIRWWKF4QI5NMPRP22NW",
    } as unknown as NodeJS.ProcessEnv);

    expect(registry).toBe("CCMCYADNUESGFRIJRZ2AOHUZBIPMRLVZCHB3BVIPHZCKGWFJSSJQBXAY");
  });

  it("prefers registry Arkas but can degrade to explicit runtime Arka candidates", () => {
    expect(
      resolveOnchainCatalogCandidateArkas(
        ["CARKAALPHA", "CARKAALPHA", "CARKABETA"],
        {},
      ),
    ).toMatchObject({
      source: "registry",
      ids: ["CARKAALPHA", "CARKABETA"],
      warnings: [],
    });

    const explicitFallback = resolveOnchainCatalogCandidateArkas([], {
      CATALOG_FALLBACK_ARKAS: " CARKAEXPLICIT , CARKAEXPLICIT,not-a-contract",
      NEXT_PUBLIC_ROUTING_ASSET_A: "CLEGACYA",
    });

    expect(explicitFallback).toMatchObject({
      source: "configured_runtime_arkas",
      ids: ["CARKAEXPLICIT"],
    });
    expect(explicitFallback.warnings[0]?.message).toContain(
      "explicitly configured runtime Arka contracts",
    );
  });

  it("prefers configured release Arkas over legacy registry rows for mainnet catalog fallback", () => {
    const releaseManifestPath = "/tmp/arkafund-release-catalog-missing.json";
    const candidates = resolveOnchainCatalogCandidateArkas(
      ["CLEGACYARKA", "CLEGACYARKA"],
      {
        ARKAFUND_NETWORK_TARGET: "mainnet",
        ARKAFUND_DEPLOYMENTS_PATH: releaseManifestPath,
        CATALOG_FALLBACK_ARKAS: "CRELEASEARKA, CRELEASEARKA2",
      } as unknown as NodeJS.ProcessEnv,
    );

    expect(candidates).toMatchObject({
      source: "release_manifest",
      ids: ["CRELEASEARKA", "CRELEASEARKA2"],
      warnings: [],
    });
  });

  it("extracts current mainnet release Arkas from canary evidence in the bundled manifest", () => {
    const releaseArkas = extractReleaseArkaIds({
      executionVenues: {
        phoenix: { mainnetCanary: { arka: "CLEGACYARKA" } },
      },
      validations: {
        mainnetPostUpgradeCanary: {
          arka: "CPOSTUPGRADEARKA",
          managerArkasAfter: ["CLEGACYARKA", "CPOSTUPGRADEARKA"],
          routingCanary: { arka: "CPOSTUPGRADEARKA" },
          killSwitchCanary: { arka: "CPOSTUPGRADEARKA" },
          blendAccountingCanary: { arka: "CBLENDCANARYARKA" },
        },
        mainnetArkaAccountingPatch: {
          upgradedExistingCanary: { arka: "CPOSTUPGRADEARKA" },
          freshBlendCanary: { arka: "CBLENDCANARYARKA" },
        },
      },
    });

    expect(releaseArkas).toEqual([
      "CLEGACYARKA",
      "CPOSTUPGRADEARKA",
      "CBLENDCANARYARKA",
    ]);
  });

  it("keeps the bundled mainnet manifest aligned with post-upgrade canary Arkas", () => {
    expect(extractReleaseArkaIds(mainnetDeployments)).toEqual([
      "CCHNBPXXVSNQPPSD5XO6XLJ4BPXCXECW7AJJEPP5CF23IT6CAJWBIV4M",
      "CBRNPZV73FV7OUS34LA57NHAPBVOEH37V22QLBXSG3UCZ25THBKV2QKE",
      "CDWJWFXS6IHMKTCJJR6U5DXYHY5FF2GW33JULLSRHHIXZ4ZKW6XTMLS7",
    ]);
  });

  it("tries configured routing assets only when no explicit catalog candidates exist", () => {
    const routingFallback = resolveOnchainCatalogCandidateArkas([], {
      NEXT_PUBLIC_ROUTING_ASSET_A: "CLEGACYA",
      NEXT_PUBLIC_ROUTING_ASSET_B: "CLEGACYB",
    });

    expect(routingFallback).toMatchObject({
      source: "configured_routing_assets",
      ids: ["CLEGACYA", "CLEGACYB"],
    });
    expect(routingFallback.warnings[0]?.message).toContain(
      "configured routing asset contracts",
    );
  });

  it("serves dashboard, monitoring and composition from a Soroban-derived snapshot", () => {
    const overview = resolveOnchainCatalogPayload(
      snapshot(),
      "/v1/dashboard/overview",
      new URLSearchParams(),
    );
    const composition = resolveOnchainCatalogPayload(
      snapshot(),
      "/v1/dashboard/composition",
      new URLSearchParams("limit=1"),
    );
    const monitoring = resolveOnchainCatalogPayload(
      snapshot(),
      "/v1/monitoring/status",
      new URLSearchParams(),
    );

    expect(overview.status).toBe(200);
    expect(overview.body).toMatchObject({
      totalNav: "700",
      totalArkas: 2,
      curatedArkas: 1,
      totalManagers: 2,
      totalAssets: 2,
    });
    expect(composition.body).toMatchObject({
      totalNav: "700",
      items: [{ assetContract: "CUSDC", weightBps: 7143 }],
    });
    expect(monitoring.body).toMatchObject({
      healthy: true,
      lastRun: { indexedArkas: 2, failedArkas: 0, totalNav: "700" },
    });
  });

  it("uses USD valuation estimates for dashboard totals and composition when OracleGuard pricing is available", () => {
    const pricedSnapshot = snapshot();
    pricedSnapshot.arkas[0] = {
      ...pricedSnapshot.arkas[0],
      economics: economics({
        navDenomination: "500",
        navUsdEstimate: "800",
        valuationSource: "oracle_verified",
        oracleStatus: "verified",
        weights: [
          {
            assetContract: "CUSDC",
            weightBps: 3750,
            valueDenomination: "300",
            valueUsdEstimate: "300",
          },
          {
            assetContract: "CBLEND",
            weightBps: 6250,
            valueDenomination: "200",
            valueUsdEstimate: "500",
          },
        ],
      }),
    };
    pricedSnapshot.arkas[1] = {
      ...pricedSnapshot.arkas[1],
      economics: economics({
        navDenomination: "200",
        navUsdEstimate: "200",
        valuationSource: "usd_stablecoin_parity",
        oracleStatus: "not_required_usd_stablecoin",
        weights: [
          {
            assetContract: "CUSDC",
            weightBps: 10000,
            valueDenomination: "200",
            valueUsdEstimate: "200",
          },
        ],
      }),
    };

    const overview = resolveOnchainCatalogPayload(
      pricedSnapshot,
      "/v1/dashboard/overview",
      new URLSearchParams(),
    );
    const composition = resolveOnchainCatalogPayload(
      pricedSnapshot,
      "/v1/dashboard/composition",
      new URLSearchParams("limit=2"),
    );

    expect(overview.body).toMatchObject({
      totalNav: "1000",
      totalNavUsdEstimate: "1000",
      valuationSource: "oracle_verified",
      oracleStatus: "verified",
    });
    expect(composition.body).toMatchObject({
      totalNav: "1000",
      items: [
        { assetContract: "CUSDC", navContribution: "500", weightBps: 5000 },
        { assetContract: "CBLEND", navContribution: "500", weightBps: 5000 },
      ],
    });
  });

  it("serves observed runtime history for dashboard deltas and entity trend panels", () => {
    const observedSnapshot = snapshotWithObservedHistory();
    const overview = resolveOnchainCatalogPayload(
      observedSnapshot,
      "/v1/dashboard/overview",
      new URLSearchParams(),
    );
    const arkaHistory = resolveOnchainCatalogPayload(
      observedSnapshot,
      "/v1/arkas/CARKAALPHA/history",
      new URLSearchParams("order=asc&limit=10"),
    );
    const managerHistory = resolveOnchainCatalogPayload(
      observedSnapshot,
      "/v1/managers/GMANAGERA/history",
      new URLSearchParams("order=desc&limit=1"),
    );
    const assetHistory = resolveOnchainCatalogPayload(
      observedSnapshot,
      "/v1/assets/CBLEND/history",
      new URLSearchParams("order=asc&limit=10"),
    );
    const metrics = resolveOnchainCatalogPayload(
      observedSnapshot,
      "/v1/metrics",
      new URLSearchParams(),
    );

    expect(overview.body).toMatchObject({
      totalNav: "700",
      totalNavDelta: "150",
      totalNavDeltaBps: 2727,
    });
    expect(arkaHistory.body).toMatchObject({
      total: 2,
      items: [
        { arkaId: "CARKAALPHA", nav: "400" },
        { arkaId: "CARKAALPHA", nav: "500" },
      ],
    });
    expect(managerHistory.body).toMatchObject({
      total: 2,
      items: [{ manager: "GMANAGERA", totalNav: "500" }],
    });
    expect(assetHistory.body).toMatchObject({
      total: 2,
      items: [
        { assetContract: "CBLEND", netManagedAmount: "150" },
        { assetContract: "CBLEND", netManagedAmount: "200" },
      ],
    });
    expect(metrics.body).toMatchObject({
      observedHistoryPoints: 4,
    });
  });

  it("serves filtered Arkas, manager detail and asset detail without fixture data", () => {
    const curated = resolveOnchainCatalogPayload(
      snapshot(),
      "/v1/arkas",
      new URLSearchParams("curated=true&limit=10"),
    );
    const managerArkas = resolveOnchainCatalogPayload(
      snapshot(),
      "/v1/managers/GMANAGERA/arkas",
      new URLSearchParams(),
    );
    const assetArkas = resolveOnchainCatalogPayload(
      snapshot(),
      "/v1/assets/CUSDC/arkas",
      new URLSearchParams(),
    );
    const portfolio = resolveOnchainCatalogPayload(
      snapshot(),
      "/v1/arkas/CARKAALPHA/portfolio",
      new URLSearchParams("limit=2"),
    );

    expect(curated.body).toMatchObject({ total: 1, items: [{ arkaId: "CARKAALPHA" }] });
    expect(managerArkas.body).toMatchObject({ total: 1, items: [{ manager: "GMANAGERA" }] });
    expect(assetArkas.body).toMatchObject({ total: 2 });
    expect(portfolio.body).toMatchObject({
      arkaId: "CARKAALPHA",
      totalNavContribution: "500",
      items: [
        { assetContract: "CUSDC", weightBps: 6000 },
        { assetContract: "CBLEND", weightBps: 4000 },
      ],
    });
  });

  it("falls back to indexed Arkas when the on-chain curation lane is empty", () => {
    const uncategorizedSnapshot = snapshot();
    uncategorizedSnapshot.arkas = uncategorizedSnapshot.arkas.map((entry) => ({
      ...entry,
      curated: false,
    }));

    const page = resolveOnchainCatalogPayload(
      uncategorizedSnapshot,
      "/v1/arkas",
      new URLSearchParams("curated=true&limit=10"),
    );

    expect(page.body).toMatchObject({
      total: 2,
      items: [{ arkaId: "CARKAALPHA" }, { arkaId: "CARKABETA" }],
    });
  });
});
