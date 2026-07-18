import test from "node:test";
import assert from "node:assert/strict";
import { chunkContractIds, StaticActivityReader } from "../../src/index.js";
import type { ArkaCatalogEntry } from "../../src/index.js";

const arkas: ArkaCatalogEntry[] = [
  {
    arkaId: "CBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
    manager: "GCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC",
    curated: true,
    delisted: false,
    nav: "2000",
    denominationContract: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    whitelistContracts: ["CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"],
    shareToken: null,
    fees: { mgmtBps: 0, perfBps: 0, depositBps: 0, redeemBps: 0 },
    assets: [],
    syncedAt: "2026-03-27T10:00:00.000Z",
  },
];

test("StaticActivityReader filters, sorts, and limits activity results", async () => {
  const reader = new StaticActivityReader([
    {
      eventId: "evt-1",
      cursor: "evt-1",
      arkaId: arkas[0].arkaId,
      manager: arkas[0].manager,
      kind: "deposit",
      ledger: 100,
      ledgerClosedAt: "2026-03-27T10:00:10.000Z",
      txHash: "tx-1",
      transactionIndex: 0,
      operationIndex: 0,
      inSuccessfulContractCall: true,
      user: "GUSER",
      assetContract: arkas[0].denominationContract,
      marketId: null,
      amount: "1000",
      shares: "1000",
      netOut: null,
      stepCount: null,
    },
    {
      eventId: "evt-2",
      cursor: "evt-2",
      arkaId: arkas[0].arkaId,
      manager: arkas[0].manager,
      kind: "redeem",
      ledger: 105,
      ledgerClosedAt: "2026-03-27T10:01:10.000Z",
      txHash: "tx-2",
      transactionIndex: 0,
      operationIndex: 0,
      inSuccessfulContractCall: true,
      user: "GUSER",
      assetContract: arkas[0].denominationContract,
      marketId: null,
      amount: null,
      shares: "400",
      netOut: "400",
      stepCount: null,
    },
  ]);

  const page = await reader.list(arkas, {
    kind: "redeem",
    order: "desc",
    limit: 5,
  });

  assert.equal(page.total, 1);
  assert.equal(page.items[0]?.kind, "redeem");
  assert.equal(page.items[0]?.shares, "400");
});

test("chunkContractIds respects the Stellar RPC filter limit", () => {
  assert.deepEqual(
    chunkContractIds(["C1", "C2", "C3", "C4", "C5", "C6"]),
    [["C1", "C2", "C3", "C4", "C5"], ["C6"]],
  );
});
