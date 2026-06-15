import test from "node:test";
import assert from "node:assert/strict";
import {
  appendSnapshotToHistory,
  buildSnapshot,
  createEmptyHistoryArchive,
  findArka,
  findAsset,
  findManager,
  getArkaAssetHistory,
  getArkaHistory,
  getAssetHistory,
  getManagerHistory,
  listAssetArkas,
  listArkas,
  listAssets,
  listHistoryRuns,
  listManagerArkas,
  listManagers,
} from "../../src/index.js";
import type { ArkaCatalogEntry } from "../../src/index.js";

const tokenContract = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const altTokenContract = "CFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF";

function fixtureArkas(): ArkaCatalogEntry[] {
  return [
    {
      arkaId: "CBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
      manager: "GCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC",
      curated: true,
      delisted: false,
      nav: "2000",
      denominationContract: tokenContract,
      whitelistContracts: [tokenContract, altTokenContract],
      shareToken: null,
      fees: { mgmtBps: 0, perfBps: 0, depositBps: 0, redeemBps: 0 },
      assets: [
        {
          assetContract: tokenContract,
          isDenomination: true,
          liquidBalance: "1800",
          collateralAmount: "200",
          debtAmount: "0",
          netManagedAmount: "2000",
          netPositionValue: "200",
          marketIds: ["101"],
          syncedAt: "2026-03-27T10:00:00.000Z",
        },
        {
          assetContract: altTokenContract,
          isDenomination: false,
          liquidBalance: "0",
          collateralAmount: "50",
          debtAmount: "10",
          netManagedAmount: "40",
          netPositionValue: "30",
          marketIds: ["101"],
          syncedAt: "2026-03-27T10:00:00.000Z",
        },
      ],
      syncedAt: "2026-03-27T10:00:00.000Z",
    },
    {
      arkaId: "CDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD",
      manager: "GEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE",
      curated: false,
      delisted: false,
      nav: "500",
      denominationContract: tokenContract,
      whitelistContracts: [tokenContract],
      shareToken: null,
      fees: { mgmtBps: 10, perfBps: 20, depositBps: 30, redeemBps: 40 },
      assets: [
        {
          assetContract: tokenContract,
          isDenomination: true,
          liquidBalance: "500",
          collateralAmount: "0",
          debtAmount: "0",
          netManagedAmount: "500",
          netPositionValue: "0",
          marketIds: [],
          syncedAt: "2026-03-27T10:00:00.000Z",
        },
      ],
      syncedAt: "2026-03-27T10:00:00.000Z",
    },
  ];
}

test("buildSnapshot aggregates metrics, managers, and assets", () => {
  const snapshot = buildSnapshot(fixtureArkas(), [], "2026-03-27T10:00:00.000Z");
  assert.equal(snapshot.metrics.totalArkas, 2);
  assert.equal(snapshot.metrics.totalManagers, 2);
  assert.equal(snapshot.metrics.totalAssets, 2);
  assert.equal(snapshot.metrics.totalNav, "2500");
  assert.equal(snapshot.managers[0]?.totalNav, "2000");
  assert.equal(snapshot.assets[0]?.assetContract, tokenContract);
  assert.equal(snapshot.assets[0]?.netManagedAmount, "2500");
});

test("listArkas sorts by nav and applies ranking", () => {
  const snapshot = buildSnapshot(fixtureArkas(), [], "2026-03-27T10:00:00.000Z");
  const page = listArkas(snapshot, { sort: "nav", order: "desc" });
  assert.equal(page.items[0]?.arkaId, fixtureArkas()[0]?.arkaId);
  assert.equal(page.items[0]?.rank, 1);
  assert.equal(page.items[1]?.rank, 2);
});

test("listAssets supports ranking and search", () => {
  const snapshot = buildSnapshot(fixtureArkas(), [], "2026-03-27T10:00:00.000Z");
  const page = listAssets(snapshot, {
    sort: "netManagedAmount",
    order: "desc",
    search: tokenContract.slice(0, 12),
  });
  assert.equal(page.total, 1);
  assert.equal(page.items[0]?.assetContract, tokenContract);
  assert.equal(page.items[0]?.rank, 1);
});

