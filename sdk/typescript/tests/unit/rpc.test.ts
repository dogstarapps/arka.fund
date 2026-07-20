import test from "node:test";
import assert from "node:assert/strict";
import { submitTransaction } from "../../src/index.js";

const originalFetch = globalThis.fetch;

test.afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("submitTransaction rejects an RPC ERROR even when a hash is present", async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    result: {
      hash: "a".repeat(64),
      status: "ERROR",
      errorResultXdr: "AAAA",
    },
  }), { status: 200, headers: { "content-type": "application/json" } });

  await assert.rejects(
    submitTransaction({
      rpcUrl: "https://rpc.example",
      networkPassphrase: "Test SDF Network ; September 2015",
      publicKey: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
      signTransaction: async () => ({ signedTxXdr: "signed" }),
    }, {
      toXDR: () => "unsigned",
      result: 1n,
    }),
    /sendTransaction rejected the transaction: AAAA/,
  );
});

test("submitTransaction waits for SUCCESS and returns the submitted hash", async () => {
  let request = 0;
  globalThis.fetch = async (_input, init) => {
    request += 1;
    const body = JSON.parse(String(init?.body)) as { method: string };
    const result = body.method === "sendTransaction"
      ? { hash: "b".repeat(64), status: "PENDING" }
      : { status: "SUCCESS", resultXdr: "result" };
    return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  const submitted = await submitTransaction({
    rpcUrl: "https://rpc.example",
    networkPassphrase: "Test SDF Network ; September 2015",
    publicKey: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
    signTransaction: async () => ({ signedTxXdr: "signed" }),
  }, {
    toXDR: () => "unsigned",
    result: 7n,
  });

  assert.equal(request, 2);
  assert.equal(submitted.hash, "b".repeat(64));
  assert.equal(submitted.simulationResult, 7n);
  assert.equal((submitted.getResponse as { status: string }).status, "SUCCESS");
});
