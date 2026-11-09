import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildSnapshot, CatalogService, createCatalogApp, FileCatalogHistoryStore, FileCatalogStore, StaticCatalogSyncRunner } from "../../src/index.js";

test("unavailable NAV remains discoverable across HTTP, persistence, and portfolio/history", async () => {
  const arkaId = "CCP7X4UYFSUNXWRUH7W25RQMEQEHXFIYHNHVGAYAGGOOHPMPJKZGOGPW";
  const manager = "GCWBC4RHJBDQWIZ2747BLJ35U5P6JPNXFAGKYWRNLDOIEBUPQ4AWSXEO";
  const usdc = "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75";
  const syncedAt = new Date().toISOString();
  const snapshot = buildSnapshot([{
    arkaId, manager, curated:false, delisted:false, nav:null,
    navUnavailableReason:"nav_unavailable: BlendNavUnavailable",
    denominationContract:usdc, whitelistContracts:[usdc], shareToken:null,
    fees:{mgmtBps:0,perfBps:0,depositBps:0,redeemBps:0},
    assets:[{assetContract:usdc,isDenomination:true,liquidBalance:"10000000",collateralAmount:"0",debtAmount:"0",netManagedAmount:"10000000",netPositionValue:"0",marketIds:[],syncedAt}],syncedAt,
  }], [{arkaId,message:"nav_unavailable: BlendNavUnavailable",syncedAt}], syncedAt);
  const directory = await mkdtemp(join(tmpdir(), "arka-null-nav-http-"));
  const store = new FileCatalogStore(join(directory, "snapshot.json"));
  const service = new CatalogService(store, new FileCatalogHistoryStore(join(directory,"history.json")), new StaticCatalogSyncRunner(async () => snapshot));
  const app = createCatalogApp({service,syncToken:"test-only"});
  try {
    assert.equal((await app.inject({method:"POST",url:"/v1/sync",headers:{"x-arkafund-sync-token":"test-only"}})).statusCode,200);
    assert.equal((await store.read())?.arkas[0].nav,null);
    for (const url of ["/v1/arkas", `/v1/managers/${manager}/arkas`]) {
      const response = await app.inject({url});
      assert.equal(response.statusCode,200);
      assert.equal(response.json().items[0].arkaId,arkaId);
      assert.equal(response.json().items[0].nav,null);
    }
    for (const url of [`/v1/arkas/${arkaId}`,`/v1/arkas/${arkaId}/portfolio`]) {
      const response = await app.inject({url});
      assert.equal(response.statusCode,200);
      assert.equal(response.json().nav,null);
    }
    const detail = (await app.inject({url:`/v1/arkas/${arkaId}`})).json();
    assert.equal(detail.economics.navUsdEstimate,null);
    assert.equal(detail.assets[0].liquidBalance,"10000000");
    assert.equal((await app.inject({url:`/v1/arkas/${arkaId}/history`})).json().items[0].nav,null);
    assert.equal((await app.inject({url:"/v1/metrics"})).json().navComplete,false);
    assert.equal((await app.inject({url:"/v1/nav"})).json().totalNavUsdEstimate,null);
  } finally { await app.close(); }
});
