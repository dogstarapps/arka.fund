import test from "node:test";
import assert from "node:assert/strict";
import {Account,Networks,Operation,TransactionBuilder,xdr} from "@stellar/stellar-sdk";
import { submitTransaction } from "../../src/index.js";

const publicKey="GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
function fixture(value="reviewed"){
 const transaction=new TransactionBuilder(new Account(publicKey,"0"),{fee:"100",networkPassphrase:Networks.TESTNET}).addOperation(Operation.manageData({name:"review",value})).setTimeout(60).build();
 // Wallet/wire doubles only: the SDK checks body identity, not signer-set authority.
 transaction.signatures.push(new xdr.DecoratedSignature({hint:Buffer.alloc(4),signature:Buffer.alloc(64)}));
 return {xdr:transaction.toXDR(),hash:transaction.hash().toString("hex")};
}
const reviewed=fixture();
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
      signTransaction: async () => ({ signedTxXdr: reviewed.xdr }),
    }, {
      toXDR: () => reviewed.xdr,
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
      ? { hash: reviewed.hash, status: "PENDING" }
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
    signTransaction: async () => ({ signedTxXdr: reviewed.xdr }),
  }, {
    toXDR: () => reviewed.xdr,
    result: 7n,
  });

  assert.equal(request, 2);
  assert.equal(submitted.hash, reviewed.hash);
  assert.equal(submitted.simulationResult, 7n);
  assert.equal((submitted.getResponse as { status: string }).status, "SUCCESS");
});

test("a wallet response changing the reviewed operation is rejected before any wire call",async()=>{let calls=0;globalThis.fetch=async()=>{calls++;throw Error("WIRE_REACHED");};await assert.rejects(submitTransaction({rpcUrl:"https://rpc.example",networkPassphrase:Networks.TESTNET,publicKey,signTransaction:async()=>({signedTxXdr:fixture("changed").xdr})},{toXDR:()=>reviewed.xdr}),/different or unsigned transaction/);assert.equal(calls,0);});
test("an RPC hash for another transaction cannot start receipt polling",async()=>{let calls=0;globalThis.fetch=async()=>{calls++;return new Response(JSON.stringify({result:{status:"PENDING",hash:"f".repeat(64)}}));};await assert.rejects(submitTransaction({rpcUrl:"https://rpc.example",networkPassphrase:Networks.TESTNET,publicKey,signTransaction:async()=>({signedTxXdr:reviewed.xdr})},{toXDR:()=>reviewed.xdr}),/different transaction hash/);assert.equal(calls,1);});
