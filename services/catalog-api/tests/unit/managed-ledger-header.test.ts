import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import { hash, Networks, xdr } from "@stellar/stellar-sdk";
import { RpcManagedReadTransport } from "../../src/managedRuntime.js";

const sequence = 101;
const closeTime = 1_794_848_010;

function ledgerResponse(protocol: number, ledgerSeq: number, hashMatches: boolean) {
  const zeroHash = Buffer.alloc(32);
  const signature = new xdr.LedgerCloseValueSignature({
    nodeId: xdr.PublicKey.publicKeyTypeEd25519(zeroHash),
    signature: Buffer.alloc(64),
  });
  const header = new xdr.LedgerHeader({
    ledgerVersion: protocol,
    previousLedgerHash: zeroHash,
    scpValue: new xdr.StellarValue({
      txSetHash: zeroHash,
      closeTime: xdr.Uint64.fromString(String(closeTime)),
      upgrades: [],
      ext: protocol === 29
        ? xdr.StellarValueExt.stellarValueSigned(signature)
        : xdr.StellarValueExt.stellarValueSignedMs(new xdr.StellarValueSignedMsValue({
            closeTimeMs: xdr.Uint64.fromString(String(closeTime * 1000 + 321)),
            lcValueSignature: signature,
          })),
    }),
    txSetResultHash: zeroHash,
    bucketListHash: zeroHash,
    ledgerSeq,
    totalCoins: xdr.Int64.fromString("0"),
    feePool: xdr.Int64.fromString("0"),
    inflationSeq: 0,
    idPool: xdr.Uint64.fromString("0"),
    baseFee: 100,
    baseReserve: 5_000_000,
    maxTxSetSize: 100,
    skipList: Array.from({ length: 4 }, () => zeroHash),
    ext: new xdr.LedgerHeaderExt(0),
  });
  const headerHash = hash(header.toXDR());
  const entry = new xdr.LedgerHeaderHistoryEntry({
    hash: headerHash,
    header,
    ext: new xdr.LedgerHeaderHistoryEntryExt(0),
  });
  const meta = new xdr.LedgerCloseMeta(0, new xdr.LedgerCloseMetaV0({
    ledgerHeader: entry,
    txSet: new xdr.TransactionSet({ previousLedgerHash: zeroHash, txes: [] }),
    txProcessing: [],
    upgradesProcessing: [],
    scpInfo: [],
  }));
  return {
    hash: (hashMatches ? headerHash : zeroHash).toString("hex"),
    sequence: ledgerSeq,
    ledgerCloseTime: String(closeTime),
    headerXdr: entry.toXDR("base64"),
    metadataXdr: meta.toXDR("base64"),
  };
}

test("managed catalog decodes protocol 30 and preserves header validation", async (t) => {
  let ledger = ledgerResponse(30, sequence, true);
  let requestedLedger: number | undefined;
  const server = createServer(async (req, res) => {
    const body = [];
    for await (const chunk of req) body.push(chunk);
    const { id, method, params } = JSON.parse(Buffer.concat(body).toString());
    const present = { latestLedger: sequence, oldestLedger: 1 };
    const responses: Record<string, unknown> = {
      getNetwork: { passphrase: Networks.TESTNET },
      getHealth: { status: "healthy", ...present },
      getLedgers: { ledgers: [ledger], ...present },
    };
    if (method === "getLedgers") requestedLedger = params.startLedger;
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ jsonrpc: "2.0", id, result: responses[method] }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise<void>((resolve) => server.close(() => resolve())));
  const rpcUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const transport = new RpcManagedReadTransport({ rpcUrl, networkPassphrase: Networks.TESTNET });
  const expected = { sequence, time: closeTime };

  assert.deepEqual(await transport.guard(), expected);
  assert.equal(requestedLedger, sequence);
  ledger = ledgerResponse(29, sequence, true);
  assert.deepEqual(await transport.guard(), expected);
  ledger = ledgerResponse(31, sequence, true);
  await assert.rejects(transport.guard(), /MANAGED_HEADER_CHANGED/);
  ledger = ledgerResponse(30, sequence - 1, true);
  await assert.rejects(transport.guard(), /MANAGED_HEADER_CHANGED/);
  ledger = ledgerResponse(30, sequence, false);
  await assert.rejects(transport.guard(), /MANAGED_HEADER_CHANGED/);
});
