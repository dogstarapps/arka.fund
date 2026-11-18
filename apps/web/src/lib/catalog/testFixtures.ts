import type {
  ActivityEntry,
  ArkaAssetExposure,
  ArkaHistoryPoint,
  ArkaPortfolio,
  AssetHistoryPoint,
  CatalogEconomicMetrics,
  DashboardComposition,
  DashboardOverview,
  DiscoverQuery,
  ManagerHistoryPoint,
  MonitoringStatus,
  Page,
  RankedArkaCatalogEntry,
  RankedAssetCatalogEntry,
  RankedManagerCatalogEntry,
} from "./types";
import { findCoreStellarAssetByContract } from "./coreStellarAssetRegistry";

const FIXTURE_SYNCED_AT = "2026-03-27T10:30:00.000Z";
const PREVIOUS_SYNCED_AT = "2026-03-20T10:30:00.000Z";
const OLDEST_SYNCED_AT = "2026-03-13T10:30:00.000Z";
const FIXTURE_USDC_CONTRACT = "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75";
const FIXTURE_XLM_CONTRACT = "CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA";

function buildFixtureEconomics(input: {
  nav: string;
  navUsdEstimate: string | null;
  denominationContract: string;
  symbol: string;
  label: string;
  usdPegged: boolean;
  fees: CatalogEconomicMetrics["fees"];
  missingPriceReasons?: string[];
}): CatalogEconomicMetrics {
  const missingPriceReasons = input.missingPriceReasons ?? [];
  return {
    denominationAsset: {
      contract: input.denominationContract,
      symbol: input.symbol,
      label: input.label,
      decimals: 7,
      usdPegged: input.usdPegged,
    },
    navDenomination: input.nav,
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
    fees: input.fees,
    portfolioWeights: [],
    oracleStatus: input.navUsdEstimate
      ? input.usdPegged
        ? "not_required_usd_stablecoin"
        : "verified"
      : "missing_price",
    valuationSource: input.navUsdEstimate
      ? input.usdPegged
        ? "usd_stablecoin_parity"
        : "oracle_verified"
      : "unavailable",
    missingPriceReasons,
  };
}

