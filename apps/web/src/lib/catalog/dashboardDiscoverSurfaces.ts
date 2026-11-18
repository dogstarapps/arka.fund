import type {
  ActivitySummary,
  ArkaAssetExposure,
  ArkaIdentityMetadata,
  DashboardBundle,
  DiscoverBundle,
  RankedArkaCatalogEntry,
} from "./types";
export interface DashboardFeaturedArka {
  arkaId: string;
  rank: number;
  manager: string;
  nav: string | null;
  navUsdEstimate: string | null;
  denominationSymbol: string | null;
  syncedAt: string;
  curated: boolean;
  delisted: boolean;
  denominationContract: string | null;
  assetCount: number;
  whitelistCount: number;
  feesLabel: string;
  leadAssetContract: string | null;
  navSharePct: number;
  identity?: ArkaIdentityMetadata | null;
}

export interface DashboardActivitySignal {
  id: "deposit" | "redeem" | "credit";
  label: string;
  count: number;
  volume: string;
  emphasis: "positive" | "warning" | "neutral";
}

export interface DashboardStagePoint {
  id: string;
  label: string;
  xPct: number;
  yPct: number;
}

export interface DashboardStageSummary {
  stageValue: string | null;
  stageDeltaLabel: string;
  stageDeltaDetail: string;
  chartLabels: string[];
  points: DashboardStagePoint[];
  selectedRange: DashboardStageRange;
  rangeOptions: DashboardStageRangeOption[];
}

export type DashboardStageRange = "1d" | "1w" | "6m" | "1y" | "all";

export interface DashboardStageRangeOption {
  id: DashboardStageRange;
  label: string;
  enabled: boolean;
  pointCount: number;
  unavailableReason: string | null;
}

export interface DiscoverSummarySignal {
  id: "arkas" | "managers" | "assets" | "scope";
  label: string;
  value: string;
  detail: string;
}

export interface DiscoverStageTile {
  id:
    | "arkas"
    | "nav"
    | "managers"
    | "assets"
    | "curated"
    | "routes"
    | "base"
    | "scope";
  label: string;
  value: string;
  valueKind: "amount" | "integer" | "percent" | "text";
  detail: string;
  tone: "default" | "positive" | "warning";
}

export interface PublicFigmaMetricTile {
  id: string;
  label: string;
  value: string;
  valueKind: "amount" | "integer" | "percent" | "text";
  detail: string;
  tone: "default" | "positive" | "warning";
}

export interface DiscoverFeaturedArka {
  arkaId: string;
  rank: number;
  manager: string;
  nav: string | null;
  navUsdEstimate: string | null;
  denominationSymbol: string | null;
  assetCount: number;
  whitelistCount: number;
  feesLabel: string;
  syncedAt: string;
  curated: boolean;
  delisted: boolean;
  identity?: ArkaIdentityMetadata | null;
  allocationBands: Array<{
    assetContract: string;
    managedAmount: string;
    sharePct: number;
    isDenomination: boolean;
  }>;
}

const DASHBOARD_STAGE_RANGE_WINDOWS: Array<{
  id: DashboardStageRange;
  label: string;
  days: number | null;
}> = [
  { id: "1d", label: "1D", days: 1 },
  { id: "1w", label: "1W", days: 7 },
  { id: "6m", label: "6M", days: 183 },
  { id: "1y", label: "1Y", days: 365 },
  { id: "all", label: "ALL", days: null },
];

function computeSharePct(value: string, total: string): number {
  const numerator = Number(value);
  const denominator = Number(total);
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(100, Number(((BigInt(value) * BigInt(10_000)) / BigInt(total)).toString()) / 100));
}

function buildDiscoverAllocationBands(
  assets: ArkaAssetExposure[],
  limit = 3,
): DiscoverFeaturedArka["allocationBands"] {
  const totalManaged = assets.reduce(
    (accumulator, asset) => accumulator + BigInt(asset.netManagedAmount),
    BigInt(0),
  );

  return [...assets]
    .sort((left, right) => {
      const managedDiff = BigInt(right.netManagedAmount) - BigInt(left.netManagedAmount);
      if (managedDiff !== BigInt(0)) {
        return managedDiff > BigInt(0) ? 1 : -1;
      }
      if (left.isDenomination !== right.isDenomination) {
        return left.isDenomination ? -1 : 1;
      }
      return left.assetContract.localeCompare(right.assetContract);
    })
    .slice(0, limit)
    .map((asset) => ({
      assetContract: asset.assetContract,
      managedAmount: asset.netManagedAmount,
      sharePct: totalManaged > BigInt(0) ? computeSharePct(asset.netManagedAmount, totalManaged.toString()) : 0,
      isDenomination: asset.isDenomination,
    }));
}

