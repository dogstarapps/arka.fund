import test from "node:test";
import assert from "node:assert/strict";
import { createSnapshotGraphqlMirrorServer } from "../../src/graphqlMirror.js";
import type { CatalogSnapshot } from "../../src/types.js";

const snapshot: CatalogSnapshot = {
  schemaVersion: 1,
  syncedAt: "2026-03-29T13:10:00.000Z",
  metrics: {
    totalArkas: 2,
    indexedArkas: 2,
    failedArkas: 0,
    totalManagers: 2,
    curatedArkas: 1,
    delistedArkas: 0,
    totalAssets: 1,
    totalNav: "3000",
    syncedAt: "2026-03-29T13:10:00.000Z",
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
      assets: [],
      syncedAt: "2026-03-29T13:10:00.000Z",
    },
    {
      arkaId: "CARKA2",
      manager: "GMANAGER2",
      curated: false,
      delisted: false,
      nav: "500",
      denominationContract: "CDENOM",
      whitelistContracts: ["CDENOM"],
      shareToken: null,
      fees: { mgmtBps: 0, perfBps: 0, depositBps: 0, redeemBps: 0 },
      assets: [],
      syncedAt: "2026-03-29T13:10:00.000Z",
    },
  ],
  assets: [],
  managers: [],
  failures: [],
};

test("snapshot GraphQL mirror paginates and enforces bearer auth", async () => {
  const server = await createSnapshotGraphqlMirrorServer({
    snapshot,
    profile: "generic",
    bearerToken: "top-secret",
  });

  try {
    const unauthorized = await fetch(server.url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "query", variables: { first: 1, skip: 0 } }),
    });
    assert.equal(unauthorized.status, 401);

    const authorized = await fetch(server.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer top-secret",
      },
      body: JSON.stringify({ query: "query", variables: { first: 1, skip: 1 } }),
    });
    assert.equal(authorized.status, 200);
    const payload = await authorized.json();
    assert.equal(payload.data.arkas.length, 1);
    assert.equal(payload.data.arkas[0].arkaId, "CARKA2");
  } finally {
    await server.close();
  }
});

test("snapshot GraphQL mirror emits a SubQuery-compatible connection", async () => {
  const server = await createSnapshotGraphqlMirrorServer({
    snapshot,
    profile: "subquery",
  });

  try {
    const response = await fetch(server.url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "query", variables: { first: 1, offset: 1 } }),
    });
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.data.arkas.totalCount, 2);
    assert.equal(payload.data.arkas.nodes.length, 1);
    assert.equal(payload.data.arkas.nodes[0].arkaId, "CARKA2");
    assert.equal(payload.data.arkas.nodes[0].assets.totalCount, 0);
  } finally {
    await server.close();
  }
});