const FIXTURE_ARKAS: RankedArkaCatalogEntry[] = [
  {
    rank: 1,
    arkaId: "CA7ALPHAQFK2MZKJY4R5S8N2P1T6V9W3X7Y2Z5ABCD1EFGH2345678IJ",
    manager: "GCAALPHA7RTH9KLMNOPQ2UVWX3YZ56789ABCDEFGHJKLMNPRSTUV4WX",
    curated: true,
    delisted: false,
    nav: "5200000",
    profitBase: "280000",
    volumeBase: "2650000",
    denominationContract: "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75",
    whitelistContracts: [
      "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75",
      "CD25MNVTZDL4Y3XBCPCJXGXATV5WUHHOWMYFF4YBEGU5FCPGMYTVG5JY",
      "CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA",
    ],
    shareToken: "CSHAREALPHA7RTH9KLMNOPQ2UVWX3YZ56789ABCDEFGHJKLMNPRSTU",
    fees: { mgmtBps: 200, perfBps: 1200, depositBps: 10, redeemBps: 20 },
    economics: buildFixtureEconomics({
      nav: "5200000",
      navUsdEstimate: "5200000",
      denominationContract: FIXTURE_USDC_CONTRACT,
      symbol: "USDC",
      label: "USD Coin",
      usdPegged: true,
      fees: { mgmtBps: 200, perfBps: 1200, depositBps: 10, redeemBps: 20 },
    }),
    assets: [
      {
        assetContract: "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75",
        isDenomination: true,
        liquidBalance: "2100000",
        collateralAmount: "0",
        debtAmount: "0",
        netManagedAmount: "2100000",
        netPositionValue: "0",
        marketIds: [],
        syncedAt: FIXTURE_SYNCED_AT,
      },
      {
        assetContract: "CD25MNVTZDL4Y3XBCPCJXGXATV5WUHHOWMYFF4YBEGU5FCPGMYTVG5JY",
        isDenomination: false,
        liquidBalance: "600000",
        collateralAmount: "800000",
        debtAmount: "0",
        netManagedAmount: "1400000",
        netPositionValue: "1900000",
        marketIds: ["0"],
        syncedAt: FIXTURE_SYNCED_AT,
      },
      {
        assetContract: "CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA",
        isDenomination: false,
        liquidBalance: "1200000",
        collateralAmount: "0",
        debtAmount: "0",
        netManagedAmount: "1200000",
        netPositionValue: "1200000",
        marketIds: [],
        syncedAt: FIXTURE_SYNCED_AT,
      },
    ],
    syncedAt: FIXTURE_SYNCED_AT,
  },
  {
    rank: 2,
    arkaId: "CA7BETAQFK2MZKJY4R5S8N2P1T6V9W3X7Y2Z5ABCD1EFGH2345678IJ",
    manager: "GCBBETA77RTH9KLMNOPQ2UVWX3YZ56789ABCDEFGHJKLMNPRSTUV4Y",
    curated: true,
    delisted: false,
    nav: "3100000",
    profitBase: "460000",
    volumeBase: "2140000",
    denominationContract: "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75",
    whitelistContracts: [
      "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75",
      "CDTKPWPLOURQA2SGTKTUQOWRCBZEORB4BWBOMJ3D3ZTQQSGE5F6JBQLV",
      "CD25MNVTZDL4Y3XBCPCJXGXATV5WUHHOWMYFF4YBEGU5FCPGMYTVG5JY",
    ],
    shareToken: "CSHAREBETA77RTH9KLMNOPQ2UVWX3YZ56789ABCDEFGHJKLMNPRSTU",
    fees: { mgmtBps: 175, perfBps: 1000, depositBps: 5, redeemBps: 15 },
    economics: buildFixtureEconomics({
      nav: "3100000",
      navUsdEstimate: "3100000",
      denominationContract: FIXTURE_USDC_CONTRACT,
      symbol: "USDC",
      label: "USD Coin",
      usdPegged: true,
      fees: { mgmtBps: 175, perfBps: 1000, depositBps: 5, redeemBps: 15 },
    }),
    assets: [
      {
        assetContract: "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75",
        isDenomination: true,
        liquidBalance: "1000000",
        collateralAmount: "0",
        debtAmount: "0",
        netManagedAmount: "1000000",
        netPositionValue: "0",
        marketIds: [],
        syncedAt: FIXTURE_SYNCED_AT,
      },
      {
        assetContract: "CDTKPWPLOURQA2SGTKTUQOWRCBZEORB4BWBOMJ3D3ZTQQSGE5F6JBQLV",
        isDenomination: false,
        liquidBalance: "700000",
        collateralAmount: "500000",
        debtAmount: "0",
        netManagedAmount: "1200000",
        netPositionValue: "1200000",
        marketIds: ["0"],
        syncedAt: FIXTURE_SYNCED_AT,
      },
      {
        assetContract: "CD25MNVTZDL4Y3XBCPCJXGXATV5WUHHOWMYFF4YBEGU5FCPGMYTVG5JY",
        isDenomination: false,
        liquidBalance: "500000",
        collateralAmount: "400000",
        debtAmount: "0",
        netManagedAmount: "900000",
        netPositionValue: "900000",
        marketIds: ["0"],
        syncedAt: FIXTURE_SYNCED_AT,
      },
    ],
    syncedAt: FIXTURE_SYNCED_AT,
  },
  {
    rank: 3,
    arkaId: "CA7GAMMAQFK2MZKJY4R5S8N2P1T6V9W3X7Y2Z5ABCD1EFGH2345678IJ",
    manager: "GCCGAMMA7RTH9KLMNOPQ2UVWX3YZ56789ABCDEFGHJKLMNPRSTUV4Z",
    curated: true,
    delisted: false,
    nav: "1800000",
    profitBase: "160000",
    volumeBase: "980000",
    denominationContract: "CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA",
    whitelistContracts: [
      "CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA",
      "CAUIKL3IYGMERDRUN6YSCLWVAKIFG5Q4YJHUKM4S4NJZQIA3BAS6OJPK",
      "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75",
    ],
    shareToken: "CSHAREGAMM7RTH9KLMNOPQ2UVWX3YZ56789ABCDEFGHJKLMNPRSTUV",
    fees: { mgmtBps: 150, perfBps: 900, depositBps: 0, redeemBps: 10 },
    economics: buildFixtureEconomics({
      nav: "1800000",
      navUsdEstimate: null,
      denominationContract: FIXTURE_XLM_CONTRACT,
      symbol: "XLM",
      label: "Stellar Lumens",
      usdPegged: false,
      fees: { mgmtBps: 150, perfBps: 900, depositBps: 0, redeemBps: 10 },
      missingPriceReasons: ["Missing USD oracle price for XLM."],
    }),
    assets: [
      {
        assetContract: "CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA",
        isDenomination: true,
        liquidBalance: "800000",
        collateralAmount: "0",
        debtAmount: "0",
        netManagedAmount: "800000",
        netPositionValue: "0",
        marketIds: [],
        syncedAt: FIXTURE_SYNCED_AT,
      },
      {
        assetContract: "CAUIKL3IYGMERDRUN6YSCLWVAKIFG5Q4YJHUKM4S4NJZQIA3BAS6OJPK",
        isDenomination: false,
        liquidBalance: "600000",
        collateralAmount: "0",
        debtAmount: "0",
        netManagedAmount: "600000",
        netPositionValue: "600000",
        marketIds: [],
        syncedAt: FIXTURE_SYNCED_AT,
      },
      {
        assetContract: "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75",
        isDenomination: false,
        liquidBalance: "400000",
        collateralAmount: "0",
        debtAmount: "0",
        netManagedAmount: "400000",
        netPositionValue: "400000",
        marketIds: [],
        syncedAt: FIXTURE_SYNCED_AT,
      },
    ],
    syncedAt: FIXTURE_SYNCED_AT,
  },
  {
    rank: 4,
    arkaId: "CA7DELTAQFK2MZKJY4R5S8N2P1T6V9W3X7Y2Z5ABCD1EFGH2345678IJ",
    manager: "GCAALPHA7RTH9KLMNOPQ2UVWX3YZ56789ABCDEFGHJKLMNPRSTUV4WX",
    curated: false,
    delisted: true,
    nav: "950000",
    profitBase: "-42000",
    volumeBase: "340000",
    denominationContract: "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75",
    whitelistContracts: ["CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75"],
    shareToken: "CSHAREDELT7RTH9KLMNOPQ2UVWX3YZ56789ABCDEFGHJKLMNPRSTUV",
    fees: { mgmtBps: 225, perfBps: 1300, depositBps: 15, redeemBps: 25 },
    economics: buildFixtureEconomics({
      nav: "950000",
      navUsdEstimate: "950000",
      denominationContract: FIXTURE_USDC_CONTRACT,
      symbol: "USDC",
      label: "USD Coin",
      usdPegged: true,
      fees: { mgmtBps: 225, perfBps: 1300, depositBps: 15, redeemBps: 25 },
    }),
    assets: [
      {
        assetContract: "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75",
        isDenomination: true,
        liquidBalance: "950000",
        collateralAmount: "0",
        debtAmount: "0",
        netManagedAmount: "950000",
        netPositionValue: "0",
        marketIds: [],
        syncedAt: FIXTURE_SYNCED_AT,
      },
    ],
    syncedAt: FIXTURE_SYNCED_AT,
  },
];

