import type {
  AssetHistoryPoint,
  ManagerIdentityMetadata,
  Page,
  RankedAssetCatalogEntry,
  RankedManagerCatalogEntry,
} from "./types";

const MIN_SPOTLIGHT_WIDTH = 18;

export interface ManagerSpotlightCard {
  manager: string;
  identity?: ManagerIdentityMetadata | null;
  rank: number;
  arkaCount: number;
  curatedArkaCount: number;
  delistedArkaCount: number;
  totalNav: string;
  totalNavUsdEstimate: string | null;
  syncedAt: string;
  navSharePct: number | null;
}

export interface AssetSpotlightCard {
  assetContract: string;
  rank: number;
  arkaCount: number;
  managerCount: number;
  denominationArkaCount: number;
  netManagedAmount: string;
  netPositionValue: string;
  netManagedUsdEstimate: string | null;
  liquidBalance: string;
  debtAmount: string;
  syncedAt: string;
  managedSharePct: number;
}

export interface ExplorerTelemetrySignal {
  id: string;
  label: string;
  value: string;
  detail: string;
}

export interface AssetPublicMetricTile {
  id:
    | "indexed"
    | "footprint"
    | "leader"
    | "leadShare"
    | "balanceSheet"
    | "debtLinked"
    | "scope";
  label: string;
  value: string;
  valueKind: "amount" | "integer" | "percent" | "asset" | "text";
  detail: string;
  tone: "default" | "positive" | "warning";
}

export type ManagerSpotlightMode = "lead" | "curated" | "search";
export type AssetSpotlightMode = "core" | "balanceSheet" | "search";

export interface AssetMarketMetrics {
  priceProxyBps: number | null;
  movementBps: number | null;
  movementTone: "positive" | "warning" | "neutral";
  movementSource: "history" | "insufficient_history";
}

