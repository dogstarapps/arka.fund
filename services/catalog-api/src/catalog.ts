import type {
  ArkaAssetExposure,
  ArkaAssetHistoryPoint,
  ArkaCatalogEntry,
  ArkaHistoryPoint,
  ArkaQuery,
  AssetCatalogEntry,
  AssetHistoryPoint,
  AssetQuery,
  CatalogHistoryArchive,
  CatalogMetrics,
  CatalogAssetPrice,
  CatalogSnapshot,
  CatalogSyncFailure,
  HistoryQuery,
  ManagerCatalogEntry,
  ManagerHistoryPoint,
  ManagerQuery,
  Page,
  RankedArkaCatalogEntry,
  RankedAssetCatalogEntry,
  RankedManagerCatalogEntry,
} from "./types.js";
import { enrichArkaEconomics, resolveAssetIdentity } from "./economics.js";

const CURRENT_SNAPSHOT_SCHEMA_VERSION = 3;

export function buildSnapshot(
  arkas: ArkaCatalogEntry[],
  failures: CatalogSyncFailure[],
  syncedAt: string,
  assetPrices: readonly CatalogAssetPrice[] = [],
): CatalogSnapshot {
  const pricesByAsset = new Map(
    assetPrices.map((price) => [price.assetContract.trim().toUpperCase(), price]),
  );
  const sortedArkas = [...arkas]
    .sort(compareArkasByNavDesc)
    .map((entry) => enrichArkaEconomics(entry, { assetPrices: pricesByAsset }));
  const assets = aggregateAssets(sortedArkas, syncedAt, pricesByAsset);
  const managers = aggregateManagers(sortedArkas, syncedAt);
  const metrics = buildMetrics(sortedArkas, assets.length, failures, managers.length, syncedAt);
  return {
    schemaVersion: CURRENT_SNAPSHOT_SCHEMA_VERSION,
    syncedAt,
    metrics,
    arkas: sortedArkas,
    assets,
    managers,
    assetPrices: [...assetPrices].sort((left, right) =>
      left.assetContract.localeCompare(right.assetContract)),
    failures: [...failures].sort((left, right) => left.arkaId.localeCompare(right.arkaId)),
  };
}

export function aggregateAssets(
  arkas: ArkaCatalogEntry[],
  syncedAt: string,
  pricesByAsset: ReadonlyMap<string, CatalogAssetPrice> = new Map(),
): AssetCatalogEntry[] {
  const grouped = new Map<string, {
    managers: Set<string>;
    entry: AssetCatalogEntry;
  }>();

  for (const arka of arkas) {
    for (const asset of arka.assets) {
      const current = grouped.get(asset.assetContract) ?? {
        managers: new Set<string>(),
        entry: {
          assetContract: asset.assetContract,
          identity: resolveAssetIdentity(asset.assetContract),
          price: pricesByAsset.get(asset.assetContract.trim().toUpperCase()) ?? null,
          arkaCount: 0,
          managerCount: 0,
          denominationArkaCount: 0,
          liquidBalance: "0",
          collateralAmount: "0",
          debtAmount: "0",
          netManagedAmount: "0",
          netPositionValue: "0",
          syncedAt,
        },
      };
      current.entry.arkaCount += 1;
      current.entry.denominationArkaCount += asset.isDenomination ? 1 : 0;
      current.entry.liquidBalance = addBigIntStrings(
        current.entry.liquidBalance,
        asset.liquidBalance,
      );
      current.entry.collateralAmount = addBigIntStrings(
        current.entry.collateralAmount,
        asset.collateralAmount,
      );
      current.entry.debtAmount = addBigIntStrings(current.entry.debtAmount, asset.debtAmount);
      current.entry.netManagedAmount = addBigIntStrings(
        current.entry.netManagedAmount,
        asset.netManagedAmount,
      );
      current.entry.netPositionValue = addBigIntStrings(
        current.entry.netPositionValue,
        asset.netPositionValue,
      );
      current.managers.add(arka.manager);
      grouped.set(asset.assetContract, current);
    }
  }

  return [...grouped.values()]
    .map(({ entry, managers }) => ({
      ...entry,
      managerCount: managers.size,
    }))
    .sort(compareAssetsByNetManagedAmountDesc);
}