const FIXTURE_MANAGERS: RankedManagerCatalogEntry[] = [
  {
    rank: 1,
    manager: "GCAALPHA7RTH9KLMNOPQ2UVWX3YZ56789ABCDEFGHJKLMNPRSTUV4WX",
    arkaCount: 2,
    curatedArkaCount: 1,
    delistedArkaCount: 1,
    totalNav: "6150000",
    totalNavUsdEstimate: "6150000",
    syncedAt: FIXTURE_SYNCED_AT,
  },
  {
    rank: 2,
    manager: "GCBBETA77RTH9KLMNOPQ2UVWX3YZ56789ABCDEFGHJKLMNPRSTUV4Y",
    arkaCount: 1,
    curatedArkaCount: 1,
    delistedArkaCount: 0,
    totalNav: "3100000",
    totalNavUsdEstimate: "3100000",
    syncedAt: FIXTURE_SYNCED_AT,
  },
  {
    rank: 3,
    manager: "GCCGAMMA7RTH9KLMNOPQ2UVWX3YZ56789ABCDEFGHJKLMNPRSTUV4Z",
    arkaCount: 1,
    curatedArkaCount: 1,
    delistedArkaCount: 0,
    totalNav: "1800000",
    totalNavUsdEstimate: "1800000",
    syncedAt: FIXTURE_SYNCED_AT,
  },
];

const FIXTURE_ASSETS: RankedAssetCatalogEntry[] = [
  {
    rank: 1,
    assetContract: "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75",
    arkaCount: 4,
    managerCount: 3,
    denominationArkaCount: 3,
    liquidBalance: "4450000",
    collateralAmount: "0",
    debtAmount: "0",
    netManagedAmount: "4450000",
    netPositionValue: "400000",
    netManagedUsdEstimate: "400000",
    syncedAt: FIXTURE_SYNCED_AT,
  },
  {
    rank: 2,
    assetContract: "CD25MNVTZDL4Y3XBCPCJXGXATV5WUHHOWMYFF4YBEGU5FCPGMYTVG5JY",
    arkaCount: 2,
    managerCount: 2,
    denominationArkaCount: 0,
    liquidBalance: "1100000",
    collateralAmount: "1200000",
    debtAmount: "0",
    netManagedAmount: "2300000",
    netPositionValue: "2800000",
    netManagedUsdEstimate: "2800000",
    syncedAt: FIXTURE_SYNCED_AT,
  },
  {
    rank: 3,
    assetContract: "CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA",
    arkaCount: 2,
    managerCount: 2,
    denominationArkaCount: 1,
    liquidBalance: "2000000",
    collateralAmount: "0",
    debtAmount: "0",
    netManagedAmount: "2000000",
    netPositionValue: "1200000",
    netManagedUsdEstimate: "1200000",
    syncedAt: FIXTURE_SYNCED_AT,
  },
  {
    rank: 4,
    assetContract: "CDTKPWPLOURQA2SGTKTUQOWRCBZEORB4BWBOMJ3D3ZTQQSGE5F6JBQLV",
    arkaCount: 1,
    managerCount: 1,
    denominationArkaCount: 0,
    liquidBalance: "700000",
    collateralAmount: "500000",
    debtAmount: "0",
    netManagedAmount: "1200000",
    netPositionValue: "1200000",
    netManagedUsdEstimate: "1200000",
    syncedAt: FIXTURE_SYNCED_AT,
  },
  {
    rank: 5,
    assetContract: "CAUIKL3IYGMERDRUN6YSCLWVAKIFG5Q4YJHUKM4S4NJZQIA3BAS6OJPK",
    arkaCount: 1,
    managerCount: 1,
    denominationArkaCount: 0,
    liquidBalance: "600000",
    collateralAmount: "0",
    debtAmount: "0",
    netManagedAmount: "600000",
    netPositionValue: "600000",
    netManagedUsdEstimate: "600000",
    syncedAt: FIXTURE_SYNCED_AT,
  },
];

