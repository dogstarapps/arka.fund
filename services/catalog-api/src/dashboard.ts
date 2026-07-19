import type {
  ActivityCountSummary,
  ActivityEntry,
  ActivitySummary,
  ArkaPortfolio,
  ArkaPortfolioItem,
  CatalogAssetIdentity,
  CatalogHistoryArchive,
  CatalogSnapshot,
  CatalogOracleStatus,
  CatalogValuationSource,
  CompositionQuery,
  DashboardComposition,
  DashboardCompositionItem,
  DashboardMonitoringSummary,
  DashboardOverview,
  DashboardOverviewQuery,
  NavOverview,
  MonitoringStatus,
  Page,
} from "./types.js";
import { resolveAssetIdentity } from "./economics.js";

export function buildDashboardOverview(
  snapshot: CatalogSnapshot,
  history: CatalogHistoryArchive,
  monitoring: MonitoringStatus,
  activity: Page<ActivityEntry>,
  _query: DashboardOverviewQuery = {},
): DashboardOverview {
  const previous = previousSnapshot(history, snapshot.syncedAt);
  const totalNavDelta = previous
    ? subtractBigIntStrings(snapshot.metrics.totalNav, previous.metrics.totalNav)
    : null;
  const totalNavDeltaBps =
    previous && BigInt(previous.metrics.totalNav) > 0n
      ? bigintRatioBps(totalNavDelta ?? "0", previous.metrics.totalNav)
      : null;
  const composition = buildDashboardComposition(snapshot);
  const valuation = buildDashboardValuation(snapshot);

  return {
    syncedAt: snapshot.syncedAt,
    totalNav: snapshot.metrics.totalNav,
    totalNavUsdEstimate: valuation.totalNavUsdEstimate,
    valuationSource: valuation.valuationSource,
    oracleStatus: valuation.oracleStatus,
    missingPriceReasons: valuation.missingPriceReasons,
    denominationTotals: valuation.denominationTotals,
    totalNavDelta,
    totalNavDeltaBps,
    totalArkas: snapshot.metrics.totalArkas,
    totalManagers: snapshot.metrics.totalManagers,
    totalAssets: snapshot.metrics.totalAssets,
    curatedArkas: snapshot.metrics.curatedArkas,
    delistedArkas: snapshot.metrics.delistedArkas,
    largestAssetWeightBps: composition.items[0]?.weightBps ?? null,
    monitoring: summarizeMonitoring(monitoring),
    activity: summarizeActivity(
      activity.items,
      activity.dataStatus ?? "live",
      activity.unavailableReason ?? null,
    ),
  };
}

export function buildNavOverview(
  snapshot: CatalogSnapshot,
  history: CatalogHistoryArchive,
  monitoring: MonitoringStatus,
): NavOverview {
  const { activity: _activity, ...nav } = buildDashboardOverview(
    snapshot,
    history,
    monitoring,
    {
      total: 0,
      offset: 0,
      limit: 0,
      items: [],
      dataStatus: "unavailable",
      unavailableReason: null,
    },
  );
  return nav;
}

interface DashboardValuationSummary {
  totalNavUsdEstimate: string | null;
  valuationSource: CatalogValuationSource;
  oracleStatus: CatalogOracleStatus;
  missingPriceReasons: string[];
  denominationTotals: Array<{
    denominationAsset: CatalogAssetIdentity | null;
    totalNav: string;
    navUsdEstimate: string | null;
    arkaCount: number;
  }>;
}

