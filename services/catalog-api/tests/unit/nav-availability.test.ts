import test from "node:test";
import assert from "node:assert/strict";
import { Err, Ok } from "@stellar/stellar-sdk/contract";
import { expectSimulationResult } from "../../src/clientOptions.js";
import { OnChainCatalogSyncRunner } from "../../src/runners.js";

test("SDK Err is never returned as a monetary result", () => {
  assert.throws(() => expectSimulationResult({result: new Err({message: "BlendNavUnavailable"})} as never, "nav"), /BlendNavUnavailable/);
  assert.throws(() => expectSimulationResult({result: new Err({message: ""})} as never, "nav"), /contract_error/);
  assert.equal(expectSimulationResult({result: 123n} as never, "nav"), 123n);
  assert.equal(expectSimulationResult({result: new Ok(123n)} as never, "nav"), 123n);
  assert.equal(expectSimulationResult({result: null} as never, "share_token"), null);
});

const usdc = "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75";
const healthy = "CCHNBPXXVSNQPPSD5XO6XLJ4BPXCXECW7AJJEPP5CF23IT6CAJWBIV4M";
const noah = "CCP7X4UYFSUNXWRUH7W25RQMEQEHXFIYHNHVGAYAGGOOHPMPJKZGOGPW";
function fakeRunner() {
  const runner = new OnChainCatalogSyncRunner({rpcUrl:"https://mainnet.sorobanrpc.com",networkPassphrase:"Public Global Stellar Network ; September 2015",registryContractId:"CCMCYADNUESGFRIJRZ2AOHUZBIPMRLVZCHB3BVIPHZCKGWFJSSJQBXAY"});
  Object.assign(runner, {
    listAllArkas: async () => [healthy, noah],
    readManager: async (client: {options: {contractId: string}}) => client.options.contractId,
    readNav: async (client: {options: {contractId: string}}) => {
      if (client.options.contractId === noah) throw new Error("BlendNavUnavailable");
      return 10000000n;
    },
    readDenomination: async () => ({contract: usdc}),
    readFees: async () => ({mgmt_bps:0,perf_bps:0,deposit_bps:0,redeem_bps:0}),
    readWhitelist: async () => [{contract: usdc}],
    readOptionalShareToken: async () => null,
    readOptionalBlendMarkets: async () => [],
    readArkaAssets: async () => [],
    registryClient: {is_manager_curated: async () => ({result: false}),is_delisted: async () => ({result:false})},
  });
  return runner;
}
test("failed NAV preserves discovery, reports null, and does not stop other vaults", async () => {
  const snapshot = await fakeRunner().run();
  const entry = snapshot.arkas.find(entry => entry.arkaId === noah);
  assert.equal(snapshot.arkas.length, 2);
  assert.equal(snapshot.metrics.totalArkas, 2);
  assert.equal(snapshot.metrics.totalNav, "10000000");
  assert.equal(snapshot.metrics.navComplete, false);
  assert.equal(snapshot.metrics.unvaluedArkas, 1);
  assert.equal(snapshot.failures.length, 1);
  assert.equal(entry?.nav, null);
  assert.equal(entry?.economics?.navUsdEstimate, null);
  assert.equal(entry?.economics?.valuationSource, "unavailable");
  assert.match(entry?.navUnavailableReason ?? "", /BlendNavUnavailable/);
});
test("an invalid NAV object cannot escape into the snapshot", async () => {
  const runner = fakeRunner();
  Object.assign(runner, {readNav: async () => ({error:{message:""}})});
  const snapshot = await runner.run();
  assert.equal(snapshot.arkas.length, 2);
  assert.equal(snapshot.metrics.unvaluedArkas, 2);
  assert.equal(snapshot.metrics.totalArkas, 2);
  assert.ok(snapshot.arkas.every(entry => entry.nav === null));
});
