import test from "node:test";
import assert from "node:assert/strict";
import { OnChainCatalogSyncRunner } from "../../src/index.js";
import { loadLiveCatalogEnv } from "../support/liveEnv.js";

const env = loadLiveCatalogEnv();

test("OnChainCatalogSyncRunner indexes the live local fixture", async () => {
  const runner = new OnChainCatalogSyncRunner({
    rpcUrl: env.rpcUrl,
    networkPassphrase: env.networkPassphrase,
    registryContractId: env.registryContractId,
    allowHttp: true,
  });

  const snapshot = await runner.run();

  assert.equal(snapshot.metrics.totalArkas, 2);
  assert.equal(snapshot.metrics.indexedArkas, 2);
  assert.equal(snapshot.metrics.failedArkas, 0);
  assert.equal(snapshot.metrics.totalAssets, 1);
  assert.equal(snapshot.metrics.totalNav, "2500");
  assert.equal(snapshot.arkas[0]?.nav, "2000");
  assert.equal(snapshot.arkas[1]?.nav, "500");
  assert.equal(snapshot.arkas[0]?.assets[0]?.netManagedAmount, "2000");
  assert.equal(snapshot.arkas[1]?.assets[0]?.netManagedAmount, "500");
  assert.ok(snapshot.assets[0]?.assetContract);
  assert.equal(snapshot.assets[0]?.netManagedAmount, "2500");
  assert.equal(snapshot.managers[0]?.totalNav, "2000");
});