export const dashboardOverviewFixture: DashboardOverview = {
  syncedAt: FIXTURE_SYNCED_AT,
  totalNav: "11050000",
  totalNavUsdEstimate: "11050000",
  totalNavDelta: "540000",
  totalNavDeltaBps: 513,
  totalArkas: 4,
  totalManagers: 3,
  totalAssets: 5,
  curatedArkas: 3,
  delistedArkas: 1,
  largestAssetWeightBps: 4389,
  monitoring: {
    healthy: true,
    degraded: false,
    snapshotAgeSeconds: 58,
    consecutiveFailures: 0,
    activeAlertCount: 0,
    lastRunStatus: "success",
  },
  activity: {
    totalEvents: 24,
    uniqueUsers: 17,
    oldestLedger: 532100,
    latestLedger: 532884,
    counts: {
      deposit: 11,
      redeem: 4,
      profit: 2,
      lend: 3,
      borrow: 2,
      repay: 1,
      withdraw: 1,
    },
    depositVolume: "2800000",
    redeemVolume: "650000",
    profitVolume: "210000",
    netUserFlow: "2150000",
  },
};

export const dashboardCompositionFixture: DashboardComposition = {
  syncedAt: FIXTURE_SYNCED_AT,
  totalNav: "11050000",
  totalNavUsdEstimate: "11050000",
  items: FIXTURE_ASSETS.map((asset) => ({
    assetContract: asset.assetContract,
    rank: asset.rank,
    arkaCount: asset.arkaCount,
    managerCount: asset.managerCount,
    denominationArkaCount: asset.denominationArkaCount,
    navContribution: asset.rank === 1 ? "4850000" : asset.netPositionValue,
    valueUsdEstimate: asset.netManagedUsdEstimate,
    weightBps:
      asset.rank === 1
        ? 4389
        : asset.rank === 2
          ? 2533
          : asset.rank === 3
            ? 1810
            : asset.rank === 4
              ? 1085
              : 543,
    liquidBalance: asset.liquidBalance,
    collateralAmount: asset.collateralAmount,
    debtAmount: asset.debtAmount,
    netPositionValue: asset.netPositionValue,
  })),
};

export const monitoringStatusFixture: MonitoringStatus = {
  healthy: true,
  degraded: false,
  evaluatedAt: FIXTURE_SYNCED_AT,
  snapshotAgeSeconds: 58,
  consecutiveFailures: 0,
  lastRun: {
    runId: "run-2026-03-27-1030",
    startedAt: "2026-03-27T10:29:56.000Z",
    finishedAt: FIXTURE_SYNCED_AT,
    durationMs: 3150,
    status: "success",
    indexedArkas: 4,
    failedArkas: 0,
    totalArkas: 4,
    totalNav: "11050000",
    errorMessage: null,
  },
  activeAlerts: [],
  thresholds: {
    maxSnapshotAgeSeconds: 120,
    maxSyncDurationMs: 10000,
    maxFailureRatio: 0.1,
    maxConsecutiveFailures: 3,
  },
};

