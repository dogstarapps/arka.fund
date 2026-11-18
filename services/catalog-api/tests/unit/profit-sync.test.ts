import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { Networks, StrKey } from "@stellar/stellar-sdk";
import { createCatalogApp } from "../../src/app.js";
import { buildSnapshot } from "../../src/catalog.js";
import { cashFlowCursorThrough } from "../../src/profitRpc.js";
import { withVerifiedProfit, type ProfitCheckpoint, type ProfitSource } from "../../src/profitSync.js";
import { CatalogService } from "../../src/service.js";
import { FileCatalogHistoryStore, FileCatalogStore } from "../../src/store.js";
import type { ArkaCatalogEntry } from "../../src/types.js";

const address = (byte: number) => StrKey.encodeContract(Buffer.alloc(32, byte));
const arkaId = address(1);
const denominationContract = address(2);
const shareToken = address(3);
const codeHash = "ca".repeat(32);
const asOf = "2026-11-18T12:00:00Z";

test("catalog sync advances verified cash flows once, resumes after restart and withholds profit after a gap", async t => {
  const root = await mkdtemp(join(tmpdir(), "arka-profit-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const seed = join(root, "seed.json");
  const state = join(root, "state.json");
  const source: ProfitCheckpoint = {
    schemaVersion: 1, network: Networks.PUBLIC,
    funds: { [arkaId]: {
      denominationContract, shareToken, codeHash, createdLedger: 50, throughLedger: 100,
      deposits: "1000", withdrawals: "50", estimated: false,
    } },
  };
  const original = JSON.stringify(source);
  await writeFile(seed, original);
  const entry: ArkaCatalogEntry = {
    arkaId, denominationContract, shareToken, manager: address(4),
    curated: true, delisted: false, nav: "1200", syncedAt: asOf,
    whitelistContracts: [denominationContract], assets: [],
    fees: { mgmtBps: 0, perfBps: 0, depositBps: 0, redeemBps: 0 },
  };

  let ledger = 110;
  let oldestLedger = 90;
  let executable = codeHash;
  let calls = 0;
  const reads: [number, number][] = [];
  const transport: ProfitSource = {
    async coverage() { return { oldestLedger, latestLedger: ledger }; },
    async quote() { return { ledger, nav: 1200n, asOf, codeHash: executable, denominationContract, shareToken }; },
    async cashFlows(_id, _denomination, from, through) {
      reads.push([from, through]);
      return from === 101
        ? [{ kind: "deposit", amount: 100n, estimated: true }, { kind: "redeem", amount: 25n, estimated: false }]
        : [];
    },
  };
  const service = () => new CatalogService(
    new FileCatalogStore(join(root, "snapshot.json")),
    new FileCatalogHistoryStore(join(root, "history.json")),
    withVerifiedProfit({ async run() {
      calls++;
      return buildSnapshot([{ ...entry, syncedAt: new Date(Date.parse(asOf) + ledger * 1000).toISOString() }], [], asOf);
    } }, transport, { seed, state }),
  );

  const first = service();
  const [a, b] = await Promise.all([first.sync(), first.sync()]);
  assert.equal(a, b);
  assert.equal(calls, 1);
  assert.deepEqual(a.arkas[0].verifiedProfit, { amount: "175", ledger: 110, asOf, estimated: true });
  assert.equal(a.arkas[0].economics?.pnl.amount, "175");
  const app = createCatalogApp({ service: first });
  t.after(() => app.close());
  const listed = await app.inject({ method: "GET", url: "/v1/arkas" });
  assert.equal(listed.statusCode, 200);
  assert.equal(listed.json().items[0].verifiedProfit.amount, "175");

  ledger = 115;
  const restarted = service();
  assert.equal((await restarted.sync()).arkas[0].verifiedProfit?.amount, "175");
  assert.deepEqual(reads, [[101, 110], [111, 115]]);
  await restarted.sync();
  assert.equal(reads.length, 2);
  const goodCheckpoint = await readFile(state, "utf8");

  ledger = 130;
  oldestLedger = 119;
  const gap = (await restarted.sync()).arkas[0];
  assert.equal(gap.verifiedProfit, undefined);
  assert.equal(gap.economics?.pnl.amount, null);
  assert.equal(gap.nav, "1200");
  assert.equal(await readFile(state, "utf8"), goodCheckpoint);

  oldestLedger = 100;
  executable = "0a".repeat(32);
  assert.equal((await restarted.sync()).arkas[0].verifiedProfit, undefined);
  assert.equal(await readFile(state, "utf8"), goodCheckpoint);
  assert.equal(await readFile(seed, "utf8"), original);
  assert.equal(reads.length, 2);
});

test("a sparse event page only closes a ledger at the explicit end cursor", () => {
  const ledger = 65542917n;
  const last = String((ledger << 32n) | 0xffff_ffffn);
  assert.equal(cashFlowCursorThrough(last + "-4294967295"), Number(ledger));
  assert.equal(cashFlowCursorThrough(last + "-1"), Number(ledger - 1n));
  assert.equal(cashFlowCursorThrough(String(ledger << 32n) + "-0"), Number(ledger - 1n));
  assert.throws(() => cashFlowCursorThrough("broken"));
});