function sumVisibleUsdEstimate(entries: RankedArkaCatalogEntry[]): {
  value: string | null;
  missingCount: number;
} {
  if (entries.length === 0) {
    return { value: null, missingCount: 0 };
  }

  const estimates = entries.map((entry) => entry.economics?.navUsdEstimate);
  const missingCount = estimates.filter(
    (value, index) =>
      (value === null || value === undefined) &&
      (entries[index]?.nav === null || BigInt(entries[index]?.nav ?? "0") > BigInt(0)),
  ).length;

  if (missingCount > 0 || estimates.some((value) => value === null || value === undefined)) {
    return { value: null, missingCount };
  }

  return {
    value: estimates
      .reduce((total, value) => total + BigInt(value ?? "0"), BigInt(0))
      .toString(),
    missingCount: 0,
  };
}

function formatArkaUsdPricingRequirement(count: number): string {
  return count === 1
    ? "1 Arka needs USD pricing before TVL can be shown"
    : `${count} Arkas need USD pricing before TVL can be shown`;
}

export type DiscoverFeaturedMode = "ranked" | "profit" | "search" | "fresh";

function resolveDiscoverSearchPosition(entry: RankedArkaCatalogEntry, query: string): number {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return Number.MAX_SAFE_INTEGER;
  }

  const haystacks = [entry.arkaId, entry.manager, entry.denominationContract ?? ""].map((value) => value.toLowerCase());
  const positions = haystacks
    .map((value) => value.indexOf(normalizedQuery))
    .filter((value) => value >= 0);

  return positions.length > 0 ? Math.min(...positions) : Number.MAX_SAFE_INTEGER;
}

export function sortDiscoverFeaturedEntries(
  entries: RankedArkaCatalogEntry[],
  mode: DiscoverFeaturedMode,
  query = "",
): RankedArkaCatalogEntry[] {
  const ranked = [...entries];
  if (mode === "profit") {
    return ranked.sort((left, right) => {
      const profitDiff = BigInt(right.profitBase ?? "0") - BigInt(left.profitBase ?? "0");
      if (profitDiff !== BigInt(0)) {
        return profitDiff > BigInt(0) ? 1 : -1;
      }
      return left.rank - right.rank;
    });
  }

  if (mode === "search") {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return ranked;
    }

    return ranked.sort((left, right) => {
      const leftPosition = resolveDiscoverSearchPosition(left, normalizedQuery);
      const rightPosition = resolveDiscoverSearchPosition(right, normalizedQuery);
      if (leftPosition !== rightPosition) {
        return leftPosition - rightPosition;
      }
      return left.rank - right.rank;
    });
  }

  if (mode === "fresh") {
    return ranked.sort((left, right) => {
      const leftTime = Date.parse(left.syncedAt);
      const rightTime = Date.parse(right.syncedAt);
      if (leftTime !== rightTime) {
        return rightTime - leftTime;
      }
      return left.rank - right.rank;
    });
  }

  return ranked;
}

export function buildDashboardFeaturedArkas(
  entries: RankedArkaCatalogEntry[],
  totalNav: string,
  limit = 3,
): DashboardFeaturedArka[] {
  const total = Number(totalNav);
  return entries.slice(0, limit).map((entry) => ({
    arkaId: entry.arkaId,
    rank: entry.rank,
    manager: entry.manager,
    nav: entry.nav,
    navUsdEstimate: entry.economics?.navUsdEstimate ?? null,
    denominationSymbol: entry.economics?.denominationAsset?.symbol ?? null,
    syncedAt: entry.syncedAt,
    curated: entry.curated,
    delisted: entry.delisted,
    denominationContract: entry.denominationContract,
    assetCount: entry.assets.length,
    whitelistCount: entry.whitelistContracts.length,
    feesLabel: `Management ${(entry.fees.mgmtBps / 100).toFixed(2)}% · Performance ${(entry.fees.perfBps / 100).toFixed(2)}%`,
    leadAssetContract: entry.assets[0]?.assetContract ?? null,
    navSharePct: total > 0 && entry.nav !== null ? computeSharePct(entry.nav, totalNav) : 0,
    identity: entry.identity ?? null,
  }));
}

