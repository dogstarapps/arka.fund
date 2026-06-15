import test from "node:test";
import assert from "node:assert/strict";
import { compareCatalogSnapshots } from "../../src/parity.js";
import { projectSnapshotGraphqlPayload } from "../../src/graphqlMirror.js";
import type { CatalogSnapshot } from "../../src/types.js";

const snapshot: CatalogSnapshot = {
  schemaVersion: 1,
  syncedAt: "2026-03-29T13:00:00.000Z",
  metrics: {
    totalArkas: 1,
    indexedArkas: 1,
    failedArkas: 0,
    totalManagers: 1,
    curatedArkas: 1,
    delistedArkas: 0,
    totalAssets: 1,
    totalNav: "2500",
    syncedAt: "2026-03-29T13:00:00.000Z",
  },
  arkas: [
    {
      arkaId: "CARKA1",
      manager: "GMANAGER1",
      curated: true,
      delisted: false,
      nav: "2500",
      denominationContract: "CDENOM",
      whitelistContracts: ["CDENOM"],
      shareToken: null,
      fees: { mgmtBps: 100, perfBps: 1200, depositBps: 10, redeemBps: 5 },
      assets: [
        {
          assetContract: "CDENOM",
          isDenomination: true,
          liquidBalance: "2500",
          collateralAmount: "0",
          debtAmount: "0",
          netManagedAmount: "2500",
          netPositionValue: "0",
          marketIds: [],
          syncedAt: "2026-03-29T13:00:00.000Z",
        },
      ],
      syncedAt: "2026-03-29T13:00:00.000Z",
    },
  ],
  assets: [
    {
      assetContract: "CDENOM",
      arkaCount: 1,
      managerCount: 1,
      denominationArkaCount: 1,
      liquidBalance: "2500",
      collateralAmount: "0",
      debtAmount: "0",
      netManagedAmount: "2500",
      netPositionValue: "0",
      syncedAt: "2026-03-29T13:00:00.000Z",
    },
  ],
  managers: [
    {
      manager: "GMANAGER1",
      arkaCount: 1,
      curatedArkaCount: 1,
      delistedArkaCount: 0,
      totalNav: "2500",
      syncedAt: "2026-03-29T13:00:00.000Z",
    },
  ],
  failures: [],
};

test("projectSnapshotGraphqlPayload paginates arkas", () => {
  const payload = projectSnapshotGraphqlPayload(snapshot, {
    variables: { first: 1, skip: 0 },
  });
  assert.ok(Array.isArray(payload.arkas));
  assert.equal(payload.arkas.length, 1);
  assert.deepEqual((payload.arkas[0] as { arkaId: string }).arkaId, "CARKA1");
});

test("projectSnapshotGraphqlPayload emits SubQuery-compatible connections", () => {
  const payload = projectSnapshotGraphqlPayload(
    snapshot,
    {
      variables: { first: 1, offset: 0 },
    },
    "subquery",
  );
  assert.deepEqual(payload.arkas, {
    totalCount: 1,
    nodes: [
      {
        ...snapshot.arkas[0],
        assets: {
          totalCount: 1,
          nodes: snapshot.arkas[0].assets,
        },
      },
    ],
  });
});

test("compareCatalogSnapshots reports equality for matching snapshots", () => {
  const result = compareCatalogSnapshots(snapshot, structuredClone(snapshot));
  assert.equal(result.equal, true);
  assert.deepEqual(result.differences, []);
});

test("compareCatalogSnapshots reports differences for mismatched snapshots", () => {
  const actual = structuredClone(snapshot);
  actual.arkas[0].nav = "2600";
  const result = compareCatalogSnapshots(snapshot, actual);
  assert.equal(result.equal, false);
  assert.deepEqual(result.differences, ["arkas mismatch"]);
});
