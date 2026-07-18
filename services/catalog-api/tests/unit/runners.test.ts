import test from "node:test";
import assert from "node:assert/strict";
import {
  decodeLegacyInstanceStorage,
  isMissingContractFunction,
  isTransientRpcError,
  legacyStorageKeyName,
  retryTransientRpc,
  transientRpcRetryDelayMs,
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

test("isTransientRpcError identifies retryable RPC failures", () => {
  assert.equal(isTransientRpcError(new Error("Request failed with status code 429")), true);
  assert.equal(isTransientRpcError(new Error("Too Many Requests")), true);
  assert.equal(isTransientRpcError(new Error("connect ECONNRESET")), true);
  assert.equal(isTransientRpcError(new Error("Transaction simulation failed")), false);
});

test("retryTransientRpc retries transient failures before succeeding", async () => {
  let calls = 0;
  const value = await retryTransientRpc(
    async () => {
      calls += 1;
      if (calls < 3) {
        throw new Error("Request failed with status code 429");
      }
      return "ok";
    },
    { attempts: 4, baseDelayMs: 1 },
  );

  assert.equal(value, "ok");
  assert.equal(calls, 3);
});

test("retryTransientRpc does not retry permanent failures", async () => {
  let calls = 0;
  await assert.rejects(
    retryTransientRpc(
      async () => {
        calls += 1;
        throw new Error("Transaction simulation failed");
      },
      { attempts: 4, baseDelayMs: 1 },
    ),
    /Transaction simulation failed/,
  );

  assert.equal(calls, 1);
});

test("transientRpcRetryDelayMs honors RPC retry_after metadata", () => {
  const error = {
    response: {
      data: { retry_after: 30 },
    },
  };

  assert.equal(transientRpcRetryDelayMs(error, 2, 250), 30000);
  assert.equal(transientRpcRetryDelayMs(new Error("Too Many Requests"), 2, 250), 500);
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