interface AggregatedHistoryPoint {
  syncedAt: string;
  totalNav: string;
}

function buildDashboardHistorySeries(): AggregatedHistoryPoint[] {
  // The catalog currently exposes history in native asset units. It must not be plotted as USD.
  return [];
}

function filterDashboardHistoryRange(
  items: AggregatedHistoryPoint[],
  range: DashboardStageRange,
): AggregatedHistoryPoint[] {
  if (range === "all" || items.length === 0) {
    return items;
  }

  const rangeConfig = DASHBOARD_STAGE_RANGE_WINDOWS.find((item) => item.id === range);
  if (!rangeConfig?.days) {
    return items;
  }

  const latest = new Date(items[items.length - 1].syncedAt).getTime();
  const cutoff = latest - rangeConfig.days * 24 * 60 * 60 * 1000;
  return items.filter((item) => new Date(item.syncedAt).getTime() >= cutoff);
}

function formatDashboardHistoryLabel(
  value: string,
  includeTime = false,
): string {
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    return value;
  }
  return timestamp.toLocaleDateString(
    "en",
    includeTime
      ? {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }
      : { month: "short", day: "numeric" },
  );
}

export function buildDashboardActivitySignals(activity: ActivitySummary): DashboardActivitySignal[] {
  return [
    {
      id: "deposit",
      label: "Deposits",
      count: activity.counts.deposit,
      volume: activity.depositVolume,
      emphasis: "positive",
    },
    {
      id: "redeem",
      label: "Redeems",
      count: activity.counts.redeem,
      volume: activity.redeemVolume,
      emphasis: "warning",
    },
    {
      id: "credit",
      label: "Credit actions",
      count: activity.counts.lend + activity.counts.borrow + activity.counts.repay + activity.counts.withdraw,
      volume: activity.netUserFlow,
      emphasis: "neutral",
    },
  ];
}

export function buildDashboardFigmaMetricTiles(
  bundle: DashboardBundle,
): PublicFigmaMetricTile[] {
  const totalUsd = bundle.overview.totalNavUsdEstimate ?? null;
  const healthValue = bundle.monitoring.healthy
    ? bundle.monitoring.degraded
      ? "Degraded"
      : "Healthy"
    : "Offline";
  const healthTone = bundle.monitoring.healthy
    ? bundle.monitoring.degraded
      ? "warning"
      : "positive"
    : "warning";

  return [
    {
      id: "arkas",
      label: "Arkas",
      value: String(bundle.overview.totalArkas),
      valueKind: "integer",
      detail: `${bundle.overview.totalArkas} Arkas available`,
      tone: "default",
    },
    {
      id: "nav",
      label: "TVL",
      value: totalUsd ?? "Valuation unavailable",
      valueKind: totalUsd ? "amount" : "text",
      detail: totalUsd
        ? "total value in USD"
        : "USD value is not available yet",
      tone: totalUsd ? "positive" : "warning",
    },
    {
      id: "withdrawals",
      label: "Withdrawals",
      value: String(bundle.overview.activity.counts.redeem),
      valueKind: "integer",
      // Redeems can span several assets, so their aggregate raw amount has no
      // meaningful unit for a customer. Keep this card to an honest count.
      detail: "redemptions recorded",
      tone: "warning",
    },
    {
      id: "deposits",
      label: "Deposits",
      value: String(bundle.overview.activity.counts.deposit),
      valueKind: "integer",
      // See the matching withdrawal card above: a mixed-asset aggregate is not
      // a meaningful portfolio volume.
      detail: "deposits recorded",
      tone: "positive",
    },
    {
      id: "managers",
      label: "Managers",
      value: String(bundle.overview.totalManagers),
      valueKind: "integer",
      detail: `${bundle.managers.total} manager profiles`,
      tone: "default",
    },
    {
      id: "assets",
      label: "Assets",
      value: String(bundle.overview.totalAssets),
      valueKind: "integer",
      detail: `${bundle.composition.items.length} current exposures`,
      tone: "default",
    },
    {
      id: "activity",
      label: "Recent actions",
      value: String(bundle.overview.activity.totalEvents),
      valueKind: "integer",
      detail: `${bundle.overview.activity.uniqueUsers} ${bundle.overview.activity.uniqueUsers === 1 ? "wallet" : "wallets"} involved`,
      tone: "positive",
    },
    {
      id: "health",
      label: "Health",
      value: healthValue,
      valueKind: "text",
      detail: `${bundle.monitoring.snapshotAgeSeconds ?? "n/a"}s since update`,
      tone: healthTone,
    },
  ];
}