export function aggregateManagers(
  arkas: ArkaCatalogEntry[],
  syncedAt: string,
): ManagerCatalogEntry[] {
  const grouped = new Map<string, ManagerCatalogEntry>();
  for (const arka of arkas) {
    const current = grouped.get(arka.manager) ?? {
      manager: arka.manager,
      arkaCount: 0,
      curatedArkaCount: 0,
      delistedArkaCount: 0,
      totalNav: "0",
      syncedAt,
    };
    current.arkaCount += 1;
    current.curatedArkaCount += arka.curated ? 1 : 0;
    current.delistedArkaCount += arka.delisted ? 1 : 0;
    current.totalNav = addBigIntStrings(current.totalNav, arka.nav);
    grouped.set(arka.manager, current);
  }

  return [...grouped.values()].sort(compareManagersByNavDesc);
}

export function buildMetrics(
  arkas: ArkaCatalogEntry[],
  totalAssets: number,
  failures: CatalogSyncFailure[],
  totalManagers: number,
  syncedAt: string,
): CatalogMetrics {
  const totalNav = arkas.reduce((accumulator, arka) => accumulator + BigInt(arka.nav), 0n);
  return {
    totalArkas: arkas.length + failures.length,
    indexedArkas: arkas.length,
    failedArkas: failures.length,
    totalManagers,
    curatedArkas: arkas.filter((arka) => arka.curated).length,
    delistedArkas: arkas.filter((arka) => arka.delisted).length,
    totalAssets,
    totalNav: totalNav.toString(),
    syncedAt,
  };
}

export function listArkas(
  snapshot: CatalogSnapshot,
  query: ArkaQuery = {},
  matchesSearch?: (entry: ArkaCatalogEntry, search: string) => boolean,
): Page<RankedArkaCatalogEntry> {
  return rankAndPaginateArkas(filterArkas(snapshot.arkas, query, matchesSearch), query);
}

export function listManagerArkas(
  snapshot: CatalogSnapshot,
  managerId: string,
  query: ArkaQuery = {},
  matchesSearch?: (entry: ArkaCatalogEntry, search: string) => boolean,
): Page<RankedArkaCatalogEntry> {
  return rankAndPaginateArkas(
    filterArkas(snapshot.arkas, query, matchesSearch).filter((arka) => arka.manager === managerId),
    query,
  );
}

export function listAssetArkas(
  snapshot: CatalogSnapshot,
  assetContract: string,
  query: ArkaQuery = {},
  matchesSearch?: (entry: ArkaCatalogEntry, search: string) => boolean,
): Page<RankedArkaCatalogEntry> {
  return rankAndPaginateArkas(
    filterArkas(snapshot.arkas, query, matchesSearch).filter((arka) =>
      arka.assets.some((asset) => asset.assetContract === assetContract),
    ),
    query,
  );
}

export function listAssets(
  snapshot: CatalogSnapshot,
  query: AssetQuery = {},
): Page<RankedAssetCatalogEntry> {
  const filtered = snapshot.assets.filter((asset) => {
    if (query.search) {
      const search = query.search.toLowerCase();
      return [asset.assetContract, asset.identity?.symbol, asset.identity?.label]
        .filter((value): value is string => Boolean(value))
        .some((value) => value.toLowerCase().includes(search));
    }
    return true;
  });

  const sorted = [...filtered].sort((left, right) =>
    compareAssetEntries(
      left,
      right,
      query.sort ?? "netManagedAmount",
      query.order ?? "desc",
    ),
  );

  return paginate(
    sorted.map((asset, index) => ({ ...asset, rank: index + 1 })),
    query.offset ?? 0,
    query.limit ?? 25,
  );
}

export function listManagers(
  snapshot: CatalogSnapshot,
  query: ManagerQuery = {},
  matchesSearch?: (entry: ManagerCatalogEntry, search: string) => boolean,
): Page<RankedManagerCatalogEntry> {
  const filtered = snapshot.managers.filter((manager) => {
    if (query.search) {
      return matchesSearch
        ? matchesSearch(manager, query.search)
        : manager.manager.toLowerCase().includes(query.search.toLowerCase());
    }
    return true;
  });

  const sorted = [...filtered].sort((left, right) =>
    compareManagerEntries(left, right, query.sort ?? "totalNav", query.order ?? "desc"),
  );
  return paginate(
    sorted.map((manager, index) => ({ ...manager, rank: index + 1 })),
    query.offset ?? 0,
    query.limit ?? 25,
  );
}

