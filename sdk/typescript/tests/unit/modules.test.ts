import test from "node:test";
import assert from "node:assert/strict";

import {
  ARKAFUND_MAINNET_CONTRACTS,
  FactoryModule,
  RouterModule,
  STELLAR_MAINNET_PASSPHRASE,
  STELLAR_MAINNET_RPC_URL,
  VenueRegistryModule,
  VenueStatus,
  createMainnetConfig,
} from "../../src/index.js";

const config = createMainnetConfig();
const account = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
const contract = "CAIVP3OKEPRAXCN5GRMNOZCVCF6VLI6DDDZ4X5NOIUUC73I5EGLG4CYK";

test("mainnet preset contains valid public deployment identifiers", () => {
  assert.equal(config.rpcUrl, STELLAR_MAINNET_RPC_URL);
  assert.equal(config.networkPassphrase, STELLAR_MAINNET_PASSPHRASE);
  assert.equal(Object.keys(ARKAFUND_MAINNET_CONTRACTS).length, 19);
  for (const address of Object.values(ARKAFUND_MAINNET_CONTRACTS)) {
    assert.match(address, /^C[A-Z2-7]{55}$/);
  }
});

test("factory validates creation inputs before any network request", async () => {
  const factory = new FactoryModule(config, ARKAFUND_MAINNET_CONTRACTS.arkaFactory);
  await assert.rejects(
    factory.buildCreateAndInitialize({
      salt: new Uint8Array([1]),
      manager: account,
      denomination: contract,
      managementFeeBps: 10_001,
      performanceFeeBps: 0,
      depositFeeBps: 0,
      redemptionFeeBps: 0,
      whitelist: [contract],
      router: ARKAFUND_MAINNET_CONTRACTS.router,
    }),
    /managementFeeBps/,
  );
});

test("router rejects unsafe empty routes and zero first-hop amounts", async () => {
  const router = new RouterModule(config, ARKAFUND_MAINNET_CONTRACTS.router);
  await assert.rejects(
    router.buildExecute({ caller: account, steps: [] }),
    /at least one swap/,
  );
  await assert.rejects(
    router.buildExecute({
      caller: account,
      steps: [
        {
          adapter: contract,
          poolId: 1,
          amountIn: 0,
          minOut: 1,
          assetOut: contract,
        },
      ],
    }),
    /greater than zero/,
  );
});

test("venue registry rejects unsupported status values before any network request", async () => {
  const registry = new VenueRegistryModule(config, ARKAFUND_MAINNET_CONTRACTS.venueRegistry);
  await assert.rejects(
    registry.buildSetStatus(account, contract, 4 as VenueStatus),
    /supported venue status/,
  );
});