function buildDashboardValuation(snapshot: CatalogSnapshot): DashboardValuationSummary {
  const totals = new Map<string, {
    denominationAsset: CatalogAssetIdentity | null;
    totalNav: bigint;
    navUsdEstimate: bigint | null;
    arkaCount: number;
  }>();

  for (const arka of snapshot.arkas) {
    const key = arka.denominationContract ?? "unassigned";
    const current = totals.get(key) ?? {
      denominationAsset: resolveAssetIdentity(arka.denominationContract),
      totalNav: 0n,
      navUsdEstimate: 0n,
      arkaCount: 0,
    };
    current.totalNav += BigInt(arka.nav);
    current.arkaCount += 1;
    const navUsdEstimate = arka.economics?.navUsdEstimate;
    current.navUsdEstimate =
      navUsdEstimate === null || navUsdEstimate === undefined || current.navUsdEstimate === null
        ? null
        : current.navUsdEstimate + BigInt(navUsdEstimate);
    totals.set(key, current);
  }

  const denominationTotals = [...totals.values()]
    .map((item) => ({
      denominationAsset: item.denominationAsset,
      totalNav: item.totalNav.toString(),
      navUsdEstimate: item.navUsdEstimate === null ? null : item.navUsdEstimate.toString(),
      arkaCount: item.arkaCount,
    }))
    .sort((left, right) => {
      const comparison = BigInt(right.totalNav) - BigInt(left.totalNav);
      return comparison === 0n ? 0 : comparison > 0n ? 1 : -1;
    });

  const missingPriceReasons = [...new Set(
    snapshot.arkas.flatMap((arka) => arka.economics?.missingPriceReasons ?? []),
  )];
  const allUsdValued = snapshot.arkas.length > 0 &&
    snapshot.arkas.every((arka) => arka.economics?.navUsdEstimate !== null && arka.economics?.navUsdEstimate !== undefined);
  const totalNavUsdEstimate = allUsdValued
    ? snapshot.arkas
        .reduce((total, arka) => total + BigInt(arka.economics?.navUsdEstimate ?? "0"), 0n)
        .toString()
    : null;
  const valuedSources = new Set(
    snapshot.arkas.map((arka) => arka.economics?.valuationSource ?? "unavailable"),
  );
  const oracleStatuses = snapshot.arkas.map(
    (arka) => arka.economics?.oracleStatus ?? "missing_price",
  );

  return {
    totalNavUsdEstimate,
    valuationSource: !allUsdValued
      ? "unavailable"
      : valuedSources.has("oracle_verified")
        ? "oracle_verified"
        : "usd_stablecoin_parity",
    oracleStatus: allUsdValued
      ? oracleStatuses.includes("verified")
        ? "verified"
        : "not_required_usd_stablecoin"
      : mostRelevantUnavailableStatus(oracleStatuses),
    missingPriceReasons,
    denominationTotals,
  };
}

function mostRelevantUnavailableStatus(
  statuses: CatalogOracleStatus[],
): CatalogOracleStatus {
  const priority: CatalogOracleStatus[] = [
    "policy_paused",
    "stale_price",
    "invalid_price",
    "missing_price",
  ];
  return priority.find((status) => statuses.includes(status)) ?? "missing_price";
}

export function buildDashboardComposition(
  snapshot: CatalogSnapshot,
  query: CompositionQuery = {},
): DashboardComposition {
  const totalNav = snapshot.metrics.totalNav;
  const items = snapshot.assets
    .map((asset, index) => {
      const navContribution = addBigIntStrings(asset.liquidBalance, asset.netPositionValue);
      return {
        assetContract: asset.assetContract,
        rank: index + 1,
        arkaCount: asset.arkaCount,
        managerCount: asset.managerCount,
        denominationArkaCount: asset.denominationArkaCount,
        navContribution,
        weightBps: bigintRatioBps(navContribution, totalNav),
        liquidBalance: asset.liquidBalance,
        collateralAmount: asset.collateralAmount,
        debtAmount: asset.debtAmount,
        netPositionValue: asset.netPositionValue,
      } satisfies DashboardCompositionItem;
    })
    .sort(compareCompositionItems)
    .slice(0, normalizeLimit(query.limit));

  return {
    syncedAt: snapshot.syncedAt,
    totalNav,
    items: items.map((item, index) => ({ ...item, rank: index + 1 })),
  };
}

export function buildArkaPortfolio(
  snapshot: CatalogSnapshot,
  arkaId: string,
  query: CompositionQuery = {},
): ArkaPortfolio | null {
  const arka = snapshot.arkas.find((entry) => entry.arkaId === arkaId);
  if (!arka) {
    return null;
  }
  const totalNavContribution = arka.assets.reduce(
    (accumulator, asset) => addBigIntStrings(accumulator, navContribution(asset.liquidBalance, asset.netPositionValue)),
    "0",
  );
  const items = arka.assets
    .map((asset, index) => {
      const contribution = navContribution(asset.liquidBalance, asset.netPositionValue);
      return {
        assetContract: asset.assetContract,
        rank: index + 1,
        isDenomination: asset.isDenomination,
        marketIds: [...asset.marketIds].sort(),
        navContribution: contribution,
        weightBps: bigintRatioBps(contribution, arka.nav),
        liquidBalance: asset.liquidBalance,
        collateralAmount: asset.collateralAmount,
        debtAmount: asset.debtAmount,
        netPositionValue: asset.netPositionValue,
      } satisfies ArkaPortfolioItem;
    })
    .sort(comparePortfolioItems)
    .slice(0, normalizeLimit(query.limit));

  return {
    arkaId: arka.arkaId,
    manager: arka.manager,
    shareToken: arka.shareToken,
    denominationContract: arka.denominationContract,
    syncedAt: arka.syncedAt,
    nav: arka.nav,
    totalNavContribution,
    items: items.map((item, index) => ({ ...item, rank: index + 1 })),
  };
}