export function findArka(snapshot: CatalogSnapshot, arkaId: string): ArkaCatalogEntry | null {
  return snapshot.arkas.find((arka) => arka.arkaId === arkaId) ?? null;
}

export function findAsset(
  snapshot: CatalogSnapshot,
  assetContract: string,
): AssetCatalogEntry | null {
  return snapshot.assets.find((asset) => asset.assetContract === assetContract) ?? null;
}

export function findAssetPrice(
  snapshot: CatalogSnapshot,
  assetContract: string,
): CatalogAssetPrice | null {
  return snapshot.assetPrices?.find(
    (price) => price.assetContract === assetContract.trim().toUpperCase(),
  ) ?? null;
}

export function findManager(
  snapshot: CatalogSnapshot,
  managerId: string,
): ManagerCatalogEntry | null {
  return snapshot.managers.find((manager) => manager.manager === managerId) ?? null;
}

export function cloneSnapshot(snapshot: CatalogSnapshot): CatalogSnapshot {
  return structuredClone(snapshot);
}

export function createEmptyHistoryArchive(retentionLimit: number): CatalogHistoryArchive {
  return {
    schemaVersion: CURRENT_SNAPSHOT_SCHEMA_VERSION,
    retentionLimit,
    updatedAt: new Date(0).toISOString(),
    runs: [],
  };
}

export function appendSnapshotToHistory(
  archive: CatalogHistoryArchive,
  snapshot: CatalogSnapshot,
  retentionLimit = archive.retentionLimit,
): CatalogHistoryArchive {
  const dedupedRuns = archive.runs.filter((run) => run.syncedAt !== snapshot.syncedAt);
  dedupedRuns.push(cloneSnapshot(snapshot));
  dedupedRuns.sort((left, right) => left.syncedAt.localeCompare(right.syncedAt));
  const boundedRuns = dedupedRuns.slice(Math.max(0, dedupedRuns.length - retentionLimit));
  return {
    schemaVersion: CURRENT_SNAPSHOT_SCHEMA_VERSION,
    retentionLimit,
    updatedAt: snapshot.syncedAt,
    runs: boundedRuns,
  };
}

export function listHistoryRuns(
  archive: CatalogHistoryArchive,
  query: HistoryQuery = {},
): Page<CatalogSnapshot> {
  const filtered = filterRuns(archive.runs, query);
  const ordered = orderRuns(filtered, query.order ?? "asc");
  return paginate(
    ordered.map(cloneSnapshot),
    0,
    query.limit ?? (ordered.length || 25),
  );
}

export function getArkaHistory(
  archive: CatalogHistoryArchive,
  arkaId: string,
  query: HistoryQuery = {},
): Page<ArkaHistoryPoint> {
  const points: ArkaHistoryPoint[] = [];
  for (const run of orderRuns(filterRuns(archive.runs, query), query.order ?? "asc")) {
    const index = run.arkas.findIndex((arka) => arka.arkaId === arkaId);
    if (index === -1) {
      continue;
    }
    const arka = run.arkas[index];
    points.push({
      arkaId,
      syncedAt: run.syncedAt,
      nav: arka.nav,
      manager: arka.manager,
      curated: arka.curated,
      delisted: arka.delisted,
      shareToken: arka.shareToken,
      rank: index + 1,
    });
  }
  return paginate(points, 0, query.limit ?? (points.length || 25));
}

export function getAssetHistory(
  archive: CatalogHistoryArchive,
  assetContract: string,
  query: HistoryQuery = {},
): Page<AssetHistoryPoint> {
  const points: AssetHistoryPoint[] = [];
  for (const run of orderRuns(filterRuns(archive.runs, query), query.order ?? "asc")) {
    const index = run.assets.findIndex((asset) => asset.assetContract === assetContract);
    if (index === -1) {
      continue;
    }
    const asset = run.assets[index];
    points.push({
      assetContract,
      syncedAt: run.syncedAt,
      arkaCount: asset.arkaCount,
      managerCount: asset.managerCount,
      denominationArkaCount: asset.denominationArkaCount,
      liquidBalance: asset.liquidBalance,
      collateralAmount: asset.collateralAmount,
      debtAmount: asset.debtAmount,
      netManagedAmount: asset.netManagedAmount,
      netPositionValue: asset.netPositionValue,
      rank: index + 1,
    });
  }
  return paginate(points, 0, query.limit ?? (points.length || 25));
}