export const managerHistoryFixture: Record<string, Page<ManagerHistoryPoint>> = {
  GCAALPHA7RTH9KLMNOPQ2UVWX3YZ56789ABCDEFGHJKLMNPRSTUV4WX: buildPage(
    [
      {
        manager: "GCAALPHA7RTH9KLMNOPQ2UVWX3YZ56789ABCDEFGHJKLMNPRSTUV4WX",
        syncedAt: OLDEST_SYNCED_AT,
        totalNav: "5800000",
        totalNavUsdEstimate: "5800000",
        arkaCount: 2,
        curatedArkaCount: 1,
        delistedArkaCount: 1,
        rank: 1,
      },
      {
        manager: "GCAALPHA7RTH9KLMNOPQ2UVWX3YZ56789ABCDEFGHJKLMNPRSTUV4WX",
        syncedAt: PREVIOUS_SYNCED_AT,
        totalNav: "6020000",
        totalNavUsdEstimate: "6020000",
        arkaCount: 2,
        curatedArkaCount: 1,
        delistedArkaCount: 1,
        rank: 1,
      },
      {
        manager: "GCAALPHA7RTH9KLMNOPQ2UVWX3YZ56789ABCDEFGHJKLMNPRSTUV4WX",
        syncedAt: FIXTURE_SYNCED_AT,
        totalNav: "6150000",
        totalNavUsdEstimate: "6150000",
        arkaCount: 2,
        curatedArkaCount: 1,
        delistedArkaCount: 1,
        rank: 1,
      },
    ],
    12,
  ),
  GCBBETA77RTH9KLMNOPQ2UVWX3YZ56789ABCDEFGHJKLMNPRSTUV4Y: buildPage(
    [
      {
        manager: "GCBBETA77RTH9KLMNOPQ2UVWX3YZ56789ABCDEFGHJKLMNPRSTUV4Y",
        syncedAt: OLDEST_SYNCED_AT,
        totalNav: "2400000",
        totalNavUsdEstimate: "2400000",
        arkaCount: 1,
        curatedArkaCount: 1,
        delistedArkaCount: 0,
        rank: 2,
      },
      {
        manager: "GCBBETA77RTH9KLMNOPQ2UVWX3YZ56789ABCDEFGHJKLMNPRSTUV4Y",
        syncedAt: PREVIOUS_SYNCED_AT,
        totalNav: "2850000",
        totalNavUsdEstimate: "2850000",
        arkaCount: 1,
        curatedArkaCount: 1,
        delistedArkaCount: 0,
        rank: 2,
      },
      {
        manager: "GCBBETA77RTH9KLMNOPQ2UVWX3YZ56789ABCDEFGHJKLMNPRSTUV4Y",
        syncedAt: FIXTURE_SYNCED_AT,
        totalNav: "3100000",
        totalNavUsdEstimate: "3100000",
        arkaCount: 1,
        curatedArkaCount: 1,
        delistedArkaCount: 0,
        rank: 2,
      },
    ],
    12,
  ),
};

export const assetHistoryFixture: Record<string, Page<AssetHistoryPoint>> = {
  CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75: buildPage(
    [
      {
        assetContract: "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75",
        syncedAt: OLDEST_SYNCED_AT,
        arkaCount: 4,
        managerCount: 3,
        denominationArkaCount: 3,
        liquidBalance: "4200000",
        collateralAmount: "0",
        debtAmount: "0",
        netManagedAmount: "4200000",
        netPositionValue: "350000",
        rank: 1,
      },
      {
        assetContract: "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75",
        syncedAt: PREVIOUS_SYNCED_AT,
        arkaCount: 4,
        managerCount: 3,
        denominationArkaCount: 3,
        liquidBalance: "4380000",
        collateralAmount: "0",
        debtAmount: "0",
        netManagedAmount: "4380000",
        netPositionValue: "380000",
        rank: 1,
      },
      {
        assetContract: "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75",
        syncedAt: FIXTURE_SYNCED_AT,
        arkaCount: 4,
        managerCount: 3,
        denominationArkaCount: 3,
        liquidBalance: "4450000",
        collateralAmount: "0",
        debtAmount: "0",
        netManagedAmount: "4450000",
        netPositionValue: "400000",
        rank: 1,
      },
    ],
    12,
  ),
  CD25MNVTZDL4Y3XBCPCJXGXATV5WUHHOWMYFF4YBEGU5FCPGMYTVG5JY: buildPage(
    [
      {
        assetContract: "CD25MNVTZDL4Y3XBCPCJXGXATV5WUHHOWMYFF4YBEGU5FCPGMYTVG5JY",
        syncedAt: OLDEST_SYNCED_AT,
        arkaCount: 2,
        managerCount: 2,
        denominationArkaCount: 0,
        liquidBalance: "900000",
        collateralAmount: "1100000",
        debtAmount: "0",
        netManagedAmount: "2000000",
        netPositionValue: "2300000",
        rank: 2,
      },
      {
        assetContract: "CD25MNVTZDL4Y3XBCPCJXGXATV5WUHHOWMYFF4YBEGU5FCPGMYTVG5JY",
        syncedAt: PREVIOUS_SYNCED_AT,
        arkaCount: 2,
        managerCount: 2,
        denominationArkaCount: 0,
        liquidBalance: "1020000",
        collateralAmount: "1150000",
        debtAmount: "0",
        netManagedAmount: "2170000",
        netPositionValue: "2550000",
        rank: 2,
      },
      {
        assetContract: "CD25MNVTZDL4Y3XBCPCJXGXATV5WUHHOWMYFF4YBEGU5FCPGMYTVG5JY",
        syncedAt: FIXTURE_SYNCED_AT,
        arkaCount: 2,
        managerCount: 2,
        denominationArkaCount: 0,
        liquidBalance: "1100000",
        collateralAmount: "1200000",
        debtAmount: "0",
        netManagedAmount: "2300000",
        netPositionValue: "2800000",
        rank: 2,
      },
    ],
    12,
  ),
};

