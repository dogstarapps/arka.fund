import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  CatalogService,
  createCatalogApp,
  FileCatalogHistoryStore,
  FileCatalogStore,
  GraphqlCatalogSyncRunner,
} from "../../src/index.js";
import { startMockGraphqlServer } from "../support/mockGraphqlServer.js";

test("catalog API serves product surfaces through the GraphQL ingestion backend", async () => {
  const syncedAt = "2026-03-29T12:45:00.000Z";
  const graphql = await startMockGraphqlServer([
    {
      id: "CARKA1",
      manager: "GMANAGER1",
      curated: true,
      delisted: false,
      nav: "2500",
      denominationContract: "CDENOM",
      whitelistContracts: ["CDENOM", "CALT"],
      shareToken: "CSHARE1",
      syncedAt,
      fees: { mgmtBps: 100, perfBps: 1200, depositBps: 10, redeemBps: 5 },
      assets: [
        {
          assetContract: "CDENOM",
          isDenomination: true,
          liquidBalance: "2000",
          collateralAmount: "0",
          debtAmount: "0",
          netManagedAmount: "2000",
          netPositionValue: "0",
          marketIds: [],
          syncedAt,
        },
        {
          assetContract: "CALT",
          isDenomination: false,
          liquidBalance: "500",
          collateralAmount: "0",
          debtAmount: "0",
          netManagedAmount: "500",
          netPositionValue: "0",
          marketIds: [],
          syncedAt,
        },
      ],
    },
  ]);

  const directory = await mkdtemp(join(tmpdir(), "catalog-api-graphql-"));
  const service = new CatalogService(
    new FileCatalogStore(join(directory, "snapshot.json")),
    new FileCatalogHistoryStore(join(directory, "history.json")),
    new GraphqlCatalogSyncRunner({
      graphqlUrl: graphql.url,
      pageSize: 50,
    }),
  );
  const app = createCatalogApp({ service, syncToken: "graphql-secret" });
  const address = await app.listen({ host: "127.0.0.1", port: 0 });

  try {
    const syncResponse = await fetch(`${address}/v1/sync`, {
      method: "POST",
      headers: { "x-arkafund-sync-token": "graphql-secret" },
    });
    assert.equal(syncResponse.status, 200);

    const arkas = await fetch(`${address}/v1/arkas?sort=nav&order=desc`).then((response) =>
      response.json(),
    );
    assert.equal(arkas.items.length, 1);
    assert.equal(arkas.items[0].arkaId, "CARKA1");
    assert.equal(arkas.items[0].nav, "2500");

    const dashboard = await fetch(`${address}/v1/dashboard/overview`).then((response) =>
      response.json(),
    );
    assert.equal(dashboard.totalNav, "2500");
    assert.equal(dashboard.totalAssets, 2);

    const portfolio = await fetch(`${address}/v1/arkas/CARKA1/portfolio`).then((response) =>
      response.json(),
    );
    assert.equal(portfolio.nav, "2500");
    assert.equal(portfolio.items[0].navContribution, "2000");
  } finally {
    await app.close();
    await graphql.close();
  }
});

test("catalog API serves product surfaces through the SubQuery-compatible backend", async () => {
  const syncedAt = "2026-03-29T12:45:00.000Z";
  const graphql = await startMockGraphqlServer(
    [
      {
        id: "CARKA1",
        manager: "GMANAGER1",
        curated: true,
        delisted: false,
        nav: "2500",
        denominationContract: "CDENOM",
        whitelistContracts: ["CDENOM", "CALT"],
        shareToken: "CSHARE1",
        syncedAt,
        fees: { mgmtBps: 100, perfBps: 1200, depositBps: 10, redeemBps: 5 },
        assets: [
          {
            assetContract: "CDENOM",
            isDenomination: true,
            liquidBalance: "2000",
            collateralAmount: "0",
            debtAmount: "0",
            netManagedAmount: "2000",
            netPositionValue: "0",
            marketIds: [],
            syncedAt,
          },
          {
            assetContract: "CALT",
            isDenomination: false,
            liquidBalance: "500",
            collateralAmount: "0",
            debtAmount: "0",
            netManagedAmount: "500",
            netPositionValue: "0",
            marketIds: [],
            syncedAt,
          },
        ],
      },
    ],
    { profile: "subquery" },
  );

  const directory = await mkdtemp(join(tmpdir(), "catalog-api-subquery-"));
  const service = new CatalogService(
    new FileCatalogStore(join(directory, "snapshot.json")),
    new FileCatalogHistoryStore(join(directory, "history.json")),
    new GraphqlCatalogSyncRunner({
      graphqlUrl: graphql.url,
      profile: "subquery",
      pageSize: 50,
    }),
  );
  const app = createCatalogApp({ service, syncToken: "graphql-secret" });
  const address = await app.listen({ host: "127.0.0.1", port: 0 });

  try {
    const syncResponse = await fetch(`${address}/v1/sync`, {
      method: "POST",
      headers: { "x-arkafund-sync-token": "graphql-secret" },
    });
    assert.equal(syncResponse.status, 200);

    const arkas = await fetch(`${address}/v1/arkas?sort=nav&order=desc`).then((response) =>
      response.json(),
    );
    assert.equal(arkas.items.length, 1);
    assert.equal(arkas.items[0].arkaId, "CARKA1");

    const dashboard = await fetch(`${address}/v1/dashboard/overview`).then((response) =>
      response.json(),
    );
    assert.equal(dashboard.totalNav, "2500");

    const portfolio = await fetch(`${address}/v1/arkas/CARKA1/portfolio`).then((response) =>
      response.json(),
    );
    assert.equal(portfolio.items.length, 2);
    assert.equal(portfolio.items[1].assetContract, "CALT");
  } finally {
    await app.close();
    await graphql.close();
  }
});