function toBigInt(value: string): bigint | null {
  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

function sumCompleteUsdValues(
  values: Array<string | null | undefined>,
): bigint | null {
  if (values.some((value) => value === null || value === undefined)) {
    return null;
  }

  return values.reduce(
    (total, value) => total + (toBigInt(value ?? "0") ?? BigInt(0)),
    BigInt(0),
  );
}

export function computeShareBps(value: string, total: string): number | null {
  const numerator = toBigInt(value);
  const denominator = toBigInt(total);
  if (numerator === null || denominator === null || denominator <= BigInt(0)) {
    return null;
  }

  return Number((numerator * BigInt(10_000)) / denominator);
}

export function computeSharePct(value: string, total: string): number | null {
  const basisPoints = computeShareBps(value, total);
  if (basisPoints === null) {
    return null;
  }
  return basisPoints / 100;
}

export function computeSpotlightWidthByShare(
  value: string,
  total: string,
): number {
  const sharePct = computeSharePct(value, total);
  if (sharePct === null) {
    return 0;
  }
  return Math.max(0, Math.min(100, sharePct));
}

export function computeSpotlightWidthByRank(rank: number): number {
  return Math.max(
    MIN_SPOTLIGHT_WIDTH,
    Math.min(100, Math.round(100 / Math.max(1, rank))),
  );
}

export function buildManagerSpotlightCards(
  page: Page<RankedManagerCatalogEntry>,
  limit = page.items.length,
): ManagerSpotlightCard[] {
  const totalNav = sumCompleteUsdValues(
    page.items.map((item) => item.totalNavUsdEstimate),
  );

  return page.items.slice(0, limit).map((item) => ({
    manager: item.manager,
    identity: item.identity,
    rank: item.rank,
    arkaCount: item.arkaCount,
    curatedArkaCount: item.curatedArkaCount,
    delistedArkaCount: item.delistedArkaCount,
    totalNav: item.totalNav,
    totalNavUsdEstimate: item.totalNavUsdEstimate ?? null,
    syncedAt: item.syncedAt,
    navSharePct: totalNav !== null && totalNav > BigInt(0) && item.totalNavUsdEstimate !== null && item.totalNavUsdEstimate !== undefined
      ? computeSpotlightWidthByShare(item.totalNavUsdEstimate, totalNav.toString())
      : null,
  }));
}

export function buildAssetSpotlightCards(
  page: Page<RankedAssetCatalogEntry>,
  limit = page.items.length,
): AssetSpotlightCard[] {
  const totalValue = sumCompleteUsdValues(
    page.items.map((item) => item.netManagedUsdEstimate),
  );

  return page.items.slice(0, limit).map((item) => ({
    assetContract: item.assetContract,
    rank: item.rank,
    arkaCount: item.arkaCount,
    managerCount: item.managerCount,
    denominationArkaCount: item.denominationArkaCount,
    netManagedAmount: item.netManagedAmount,
    netPositionValue: item.netPositionValue,
    netManagedUsdEstimate: item.netManagedUsdEstimate ?? null,
    liquidBalance: item.liquidBalance,
    debtAmount: item.debtAmount,
    syncedAt: item.syncedAt,
    managedSharePct:
      totalValue !== null && totalValue > BigInt(0) && item.netManagedUsdEstimate !== null && item.netManagedUsdEstimate !== undefined
        ? computeSpotlightWidthByShare(item.netManagedUsdEstimate, totalValue.toString())
        : 0,
  }));
}

export function buildAssetMarketMetrics(
  entry: RankedAssetCatalogEntry,
  history: Page<AssetHistoryPoint> | AssetHistoryPoint[] | null | undefined,
): AssetMarketMetrics {
  const managedAmount = toBigInt(entry.netManagedAmount);
  const netPosition = toBigInt(entry.netPositionValue);
  const priceProxyBps =
    managedAmount !== null && netPosition !== null && managedAmount > BigInt(0)
      ? Number((netPosition * BigInt(10_000)) / managedAmount)
      : null;
  const points = Array.isArray(history) ? history : (history?.items ?? []);
  const sortedPoints = [...points].sort(
    (left, right) =>
      new Date(left.syncedAt).getTime() - new Date(right.syncedAt).getTime(),
  );
  const current = sortedPoints[sortedPoints.length - 1];
  const previous = sortedPoints[sortedPoints.length - 2];
  const currentValue = current ? toBigInt(current.netPositionValue) : null;
  const previousValue = previous ? toBigInt(previous.netPositionValue) : null;

  if (
    currentValue === null ||
    previousValue === null ||
    previousValue <= BigInt(0)
  ) {
    return {
      priceProxyBps,
      movementBps: null,
      movementTone: "neutral",
      movementSource: "insufficient_history",
    };
  }

  const movementBps = Number(
    ((currentValue - previousValue) * BigInt(10_000)) / previousValue,
  );

  return {
    priceProxyBps,
    movementBps,
    movementTone:
      movementBps > 0 ? "positive" : movementBps < 0 ? "warning" : "neutral",
    movementSource: "history",
  };
}

function resolveSearchPosition(value: string, query: string): number {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return Number.MAX_SAFE_INTEGER;
  }
  const position = value.toLowerCase().indexOf(normalizedQuery);
  return position >= 0 ? position : Number.MAX_SAFE_INTEGER;
}

export function sortManagersForSpotlight(
  items: RankedManagerCatalogEntry[],
  mode: ManagerSpotlightMode,
  search: string,
): RankedManagerCatalogEntry[] {
  const ranked = [...items];
  if (mode === "curated") {
    return ranked.sort((left, right) => {
      if (right.curatedArkaCount !== left.curatedArkaCount) {
        return right.curatedArkaCount - left.curatedArkaCount;
      }
      const leftNav = BigInt(left.totalNav);
      const rightNav = BigInt(right.totalNav);
      if (leftNav !== rightNav) {
        return rightNav > leftNav ? 1 : -1;
      }
      return left.rank - right.rank;
    });
  }

  if (mode === "search") {
    const normalizedSearch = search.trim();
    if (!normalizedSearch) {
      return ranked;
    }

    return ranked.sort((left, right) => {
      const leftPosition = resolveSearchPosition(left.manager, normalizedSearch);
      const rightPosition = resolveSearchPosition(right.manager, normalizedSearch);
      if (leftPosition !== rightPosition) {
        return leftPosition - rightPosition;
      }
      return left.rank - right.rank;
    });
  }

  return ranked;
}