export const arkaHistoryFixture: Record<string, Page<ArkaHistoryPoint>> = {
  CA7ALPHAQFK2MZKJY4R5S8N2P1T6V9W3X7Y2Z5ABCD1EFGH2345678IJ: buildPage(
    [
      {
        arkaId: "CA7ALPHAQFK2MZKJY4R5S8N2P1T6V9W3X7Y2Z5ABCD1EFGH2345678IJ",
        syncedAt: OLDEST_SYNCED_AT,
        nav: "4700000",
        manager: "GCAALPHA7RTH9KLMNOPQ2UVWX3YZ56789ABCDEFGHJKLMNPRSTUV4WX",
        curated: true,
        delisted: false,
        shareToken: "CSHAREALPHA7RTH9KLMNOPQ2UVWX3YZ56789ABCDEFGHJKLMNPRSTU",
        rank: 1,
      },
      {
        arkaId: "CA7ALPHAQFK2MZKJY4R5S8N2P1T6V9W3X7Y2Z5ABCD1EFGH2345678IJ",
        syncedAt: PREVIOUS_SYNCED_AT,
        nav: "4980000",
        manager: "GCAALPHA7RTH9KLMNOPQ2UVWX3YZ56789ABCDEFGHJKLMNPRSTUV4WX",
        curated: true,
        delisted: false,
        shareToken: "CSHAREALPHA7RTH9KLMNOPQ2UVWX3YZ56789ABCDEFGHJKLMNPRSTU",
        rank: 1,
      },
      {
        arkaId: "CA7ALPHAQFK2MZKJY4R5S8N2P1T6V9W3X7Y2Z5ABCD1EFGH2345678IJ",
        syncedAt: FIXTURE_SYNCED_AT,
        nav: "5200000",
        manager: "GCAALPHA7RTH9KLMNOPQ2UVWX3YZ56789ABCDEFGHJKLMNPRSTUV4WX",
        curated: true,
        delisted: false,
        shareToken: "CSHAREALPHA7RTH9KLMNOPQ2UVWX3YZ56789ABCDEFGHJKLMNPRSTU",
        rank: 1,
      },
    ],
    12,
  ),
};

export const arkaAssetsFixture: Record<string, ArkaAssetExposure[]> = {
  CA7ALPHAQFK2MZKJY4R5S8N2P1T6V9W3X7Y2Z5ABCD1EFGH2345678IJ: FIXTURE_ARKAS[0].assets,
};

export const arkaPortfolioFixture: Record<string, ArkaPortfolio> = {
  CA7ALPHAQFK2MZKJY4R5S8N2P1T6V9W3X7Y2Z5ABCD1EFGH2345678IJ: {
    arkaId: "CA7ALPHAQFK2MZKJY4R5S8N2P1T6V9W3X7Y2Z5ABCD1EFGH2345678IJ",
    manager: "GCAALPHA7RTH9KLMNOPQ2UVWX3YZ56789ABCDEFGHJKLMNPRSTUV4WX",
    shareToken: "CSHAREALPHA7RTH9KLMNOPQ2UVWX3YZ56789ABCDEFGHJKLMNPRSTU",
    denominationContract: "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75",
    syncedAt: FIXTURE_SYNCED_AT,
    nav: "5200000",
    totalNavContribution: "5200000",
    items: [
      {
        assetContract: "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75",
        rank: 1,
        isDenomination: true,
        marketIds: [],
        navContribution: "2100000",
        weightBps: 4038,
        liquidBalance: "2100000",
        collateralAmount: "0",
        debtAmount: "0",
        netPositionValue: "0",
      },
      {
        assetContract: "CD25MNVTZDL4Y3XBCPCJXGXATV5WUHHOWMYFF4YBEGU5FCPGMYTVG5JY",
        rank: 2,
        isDenomination: false,
        marketIds: ["0"],
        navContribution: "1900000",
        weightBps: 3653,
        liquidBalance: "600000",
        collateralAmount: "800000",
        debtAmount: "0",
        netPositionValue: "1900000",
      },
      {
        assetContract: "CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA",
        rank: 3,
        isDenomination: false,
        marketIds: [],
        navContribution: "1200000",
        weightBps: 2307,
        liquidBalance: "1200000",
        collateralAmount: "0",
        debtAmount: "0",
        netPositionValue: "1200000",
      },
    ],
  },
};

