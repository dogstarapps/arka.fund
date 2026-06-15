import test from "node:test";
import assert from "node:assert/strict";
import { GraphqlCatalogSyncRunner } from "../../src/graphqlRunner.js";
import { startMockGraphqlServer } from "../support/mockGraphqlServer.js";

test("GraphqlCatalogSyncRunner paginates GraphQL catalog data into a snapshot", async () => {
  const syncedAt = "2026-03-29T12:30:00.000Z";
  const server = await startMockGraphqlServer([
    {
      id: "CARKA1",
      manager: "GMANAGER1",
      curated: true,
      delisted: false,
      nav: "2500",
      denominationContract: "CDENOM",
      whitelistContracts: ["CDENOM"],
      shareToken: null,
      syncedAt,
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
          syncedAt,
        },
      ],
    },
    {
      id: "CARKA2",
      manager: "GMANAGER2",
      curated: false,
      delisted: false,
      nav: "500",
      denominationContract: "CALT",
      whitelistContracts: ["CALT"],
      shareToken: null,
      syncedAt,
      fees: { mgmtBps: 0, perfBps: 0, depositBps: 0, redeemBps: 0 },
      assets: [],
    },
  ]);

  try {
    const runner = new GraphqlCatalogSyncRunner({
      graphqlUrl: server.url,
      pageSize: 1,
      headers: {
        authorization: "Bearer live-token",
      },
    });

    const snapshot = await runner.run();
    assert.equal(snapshot.metrics.totalArkas, 2);
    assert.equal(snapshot.metrics.indexedArkas, 2);
    assert.equal(snapshot.metrics.failedArkas, 0);
    assert.equal(snapshot.arkas[0].arkaId, "CARKA1");
    assert.equal(snapshot.arkas[1].manager, "GMANAGER2");
  } finally {
    await server.close();
  }
});

test("GraphqlCatalogSyncRunner supports the SubQuery profile", async () => {
  const syncedAt = "2026-03-29T12:30:00.000Z";
  const server = await startMockGraphqlServer(
    [
      {
        id: "CARKA1",
        manager: "GMANAGER1",
        curated: true,
        delisted: false,
        nav: "2500",
        denominationContract: "CDENOM",
        whitelistContracts: ["CDENOM"],
        shareToken: null,
        syncedAt,
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
            syncedAt,
          },
        ],
      },
    ],
    {
      profile: "subquery",
    },
  );

  try {
    const runner = new GraphqlCatalogSyncRunner({
      graphqlUrl: server.url,
      profile: "subquery",
      pageSize: 10,
    });

    const snapshot = await runner.run();
    assert.equal(snapshot.metrics.totalArkas, 1);
    assert.equal(snapshot.arkas[0].arkaId, "CARKA1");
    assert.equal(snapshot.arkas[0].assets[0].assetContract, "CDENOM");
  } finally {
    await server.close();
  }
});