export function sortAssetsForSpotlight(
  items: RankedAssetCatalogEntry[],
  mode: AssetSpotlightMode,
  search: string,
): RankedAssetCatalogEntry[] {
  const ranked = [...items];
  if (mode === "balanceSheet") {
    return ranked.sort((left, right) => {
      const leftBalanceSheet = BigInt(left.collateralAmount) + BigInt(left.debtAmount);
      const rightBalanceSheet = BigInt(right.collateralAmount) + BigInt(right.debtAmount);
      if (leftBalanceSheet !== rightBalanceSheet) {
        return rightBalanceSheet > leftBalanceSheet ? 1 : -1;
      }
      const leftManaged = BigInt(left.netManagedAmount);
      const rightManaged = BigInt(right.netManagedAmount);
      if (leftManaged !== rightManaged) {
        return rightManaged > leftManaged ? 1 : -1;
      }
      return left.rank - right.rank;
    });
  }

  if (mode === "search") {
    const normalizedSearch = search.trim();
    if (!normalizedSearch) {
      return ranked;
    }

    return ranked.sort((left, right) => {
      const leftPosition = resolveSearchPosition(left.assetContract, normalizedSearch);
      const rightPosition = resolveSearchPosition(right.assetContract, normalizedSearch);
      if (leftPosition !== rightPosition) {
        return leftPosition - rightPosition;
      }
      return left.rank - right.rank;
    });
  }

  return ranked.sort((left, right) => {
    const leftValue = toBigInt(left.netManagedUsdEstimate ?? "");
    const rightValue = toBigInt(right.netManagedUsdEstimate ?? "");
    if (leftValue === null || rightValue === null) {
      if (leftValue !== null) return -1;
      if (rightValue !== null) return 1;
      return left.rank - right.rank;
    }
    if (leftValue !== rightValue) {
      return rightValue > leftValue ? 1 : -1;
    }
    return left.rank - right.rank;
  });
}

export function buildManagerTelemetrySignals(
  page: Page<RankedManagerCatalogEntry>,
  options: { search: string },
): ExplorerTelemetrySignal[] {
  const totalNav = sumCompleteUsdValues(
    page.items.map((item) => item.totalNavUsdEstimate),
  );
  const leader = page.items[0] ?? null;
  const leadShare = leader && totalNav !== null && leader.totalNavUsdEstimate !== null && leader.totalNavUsdEstimate !== undefined
    ? `${((computeShareBps(leader.totalNavUsdEstimate, totalNav.toString()) ?? 0) / 100).toFixed(2)}%`
    : "Valuation unavailable";

  return [
    {
      id: "indexed",
      label: "Managers",
      value: String(page.total),
      detail: "current ranked manager set",
    },
    {
      id: "concentration",
      label: "Lead concentration",
      value: leadShare,
      detail: leader ? "share of current TVL held by the leader" : "waiting for data",
    },
    {
      id: "scope",
      label: "Search posture",
      value: options.search ? "Focused" : "Full set",
      detail: options.search ? `filtered around ${options.search}` : "showing full ranked manager set",
    },
  ];
}