test("listManagers supports searching and manager ranking", () => {
  const snapshot = buildSnapshot(fixtureArkas(), [], "2026-03-27T10:00:00.000Z");
  const page = listManagers(snapshot, {
    search: "GCCCC",
    sort: "totalNav",
    order: "desc",
  });
  assert.equal(page.total, 1);
  assert.equal(page.items[0]?.manager, fixtureArkas()[0]?.manager);
  assert.equal(page.items[0]?.rank, 1);
});

test("manager and asset relationship listings return ranked Arkas", () => {
  const snapshot = buildSnapshot(fixtureArkas(), [], "2026-03-27T10:00:00.000Z");

  const managerArkas = listManagerArkas(snapshot, fixtureArkas()[0].manager, {
    order: "desc",
    sort: "nav",
  });
  assert.equal(managerArkas.total, 1);
  assert.equal(managerArkas.items[0]?.arkaId, fixtureArkas()[0].arkaId);
  assert.equal(managerArkas.items[0]?.rank, 1);

  const assetArkas = listAssetArkas(snapshot, tokenContract, {
    order: "desc",
    sort: "nav",
  });
  assert.equal(assetArkas.total, 2);
  assert.equal(assetArkas.items[0]?.arkaId, fixtureArkas()[0].arkaId);
  assert.equal(assetArkas.items[1]?.arkaId, fixtureArkas()[1].arkaId);
});

test("find helpers return null when the item does not exist", () => {
  const snapshot = buildSnapshot(fixtureArkas(), [], "2026-03-27T10:00:00.000Z");
  assert.equal(findArka(snapshot, "CFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"), null);
  assert.equal(findAsset(snapshot, "CGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG"), null);
  assert.equal(findManager(snapshot, "GFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"), null);
});

test("history helpers expose ordered series for Arka, asset, and manager views", () => {
  const first = buildSnapshot(fixtureArkas(), [], "2026-03-27T10:00:00.000Z");
  const second = buildSnapshot(
    [
      {
        ...fixtureArkas()[0],
        nav: "2500",
        assets: fixtureArkas()[0].assets.map((asset) =>
          asset.assetContract === tokenContract
            ? { ...asset, liquidBalance: "2300", netManagedAmount: "2500" }
            : asset,
        ),
        syncedAt: "2026-03-27T11:00:00.000Z",
      },
      {
        ...fixtureArkas()[1],
        nav: "900",
        assets: fixtureArkas()[1].assets.map((asset) => ({
          ...asset,
          liquidBalance: "900",
          netManagedAmount: "900",
          syncedAt: "2026-03-27T11:00:00.000Z",
        })),
        syncedAt: "2026-03-27T11:00:00.000Z",
      },
    ],
    [],
    "2026-03-27T11:00:00.000Z",
  );
  const archive = appendSnapshotToHistory(
    appendSnapshotToHistory(createEmptyHistoryArchive(10), first),
    second,
  );

  const runs = listHistoryRuns(archive, { order: "asc" });
  assert.equal(runs.total, 2);

  const arkaHistory = getArkaHistory(archive, fixtureArkas()[1].arkaId, { order: "asc" });
  assert.deepEqual(
    arkaHistory.items.map((point) => point.nav),
    ["500", "900"],
  );

  const assetHistory = getAssetHistory(archive, tokenContract, { order: "asc" });
  assert.deepEqual(
    assetHistory.items.map((point) => point.netManagedAmount),
    ["2500", "3400"],
  );

  const arkaAssetHistory = getArkaAssetHistory(
    archive,
    fixtureArkas()[1].arkaId,
    tokenContract,
    { order: "asc" },
  );
  assert.deepEqual(
    arkaAssetHistory.items.map((point) => point.netManagedAmount),
    ["500", "900"],
  );

  const managerHistory = getManagerHistory(archive, fixtureArkas()[0].manager, {
    order: "asc",
  });
  assert.deepEqual(
    managerHistory.items.map((point) => point.totalNav),
    ["2000", "2500"],
  );
});