export const arkaActivityFixture: Record<string, Page<ActivityEntry>> = {
  CA7ALPHAQFK2MZKJY4R5S8N2P1T6V9W3X7Y2Z5ABCD1EFGH2345678IJ: buildPage(
    [
      {
        eventId: "evt-alpha-1",
        cursor: "evt-alpha-1",
        arkaId: "CA7ALPHAQFK2MZKJY4R5S8N2P1T6V9W3X7Y2Z5ABCD1EFGH2345678IJ",
        manager: "GCAALPHA7RTH9KLMNOPQ2UVWX3YZ56789ABCDEFGHJKLMNPRSTUV4WX",
        kind: "deposit",
        ledger: 532884,
        ledgerClosedAt: "2026-03-27T10:28:00.000Z",
        txHash: "tx-alpha-1",
        transactionIndex: 0,
        operationIndex: 0,
        inSuccessfulContractCall: true,
        user: "GDEPOSITORALPHA7RTH9KLMNOPQ2UVWX3YZ56789ABCDEFGHJKLM",
        assetContract: "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75",
        marketId: null,
        amount: "250000",
        shares: "245000",
        netOut: null,
        stepCount: null,
      },
      {
        eventId: "evt-alpha-2",
        cursor: "evt-alpha-2",
        arkaId: "CA7ALPHAQFK2MZKJY4R5S8N2P1T6V9W3X7Y2Z5ABCD1EFGH2345678IJ",
        manager: "GCAALPHA7RTH9KLMNOPQ2UVWX3YZ56789ABCDEFGHJKLMNPRSTUV4WX",
        kind: "lend",
        ledger: 532860,
        ledgerClosedAt: "2026-03-27T10:21:00.000Z",
        txHash: "tx-alpha-2",
        transactionIndex: 0,
        operationIndex: 0,
        inSuccessfulContractCall: true,
        user: null,
        assetContract: "CD25MNVTZDL4Y3XBCPCJXGXATV5WUHHOWMYFF4YBEGU5FCPGMYTVG5JY",
        marketId: "0",
        amount: "900000",
        shares: null,
        netOut: null,
        stepCount: 1,
      },
      {
        eventId: "evt-alpha-3",
        cursor: "evt-alpha-3",
        arkaId: "CA7ALPHAQFK2MZKJY4R5S8N2P1T6V9W3X7Y2Z5ABCD1EFGH2345678IJ",
        manager: "GCAALPHA7RTH9KLMNOPQ2UVWX3YZ56789ABCDEFGHJKLMNPRSTUV4WX",
        kind: "profit",
        ledger: 532812,
        ledgerClosedAt: "2026-03-27T10:08:00.000Z",
        txHash: "tx-alpha-3",
        transactionIndex: 0,
        operationIndex: 0,
        inSuccessfulContractCall: true,
        user: null,
        assetContract: "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75",
        marketId: null,
        amount: "120000",
        shares: null,
        netOut: null,
        stepCount: null,
      },
      {
        eventId: "evt-alpha-4",
        cursor: "evt-alpha-4",
        arkaId: "CA7ALPHAQFK2MZKJY4R5S8N2P1T6V9W3X7Y2Z5ABCD1EFGH2345678IJ",
        manager: "GCAALPHA7RTH9KLMNOPQ2UVWX3YZ56789ABCDEFGHJKLMNPRSTUV4WX",
        kind: "redeem",
        ledger: 532740,
        ledgerClosedAt: "2026-03-27T09:47:00.000Z",
        txHash: "tx-alpha-4",
        transactionIndex: 0,
        operationIndex: 0,
        inSuccessfulContractCall: true,
        user: "GREDEEMERALPHA7RTH9KLMNOPQ2UVWX3YZ56789ABCDEFGHJKLM",
        assetContract: "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75",
        marketId: null,
        amount: null,
        shares: "100000",
        netOut: "98500",
        stepCount: null,
      },
    ],
    20,
  ),
};

export function fixtureArkasPage(
  query: DiscoverQuery & { limit?: number } = {},
): Page<RankedArkaCatalogEntry> {
  const filtered = FIXTURE_ARKAS.filter((entry) => {
    if (query.curated !== undefined && entry.curated !== query.curated) {
      return false;
    }
    if (!query.search) {
      return true;
    }
    const haystack = `${entry.arkaId} ${entry.manager}`.toLowerCase();
    return haystack.includes(query.search.toLowerCase());
  });
  return buildPage(filtered, query.limit ?? filtered.length);
}

export function fixtureManagersPage(
  query: DiscoverQuery & { limit?: number } = {},
): Page<RankedManagerCatalogEntry> {
  const filtered = FIXTURE_MANAGERS.filter((entry) => {
    if (!query.search) {
      return true;
    }
    return entry.manager.toLowerCase().includes(query.search.toLowerCase());
  });
  return buildPage(filtered, query.limit ?? filtered.length);
}

export function fixtureAssetsPage(
  query: DiscoverQuery & { limit?: number } = {},
): Page<RankedAssetCatalogEntry> {
  const filtered = FIXTURE_ASSETS.filter((entry) => {
    if (!query.search) {
      return true;
    }
    const search = query.search.toLowerCase();
    const coreAsset = findCoreStellarAssetByContract(entry.assetContract);
    return [
      entry.assetContract,
      coreAsset?.symbol ?? "",
      coreAsset?.label ?? "",
    ].some((value) => value.toLowerCase().includes(search));
  });
  return buildPage(filtered, query.limit ?? filtered.length);
}