export function buildAssetTelemetrySignals(
  page: Page<RankedAssetCatalogEntry>,
  options: { search: string },
): ExplorerTelemetrySignal[] {
  const totalValue = sumCompleteUsdValues(
    page.items.map((item) => item.netManagedUsdEstimate),
  );
  const leader = sortAssetsForSpotlight(page.items, "core", "")[0] ?? null;
  const leadShare = leader && totalValue !== null && leader.netManagedUsdEstimate !== null && leader.netManagedUsdEstimate !== undefined
    ? `${((computeShareBps(leader.netManagedUsdEstimate, totalValue.toString()) ?? 0) / 100).toFixed(2)}%`
    : "Valuation unavailable";

  return [
    {
      id: "indexed",
      label: "Assets",
      value: String(page.total),
      detail: "current ranked exposure set",
    },
    {
      id: "concentration",
      label: "Lead concentration",
      value: leadShare,
      detail: leader ? "share of current value held by the asset leader" : "waiting for data",
    },
    {
      id: "scope",
      label: "Search posture",
      value: options.search ? "Focused" : "Full set",
      detail: options.search ? `filtered around ${options.search}` : "showing full ranked asset set",
    },
  ];
}

export function buildAssetPublicMetricTiles(
  page: Page<RankedAssetCatalogEntry>,
  options: { search: string },
): AssetPublicMetricTile[] {
  const leader = sortAssetsForSpotlight(page.items, "core", "")[0] ?? null;
  const totalValue = sumCompleteUsdValues(
    page.items.map((item) => item.netManagedUsdEstimate),
  );
  const collateralLinkedCount = page.items.filter(
    (item) => BigInt(item.collateralAmount) > BigInt(0),
  ).length;
  const debtLinkedCount = page.items.filter(
    (item) => BigInt(item.debtAmount) > BigInt(0),
  ).length;
  const cleanCount = page.items.length - debtLinkedCount;
  const query = options.search.trim();

  return [
    {
      id: "indexed",
      label: "Assets",
      value: String(page.total),
      valueKind: "integer",
      detail: `${page.items.length} assets available.`,
      tone: "default",
    },
    {
      id: "footprint",
      label: "TVL",
      value: totalValue?.toString() ?? "Valuation unavailable",
      valueKind: totalValue === null ? "text" : "amount",
      detail: totalValue === null
        ? "USD pricing is unavailable for one or more visible assets."
        : "Total USD value across these assets.",
      tone: "positive",
    },
    {
      id: "leader",
      label: "Largest exposure",
      value: leader?.assetContract ?? "None",
      valueKind: leader ? "asset" : "text",
      detail: leader
        ? "Asset with the largest current value contribution."
        : "No asset exposure is available.",
      tone: leader ? "positive" : "warning",
    },
    {
      id: "leadShare",
      label: "Largest exposure value",
      value: leader?.netManagedUsdEstimate ?? "Valuation unavailable",
      valueKind: leader?.netManagedUsdEstimate === null || leader?.netManagedUsdEstimate === undefined
        ? "text"
        : "amount",
      detail: leader
        ? `${leader.arkaCount} Arkas and ${leader.managerCount} managers contribute to this asset.`
        : "No exposure value is available.",
      tone: "default",
    },
    {
      id: "balanceSheet",
      label: "Collateral",
      value: `${collateralLinkedCount}/${page.items.length}`,
      valueKind: "text",
      detail: "Assets with current collateral exposure.",
      tone: collateralLinkedCount > 0 ? "warning" : "positive",
    },
    {
      id: "debtLinked",
      label: "Debt exposure",
      value: `${debtLinkedCount}/${page.items.length}`,
      valueKind: "text",
      detail: `${cleanCount} assets currently show no debt exposure.`,
      tone: debtLinkedCount > 0 ? "warning" : "positive",
    },
    {
      id: "scope",
      label: "Search scope",
      value: query ? "Focused" : "Full set",
      valueKind: "text",
      detail: query
        ? `Filtered around "${query}" without changing the ranked asset set.`
        : "Full ranked exposure set.",
      tone: query ? "warning" : "default",
    },
  ];
}