export function buildDashboardStageSummary(
  bundle: DashboardBundle,
  requestedRange: DashboardStageRange = "all",
): DashboardStageSummary {
  const historySeries = buildDashboardHistorySeries();
  const rangeOptions = DASHBOARD_STAGE_RANGE_WINDOWS.map((range) => {
    const pointCount = filterDashboardHistoryRange(historySeries, range.id).length;
    const enabled = pointCount >= 2;
    return {
      id: range.id,
      label: range.label,
      enabled,
      pointCount,
      unavailableReason: enabled
        ? null
        : "USD value history will appear once two indexed valuations are available.",
    };
  });
  const selectedRange = rangeOptions.find((item) => item.id === requestedRange && item.enabled)
    ? requestedRange
    : rangeOptions.find((item) => item.id === "all" && item.enabled)?.id ?? "all";
  const filteredHistory = filterDashboardHistoryRange(historySeries, selectedRange);
  const values = filteredHistory.map((entry) => Number(entry.totalNav));
  const max = Math.max(...values, 1);
  const min = Math.min(...values, max);
  const spread = Math.max(1, max - min);
  const dateLabels = filteredHistory.map((entry) =>
    formatDashboardHistoryLabel(entry.syncedAt),
  );
  const includeTime = new Set(dateLabels).size < dateLabels.length;
  const chartPoints =
    filteredHistory.length >= 2
      ? filteredHistory.map((entry, index) => ({
          id: entry.syncedAt,
          label: formatDashboardHistoryLabel(entry.syncedAt, includeTime),
          xPct:
            filteredHistory.length === 1
              ? 100
              : Math.round((index / (filteredHistory.length - 1)) * 100),
          yPct: Math.round(22 + ((Number(entry.totalNav) - min) / spread) * 56),
        }))
      : [];
  const chartLabels =
    filteredHistory.length >= 2
      ? filteredHistory.map((entry) =>
          formatDashboardHistoryLabel(entry.syncedAt, includeTime),
        )
      : [];
  const rangeDelta = {
    label: "n/a",
    detail: "USD value history will appear once two indexed valuations are available.",
  };

  return {
    stageValue: bundle.overview.totalNavUsdEstimate ?? null,
    stageDeltaLabel: rangeDelta.label,
    stageDeltaDetail: rangeDelta.detail,
    chartLabels,
    selectedRange,
    rangeOptions,
    points: chartPoints,
  };
}

export function buildDiscoverSummarySignals(
  data: DiscoverBundle,
  options: { curatedOnly: boolean; search: string },
): DiscoverSummarySignal[] {
  const query = options.search.trim();
  return [
    {
      id: "arkas",
      label: "Arkas",
      value: String(data.arkas.total),
      detail: query ? `matching "${query}"` : "live ranked vaults",
    },
    {
      id: "managers",
      label: "Managers",
      value: String(data.managers.total),
      detail: "active managers",
    },
    {
      id: "assets",
      label: "Assets",
      value: String(data.assets.total),
      detail: "tracked exposures",
    },
    {
      id: "scope",
      label: "Scope",
      value: options.curatedOnly ? "Curated" : "All",
      detail: options.curatedOnly ? "curated shortlist" : "full view",
    },
  ];
}