export function getArkaAssets(snapshot: CatalogSnapshot, arkaId: string): ArkaAssetExposure[] {
  const arka = findArka(snapshot, arkaId);
  if (!arka) {
    return [];
  }
  return [...arka.assets].sort(compareArkaAssetsByNetManagedAmountDesc);
}

export function getArkaAssetHistory(
  archive: CatalogHistoryArchive,
  arkaId: string,
  assetContract: string,
  query: HistoryQuery = {},
): Page<ArkaAssetHistoryPoint> {
  const points: ArkaAssetHistoryPoint[] = [];
  for (const run of orderRuns(filterRuns(archive.runs, query), query.order ?? "asc")) {
    const arka = run.arkas.find((entry) => entry.arkaId === arkaId);
    if (!arka) {
      continue;
    }
    const assets = [...arka.assets].sort(compareArkaAssetsByNetManagedAmountDesc);
    const index = assets.findIndex((asset) => asset.assetContract === assetContract);
    if (index === -1) {
      continue;
    }
    const asset = assets[index];
    points.push({
      arkaId,
      assetContract,
      syncedAt: run.syncedAt,
      isDenomination: asset.isDenomination,
      liquidBalance: asset.liquidBalance,
      collateralAmount: asset.collateralAmount,
      debtAmount: asset.debtAmount,
      netManagedAmount: asset.netManagedAmount,
      netPositionValue: asset.netPositionValue,
      rank: index + 1,
    });
  }
  return paginate(points, 0, query.limit ?? (points.length || 25));
}

export function getManagerHistory(
  archive: CatalogHistoryArchive,
  managerId: string,
  query: HistoryQuery = {},
): Page<ManagerHistoryPoint> {
  const points: ManagerHistoryPoint[] = [];
  for (const run of orderRuns(filterRuns(archive.runs, query), query.order ?? "asc")) {
    const index = run.managers.findIndex((manager) => manager.manager === managerId);
    if (index === -1) {
      continue;
    }
    const manager = run.managers[index];
    points.push({
      manager: managerId,
      syncedAt: run.syncedAt,
      totalNav: manager.totalNav,
      arkaCount: manager.arkaCount,
      curatedArkaCount: manager.curatedArkaCount,
      delistedArkaCount: manager.delistedArkaCount,
      rank: index + 1,
    });
  }
  return paginate(points, 0, query.limit ?? (points.length || 25));
}

function filterArkas(
  arkas: ArkaCatalogEntry[],
  query: ArkaQuery,
  matchesSearch?: (entry: ArkaCatalogEntry, search: string) => boolean,
): ArkaCatalogEntry[] {
  return arkas.filter((arka) => {
    if (query.curated !== undefined && arka.curated !== query.curated) {
      return false;
    }
    if (query.delisted !== undefined && arka.delisted !== query.delisted) {
      return false;
    }
    if (query.search) {
      const matches = matchesSearch
        ? matchesSearch(arka, query.search)
        : `${arka.arkaId} ${arka.manager}`.toLowerCase().includes(query.search.toLowerCase());
      if (!matches) {
        return false;
      }
    }
    return true;
  });
}

function rankAndPaginateArkas(
  arkas: ArkaCatalogEntry[],
  query: ArkaQuery,
): Page<RankedArkaCatalogEntry> {
  const sorted = [...arkas].sort((left, right) =>
    compareArkaEntries(left, right, query.sort ?? "nav", query.order ?? "desc"),
  );
  return paginate(
    sorted.map((arka, index) => ({ ...arka, rank: index + 1 })),
    query.offset ?? 0,
    query.limit ?? 25,
  );
}

function paginate<T>(items: T[], offset: number, limit: number): Page<T> {
  const safeOffset = clampNonNegative(offset);
  const safeLimit = clampPositive(limit);
  return {
    total: items.length,
    offset: safeOffset,
    limit: safeLimit,
    items: items.slice(safeOffset, safeOffset + safeLimit),
  };
}