export function summarizeActivity(
  entries: ActivityEntry[],
  dataStatus: "live" | "unavailable" = "live",
  unavailableReason: string | null = null,
): ActivitySummary {
  const counts: ActivityCountSummary = {
    deposit: 0,
    redeem: 0,
    profit: 0,
    lend: 0,
    borrow: 0,
    repay: 0,
    withdraw: 0,
  };
  let depositVolume = "0";
  let redeemVolume = "0";
  let profitVolume = "0";
  const users = new Set<string>();
  let oldestLedger: number | null = null;
  let latestLedger: number | null = null;

  for (const entry of entries) {
    counts[entry.kind] += 1;
    if (entry.user) {
      users.add(entry.user);
    }
    oldestLedger = oldestLedger === null ? entry.ledger : Math.min(oldestLedger, entry.ledger);
    latestLedger = latestLedger === null ? entry.ledger : Math.max(latestLedger, entry.ledger);
    if (entry.kind === "deposit" && entry.amount) {
      depositVolume = addBigIntStrings(depositVolume, entry.amount);
    }
    if (entry.kind === "redeem" && entry.netOut) {
      redeemVolume = addBigIntStrings(redeemVolume, entry.netOut);
    }
    if (entry.kind === "profit" && entry.amount) {
      profitVolume = addBigIntStrings(profitVolume, entry.amount);
    }
  }

  return {
    dataStatus,
    unavailableReason,
    totalEvents: entries.length,
    uniqueUsers: users.size,
    oldestLedger,
    latestLedger,
    counts,
    depositVolume,
    redeemVolume,
    profitVolume,
    netUserFlow: subtractBigIntStrings(depositVolume, redeemVolume),
  };
}

function summarizeMonitoring(status: MonitoringStatus): DashboardMonitoringSummary {
  return {
    healthy: status.healthy,
    degraded: status.degraded,
    snapshotAgeSeconds: status.snapshotAgeSeconds,
    consecutiveFailures: status.consecutiveFailures,
    activeAlertCount: status.activeAlerts.length,
    lastRunStatus: status.lastRun?.status ?? null,
  };
}

function previousSnapshot(
  history: CatalogHistoryArchive,
  syncedAt: string,
): CatalogSnapshot | null {
  const candidates = history.runs
    .filter((run) => run.syncedAt < syncedAt)
    .sort((left, right) => right.syncedAt.localeCompare(left.syncedAt));
  return candidates[0] ?? null;
}

function navContribution(liquidBalance: string, netPositionValue: string): string {
  return addBigIntStrings(liquidBalance, netPositionValue);
}

function compareCompositionItems(
  left: DashboardCompositionItem,
  right: DashboardCompositionItem,
): number {
  const comparison = compareBigIntStrings(left.navContribution, right.navContribution);
  if (comparison !== 0) {
    return comparison * -1;
  }
  return left.assetContract.localeCompare(right.assetContract);
}

function comparePortfolioItems(
  left: ArkaPortfolioItem,
  right: ArkaPortfolioItem,
): number {
  const comparison = compareBigIntStrings(left.navContribution, right.navContribution);
  if (comparison !== 0) {
    return comparison * -1;
  }
  return left.assetContract.localeCompare(right.assetContract);
}

function normalizeLimit(limit?: number): number {
  return limit && Number.isInteger(limit) && limit > 0 ? limit : 10;
}

function bigintRatioBps(value: string, total: string): number {
  const denominator = BigInt(total);
  if (denominator <= 0n) {
    return 0;
  }
  return Number((BigInt(value) * 10_000n) / denominator);
}

function compareBigIntStrings(left: string, right: string): number {
  const leftValue = BigInt(left);
  const rightValue = BigInt(right);
  if (leftValue === rightValue) {
    return 0;
  }
  return leftValue > rightValue ? 1 : -1;
}

function addBigIntStrings(left: string, right: string): string {
  return (BigInt(left) + BigInt(right)).toString();
}

function subtractBigIntStrings(left: string, right: string): string {
  return (BigInt(left) - BigInt(right)).toString();
}
