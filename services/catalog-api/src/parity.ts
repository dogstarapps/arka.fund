import type {
  ArkaAssetExposure,
  ArkaCatalogEntry,
  CatalogSnapshot,
  FeeSummary,
} from "./types.js";

export interface SnapshotParityReport {
  equal: boolean;
  differences: string[];
}

export function compareCatalogSnapshots(
  expected: CatalogSnapshot,
  actual: CatalogSnapshot,
): SnapshotParityReport {
  const differences: string[] = [];
  compareJson("metrics", normalizeMetrics(expected), normalizeMetrics(actual), differences);
  compareJson("arkas", normalizeArkas(expected.arkas), normalizeArkas(actual.arkas), differences);
  compareJson("assets", normalizeAssets(expected), normalizeAssets(actual), differences);
  compareJson("managers", normalizeManagers(expected), normalizeManagers(actual), differences);
  compareJson("failures", expected.failures, actual.failures, differences);
  return {
    equal: differences.length === 0,
    differences,
  };
}

export function normalizeCatalogSnapshotForParity(snapshot: CatalogSnapshot) {
  return {
    metrics: normalizeMetrics(snapshot),
    arkas: normalizeArkas(snapshot.arkas),
    assets: normalizeAssets(snapshot),
    managers: normalizeManagers(snapshot),
    failures: snapshot.failures,
  };
}

function normalizeMetrics(snapshot: CatalogSnapshot) {
  return {
    totalArkas: snapshot.metrics.totalArkas,
    indexedArkas: snapshot.metrics.indexedArkas,
    failedArkas: snapshot.metrics.failedArkas,
    totalManagers: snapshot.metrics.totalManagers,
    curatedArkas: snapshot.metrics.curatedArkas,
    delistedArkas: snapshot.metrics.delistedArkas,
    totalAssets: snapshot.metrics.totalAssets,
    totalNav: snapshot.metrics.totalNav,
  };
}

function normalizeArkas(arkas: ArkaCatalogEntry[]) {
  return [...arkas]
    .map((arka) => ({
      arkaId: arka.arkaId,
      manager: arka.manager,
      curated: arka.curated,
      delisted: arka.delisted,
      nav: arka.nav,
      denominationContract: arka.denominationContract,
      whitelistContracts: [...arka.whitelistContracts].sort(),
      shareToken: arka.shareToken,
      fees: normalizeFees(arka.fees),
      assets: normalizeAssetExposures(arka.assets),
    }))
    .sort((left, right) => left.arkaId.localeCompare(right.arkaId));
}

function normalizeFees(fees: FeeSummary) {
  return {
    mgmtBps: fees.mgmtBps,
    perfBps: fees.perfBps,
    depositBps: fees.depositBps,
    redeemBps: fees.redeemBps,
  };
}

function normalizeAssetExposures(assets: ArkaAssetExposure[]) {
  return [...assets]
    .map((asset) => ({
      assetContract: asset.assetContract,
      isDenomination: asset.isDenomination,
      liquidBalance: asset.liquidBalance,
      collateralAmount: asset.collateralAmount,
      debtAmount: asset.debtAmount,
      netManagedAmount: asset.netManagedAmount,
      netPositionValue: asset.netPositionValue,
      marketIds: [...asset.marketIds].sort(),
    }))
    .sort((left, right) => left.assetContract.localeCompare(right.assetContract));
}

function normalizeAssets(snapshot: CatalogSnapshot) {
  return [...snapshot.assets]
    .map((asset) => ({
      assetContract: asset.assetContract,
      arkaCount: asset.arkaCount,
      managerCount: asset.managerCount,
      denominationArkaCount: asset.denominationArkaCount,
      liquidBalance: asset.liquidBalance,
      collateralAmount: asset.collateralAmount,
      debtAmount: asset.debtAmount,
      netManagedAmount: asset.netManagedAmount,
      netPositionValue: asset.netPositionValue,
    }))
    .sort((left, right) => left.assetContract.localeCompare(right.assetContract));
}

function normalizeManagers(snapshot: CatalogSnapshot) {
  return [...snapshot.managers]
    .map((manager) => ({
      manager: manager.manager,
      arkaCount: manager.arkaCount,
      curatedArkaCount: manager.curatedArkaCount,
      delistedArkaCount: manager.delistedArkaCount,
      totalNav: manager.totalNav,
    }))
    .sort((left, right) => left.manager.localeCompare(right.manager));
}

function compareJson(
  label: string,
  expected: unknown,
  actual: unknown,
  differences: string[],
): void {
  const left = JSON.stringify(expected);
  const right = JSON.stringify(actual);
  if (left !== right) {
    differences.push(`${label} mismatch`);
  }
}
