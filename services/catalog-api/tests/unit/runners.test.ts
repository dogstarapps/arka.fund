import test from "node:test";
import assert from "node:assert/strict";
import {
  decodeLegacyInstanceStorage,
  isMissingContractFunction,
  legacyStorageKeyName,
} from "../../src/runners.js";

test("isMissingContractFunction matches missing share_token diagnostics", () => {
  const error = new Error(
    'Transaction simulation failed: "HostError: Error(WasmVm, MissingValue)\n\nEvent log (newest first):\n   0: [Diagnostic Event] contract:CA..., topics:[error, Error(WasmVm, MissingValue)], data:["trying to invoke non-existent contract function", share_token]\n"',
  );

  assert.equal(isMissingContractFunction(error, "share_token"), true);
  assert.equal(isMissingContractFunction(error, "blend_markets"), false);
});

test("isMissingContractFunction matches missing blend_markets diagnostics", () => {
  const error = new Error(
    'Transaction simulation failed: "HostError: Error(WasmVm, MissingValue)\n\nEvent log (newest first):\n   0: [Diagnostic Event] contract:CA..., topics:[error, Error(WasmVm, MissingValue)], data:["trying to invoke non-existent contract function", blend_markets]\n"',
  );

  assert.equal(isMissingContractFunction(error, "blend_markets"), true);
});

test("isMissingContractFunction does not swallow unrelated failures", () => {
  const error = new Error("Transaction simulation failed: ledger entry not found");

  assert.equal(isMissingContractFunction(error, "share_token"), false);
  assert.equal(isMissingContractFunction(error, "manager"), false);
});

test("legacyStorageKeyName extracts enum tag from native storage key", () => {
  assert.equal(legacyStorageKeyName(["Aum"]), "Aum");
  assert.equal(legacyStorageKeyName(["Balance", "CA..."]), "Balance");
  assert.equal(legacyStorageKeyName("Aum"), null);
  assert.equal(legacyStorageKeyName([]), null);
});

test("decodeLegacyInstanceStorage maps legacy instance data into arka state", () => {
  const state = decodeLegacyInstanceStorage([
    { key: ["Aum"], value: 250000n },
    { key: ["Denomination"], value: { contract: "CDENOM" } },
    {
      key: ["Fees"],
      value: {
        deposit_bps: 15,
        mgmt_bps: 100,
        perf_bps: 1200,
        redeem_bps: 5,
      },
    },
    {
      key: ["Whitelist"],
      value: [{ contract: "CDENOM" }, { contract: "CALT" }],
    },
    { key: ["Manager"], value: "GMANAGER" },
  ]);

  assert.equal(state.nav, 250000n);
  assert.deepEqual(state.denomination, { contract: "CDENOM" });
  assert.deepEqual(state.fees, {
    deposit_bps: 15,
    mgmt_bps: 100,
    perf_bps: 1200,
    redeem_bps: 5,
  });
  assert.deepEqual(state.whitelist, [{ contract: "CDENOM" }, { contract: "CALT" }]);
  assert.equal(state.manager, "GMANAGER");
});