function compareArkaEntries(
  left: ArkaCatalogEntry,
  right: ArkaCatalogEntry,
  sort: NonNullable<ArkaQuery["sort"]>,
  order: NonNullable<ArkaQuery["order"]>,
): number {
  const direction = order === "asc" ? 1 : -1;
  let comparison = 0;
  if (sort === "nav") {
    comparison = compareBigIntStrings(left.nav, right.nav);
  } else if (sort === "manager") {
    comparison = left.manager.localeCompare(right.manager);
  } else {
    comparison = left.syncedAt.localeCompare(right.syncedAt);
  }
  if (comparison !== 0) {
    return comparison * direction;
  }
  return left.arkaId.localeCompare(right.arkaId);
}

function compareAssetEntries(
  left: AssetCatalogEntry,
  right: AssetCatalogEntry,
  sort: NonNullable<AssetQuery["sort"]>,
  order: NonNullable<AssetQuery["order"]>,
): number {
  const direction = order === "asc" ? 1 : -1;
  let comparison = 0;
  if (sort === "netManagedAmount") {
    comparison = compareBigIntStrings(left.netManagedAmount, right.netManagedAmount);
  } else if (sort === "arkaCount") {
    comparison = left.arkaCount - right.arkaCount;
  } else {
    comparison = left.syncedAt.localeCompare(right.syncedAt);
  }
  if (comparison !== 0) {
    return comparison * direction;
  }
  return left.assetContract.localeCompare(right.assetContract);
}

function compareManagerEntries(
  left: ManagerCatalogEntry,
  right: ManagerCatalogEntry,
  sort: NonNullable<ManagerQuery["sort"]>,
  order: NonNullable<ManagerQuery["order"]>,
): number {
  const direction = order === "asc" ? 1 : -1;
  let comparison = 0;
  if (sort === "totalNav") {
    comparison = compareBigIntStrings(left.totalNav, right.totalNav);
  } else if (sort === "arkaCount") {
    comparison = left.arkaCount - right.arkaCount;
  } else {
    comparison = left.manager.localeCompare(right.manager);
  }
  if (comparison !== 0) {
    return comparison * direction;
  }
  return left.manager.localeCompare(right.manager);
}

function compareArkasByNavDesc(left: ArkaCatalogEntry, right: ArkaCatalogEntry): number {
  const comparison = compareBigIntStrings(left.nav, right.nav);
  if (comparison !== 0) {
    return comparison * -1;
  }
  return left.arkaId.localeCompare(right.arkaId);
}

function compareAssetsByNetManagedAmountDesc(
  left: AssetCatalogEntry,
  right: AssetCatalogEntry,
): number {
  const comparison = compareBigIntStrings(left.netManagedAmount, right.netManagedAmount);
  if (comparison !== 0) {
    return comparison * -1;
  }
  return left.assetContract.localeCompare(right.assetContract);
}

function compareArkaAssetsByNetManagedAmountDesc(
  left: ArkaAssetExposure,
  right: ArkaAssetExposure,
): number {
  const comparison = compareBigIntStrings(left.netManagedAmount, right.netManagedAmount);
  if (comparison !== 0) {
    return comparison * -1;
  }
  return left.assetContract.localeCompare(right.assetContract);
}

function compareManagersByNavDesc(
  left: ManagerCatalogEntry,
  right: ManagerCatalogEntry,
): number {
  const comparison = compareBigIntStrings(left.totalNav, right.totalNav);
  if (comparison !== 0) {
    return comparison * -1;
  }
  return left.manager.localeCompare(right.manager);
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

function clampNonNegative(value: number): number {
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

function clampPositive(value: number): number {
  return Number.isInteger(value) && value > 0 ? value : 25;
}

function filterRuns(runs: CatalogSnapshot[], query: HistoryQuery): CatalogSnapshot[] {
  return runs.filter((run) => {
    if (query.from && run.syncedAt < query.from) {
      return false;
    }
    if (query.to && run.syncedAt > query.to) {
      return false;
    }
    return true;
  });
}

function orderRuns(
  runs: CatalogSnapshot[],
  order: NonNullable<HistoryQuery["order"]>,
): CatalogSnapshot[] {
  const direction = order === "asc" ? 1 : -1;
  return [...runs].sort((left, right) => left.syncedAt.localeCompare(right.syncedAt) * direction);
}