export function resolveCatalogFixture(pathname: string, searchParams: URLSearchParams): unknown {
  if (pathname === "/v1/dashboard/overview") {
    return dashboardOverviewFixture;
  }
  if (pathname === "/v1/dashboard/composition") {
    return dashboardCompositionFixture;
  }
  if (pathname === "/v1/monitoring/status") {
    return monitoringStatusFixture;
  }
  if (pathname === "/v1/arkas") {
    return fixtureArkasPage({
      search: searchParams.get("search") ?? undefined,
      curated: searchParams.get("curated") === "true" ? true : undefined,
      limit: parseLimit(searchParams.get("limit")),
    });
  }
  if (pathname.startsWith("/v1/arkas/") && pathname.endsWith("/history")) {
    const arkaId = decodeURIComponent(pathname.slice("/v1/arkas/".length, -"/history".length));
    return arkaHistoryFixture[arkaId] ?? emptyFixturePage();
  }
  if (pathname.startsWith("/v1/arkas/") && pathname.endsWith("/assets")) {
    const arkaId = decodeURIComponent(pathname.slice("/v1/arkas/".length, -"/assets".length));
    return arkaAssetsFixture[arkaId] ?? [];
  }
  if (pathname.startsWith("/v1/arkas/") && pathname.endsWith("/portfolio")) {
    const arkaId = decodeURIComponent(pathname.slice("/v1/arkas/".length, -"/portfolio".length));
    return arkaPortfolioFixture[arkaId] ?? { error: "not_found" };
  }
  if (pathname.startsWith("/v1/arkas/") && pathname.endsWith("/activity")) {
    const arkaId = decodeURIComponent(pathname.slice("/v1/arkas/".length, -"/activity".length));
    return arkaActivityFixture[arkaId] ?? emptyFixturePage();
  }
  if (pathname.startsWith("/v1/arkas/") && pathname.endsWith("/holders")) {
    const arkaId = decodeURIComponent(pathname.slice("/v1/arkas/".length, -"/holders".length));
    const arka = FIXTURE_ARKAS.find((entry) => entry.arkaId === arkaId);
    return {
      arkaId,
      shareToken: arka?.shareToken ?? null,
      totalShares: "100000000",
      indexedAt: "2026-03-27T10:00:00.000Z",
      complete: true,
      coverageFromLedger: 100,
      coverageToLedger: 200,
      total: 2,
      offset: 0,
      limit: 1,
      items: [],
    };
  }
  if (pathname.startsWith("/v1/arkas/")) {
    const arkaId = decodeURIComponent(pathname.slice("/v1/arkas/".length));
    return FIXTURE_ARKAS.find((entry) => entry.arkaId === arkaId) ?? { error: "not_found" };
  }
  if (pathname === "/v1/managers") {
    return fixtureManagersPage({
      search: searchParams.get("search") ?? undefined,
      limit: parseLimit(searchParams.get("limit")),
    });
  }
  if (pathname.startsWith("/v1/managers/") && pathname.endsWith("/history")) {
    const managerId = decodeURIComponent(pathname.slice("/v1/managers/".length, -"/history".length));
    return managerHistoryFixture[managerId] ?? emptyFixturePage();
  }
  if (pathname.startsWith("/v1/managers/") && pathname.endsWith("/arkas")) {
    const managerId = decodeURIComponent(pathname.slice("/v1/managers/".length, -"/arkas".length));
    const items = FIXTURE_ARKAS.filter((entry) => entry.manager === managerId);
    return buildPage(items, parseLimit(searchParams.get("limit")) ?? items.length);
  }
  if (pathname.startsWith("/v1/managers/")) {
    const managerId = decodeURIComponent(pathname.slice("/v1/managers/".length));
    return FIXTURE_MANAGERS.find((entry) => entry.manager === managerId) ?? { error: "not_found" };
  }
  if (pathname === "/v1/assets") {
    return fixtureAssetsPage({
      search: searchParams.get("search") ?? undefined,
      limit: parseLimit(searchParams.get("limit")),
    });
  }
  if (pathname.startsWith("/v1/assets/") && pathname.endsWith("/history")) {
    const assetId = decodeURIComponent(pathname.slice("/v1/assets/".length, -"/history".length));
    return assetHistoryFixture[assetId] ?? emptyFixturePage();
  }
  if (pathname.startsWith("/v1/assets/") && pathname.endsWith("/arkas")) {
    const assetId = decodeURIComponent(pathname.slice("/v1/assets/".length, -"/arkas".length));
    const items = FIXTURE_ARKAS.filter((entry) =>
      entry.assets.some((asset) => asset.assetContract === assetId),
    );
    return buildPage(items, parseLimit(searchParams.get("limit")) ?? items.length);
  }
  if (pathname.startsWith("/v1/assets/")) {
    const assetId = decodeURIComponent(pathname.slice("/v1/assets/".length));
    return FIXTURE_ASSETS.find((entry) => entry.assetContract === assetId) ?? { error: "not_found" };
  }
  return { error: "not_found" };
}

function parseLimit(limit: string | null): number | undefined {
  if (!limit) {
    return undefined;
  }
  const parsed = Number.parseInt(limit, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function buildPage<T>(items: T[], limit: number): Page<T> {
  return {
    total: items.length,
    offset: 0,
    limit,
    items: items.slice(0, limit),
  };
}

function emptyFixturePage<T>(): Page<T> {
  return {
    total: 0,
    offset: 0,
    limit: 0,
    items: [],
  };
}
