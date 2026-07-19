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
  VaultModule,
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

test("vault rejects unsafe rebalance and credit inputs before any network request", async () => {
  const vault = new VaultModule(config, contract);
  await assert.rejects(
    vault.buildRebalance({ manager: account, steps: [] }),
    /at least one swap/,
  );
  await assert.rejects(
    vault.buildRebalance({
      manager: account,
      steps: [{
        adapter: contract,
        router: ARKAFUND_MAINNET_CONTRACTS.router,
        poolId: 0,
        assetIn: contract,
        assetOut: ARKAFUND_MAINNET_CONTRACTS.arkaFactory,
        amountIn: 1,
        minOut: 0,
      }],
    }),
    /minOut must be greater than zero/,
  );
  await assert.rejects(
    vault.buildCreditSupply({
      manager: account,
      protocol: { tag: "Blend", values: undefined },
      marketId: 1,
      asset: contract,
      amount: 0,
    }),
    /amount must be greater than zero/,
  );
});

test("vault transaction builders call the generated rebalance and credit methods", async () => {
  const vault = new VaultModule(config, contract);
  const calls: Array<{ action: string; input: Record<string, unknown> }> = [];
  const assembled = { result: 1n, toXDR: () => "AAAA" };
  const build = (action: string) => async (input: Record<string, unknown>) => {
    calls.push({ action, input });
    return assembled;
  };
  (vault as unknown as { client: Record<string, unknown> }).client = {
    rebalance: build("rebalance"),
    blend_lend: build("blend_lend"),
    blend_withdraw: build("blend_withdraw"),
    blend_borrow: build("blend_borrow"),
    blend_repay: build("blend_repay"),
    credit_supply: build("credit_supply"),
    credit_withdraw: build("credit_withdraw"),
    credit_borrow: build("credit_borrow"),
    credit_repay: build("credit_repay"),
  };

  await vault.buildRebalance({
    manager: account,
    steps: [{
      adapter: contract,
      router: ARKAFUND_MAINNET_CONTRACTS.router,
      poolId: 0,
      assetIn: contract,
      assetOut: ARKAFUND_MAINNET_CONTRACTS.arkaFactory,
      amountIn: 10,
      minOut: 9,
    }],
  });
  await vault.buildBlendLend({
    manager: account,
    adapter: contract,
    marketId: 1,
    asset: contract,
    amount: 20,
  });
  await vault.buildBlendWithdraw({
    manager: account,
    adapter: contract,
    marketId: 1,
    asset: contract,
    amount: 21,
  });
  await vault.buildBlendBorrow({
    manager: account,
    adapter: contract,
    marketId: 1,
    asset: contract,
    amount: 22,
  });
  await vault.buildBlendRepay({
    manager: account,
    adapter: contract,
    marketId: 1,
    asset: contract,
    amount: 23,
  });
  await vault.buildCreditSupply({
    manager: account,
    protocol: { tag: "Blend", values: undefined },
    marketId: 1,
    asset: contract,
    amount: 30,
  });
  await vault.buildCreditWithdraw({
    manager: account,
    protocol: { tag: "Blend", values: undefined },
    marketId: 1,
    asset: contract,
    amount: 31,
  });
  await vault.buildCreditBorrow({
    manager: account,
    protocol: { tag: "Blend", values: undefined },
    marketId: 1,
    asset: contract,
    amount: 32,
  });
  await vault.buildCreditRepay({
    manager: account,
    protocol: { tag: "Blend", values: undefined },
    marketId: 1,
    asset: contract,
    amount: 33,
  });

  assert.deepEqual(calls.map((call) => call.action), [
    "rebalance",
    "blend_lend",
    "blend_withdraw",
    "blend_borrow",
    "blend_repay",
    "credit_supply",
    "credit_withdraw",
    "credit_borrow",
    "credit_repay",
  ]);
  assert.equal(
    ((calls[0]?.input.steps as Array<{ amount_in: bigint }>)[0]?.amount_in),
    10n,
  );
  assert.equal(calls[1]?.input.amount, 20n);
  assert.equal(calls[2]?.input.amount, 21n);
  assert.equal(calls[3]?.input.amount, 22n);
  assert.equal(calls[4]?.input.amount, 23n);
  assert.equal(calls[5]?.input.amount, 30n);
  assert.equal(calls[6]?.input.amount, 31n);
  assert.equal(calls[7]?.input.amount, 32n);
  assert.equal(calls[8]?.input.amount, 33n);
});