export function buildDiscoverStageTiles(
  data: DiscoverBundle,
  options: { curatedOnly: boolean },
): DiscoverStageTile[] {
  const curatedCount = data.arkas.items.filter((entry) => entry.curated).length;
  const delistedCount = data.arkas.items.filter((entry) => entry.delisted).length;
  const visibleUsd = sumVisibleUsdEstimate(data.arkas.items);
  const routeCount = data.arkas.items.reduce(
    (total, entry) => total + entry.whitelistContracts.length,
    0,
  );
  const baseAssetCount = new Set(
    data.arkas.items
      .map((entry) => entry.denominationContract)
      .filter((value): value is string => Boolean(value)),
  );

  return [
    {
      id: "arkas",
      label: "Arkas",
      value: String(data.overview.totalArkas),
      valueKind: "integer",
      detail: options.curatedOnly
        ? `${curatedCount} curated tracked`
        : `${data.arkas.items.length} visible`,
      tone: "default",
    },
    {
      id: "nav",
      label: "TVL",
      value: visibleUsd.value ?? "Valuation unavailable",
      valueKind: visibleUsd.value ? "amount" : "text",
      detail: visibleUsd.value
        ? `${data.arkas.items.length} visible Arkas · USD TVL`
        : formatArkaUsdPricingRequirement(
            visibleUsd.missingCount || data.arkas.items.length,
          ),
      tone: visibleUsd.value ? "positive" : "warning",
    },
    {
      id: "managers",
      label: "Managers",
      value: String(data.overview.totalManagers),
      valueKind: "integer",
      detail: `${data.managers.items.length} visible managers`,
      tone: delistedCount === 0 ? "positive" : "warning",
    },
    {
      id: "assets",
      label: "Assets",
      value: String(data.overview.totalAssets),
      valueKind: "integer",
      detail: `${data.assets.items.length} tracked exposures`,
      tone: "default",
    },
    {
      id: "curated",
      label: "Curated",
      value: String(curatedCount),
      valueKind: "integer",
      detail: `${delistedCount} delisted`,
      tone: delistedCount === 0 ? "positive" : "warning",
    },
    {
      id: "routes",
      label: "Allowed assets",
      value: String(routeCount),
      valueKind: "integer",
      detail: "current mandates",
      tone: routeCount > 0 ? "positive" : "warning",
    },
    {
      id: "base",
      label: "Denominations",
      value: String(baseAssetCount.size),
      valueKind: "integer",
      detail: "accounting assets",
      tone: "default",
    },
    {
      id: "scope",
      label: "Scope",
      value: options.curatedOnly ? "Curated" : "All",
      valueKind: "text",
      detail: options.curatedOnly ? "curated shortlist" : "full view",
      tone: options.curatedOnly ? "positive" : "default",
    },
  ];
}

function buildDiscoverFeesLabel(entry: RankedArkaCatalogEntry): string {
  return `Management ${(entry.fees.mgmtBps / 100).toFixed(2)}% · Performance ${(entry.fees.perfBps / 100).toFixed(2)}%`;
}

export function buildDiscoverFeaturedArkas(
  entries: RankedArkaCatalogEntry[],
  limit = 3,
): DiscoverFeaturedArka[] {
  return entries.slice(0, limit).map((entry) => ({
    arkaId: entry.arkaId,
    rank: entry.rank,
    manager: entry.manager,
    nav: entry.nav,
    navUsdEstimate: entry.economics?.navUsdEstimate ?? null,
    denominationSymbol: entry.economics?.denominationAsset?.symbol ?? null,
    assetCount: entry.assets.length,
    whitelistCount: entry.whitelistContracts.length,
    feesLabel: buildDiscoverFeesLabel(entry),
    syncedAt: entry.syncedAt,
    curated: entry.curated,
    delisted: entry.delisted,
    identity: entry.identity ?? null,
    allocationBands: buildDiscoverAllocationBands(entry.assets),
  }));
}

export function buildDashboardSummary(
  bundle: DashboardBundle,
  stageRange: DashboardStageRange = "all",
) {
  return {
    featuredArkas: buildDashboardFeaturedArkas(bundle.arkas.items, bundle.overview.totalNav),
    activitySignals: buildDashboardActivitySignals(bundle.overview.activity),
    stageSummary: buildDashboardStageSummary(bundle, stageRange),
  };
}

export type DashboardFeaturedMode = "ranked" | "curated" | "fresh" | "mine";

export function buildDashboardFeaturedEmptyCopy(mode: DashboardFeaturedMode): {
  title: string;
  body: string;
} {
  if (mode === "mine") {
    return {
      title: "No managed Arkas",
      body: "Connect the manager wallet used to create an Arka, or create a new one.",
    };
  }
  if (mode === "curated") {
    return {
      title: "No curated Arkas",
      body: "No curated Arkas are available yet.",
    };
  }

  if (mode === "fresh") {
    return {
      title: "No recently synced Arkas",
      body: "No recently added Arkas are available yet.",
    };
  }

  return {
    title: "No ranked Arkas",
    body: "No Arkas are available yet.",
  };
}
