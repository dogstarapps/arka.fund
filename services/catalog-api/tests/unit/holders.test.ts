import test from "node:test";
import assert from "node:assert/strict";
import { NoopHolderReader, RpcHolderReader, StaticHolderReader } from "../../src/index.js";
import type { ArkaCatalogEntry, ArkaHolderPage } from "../../src/index.js";

const arka: ArkaCatalogEntry = {
  arkaId: "CBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
  manager: "GCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC",
  curated: true,
  delisted: false,
  nav: "2000",
  denominationContract: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  whitelistContracts: ["CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"],
  shareToken: "CDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD",
  fees: { mgmtBps: 0, perfBps: 0, depositBps: 0, redeemBps: 0 },
  assets: [],
  syncedAt: "2026-03-27T10:00:00.000Z",
};

const page: ArkaHolderPage = {
  arkaId: arka.arkaId,
  shareToken: arka.shareToken,
  totalShares: "1000",
  indexedAt: "2026-03-27T10:00:00.000Z",
  complete: true,
  coverageFromLedger: 100,
  coverageToLedger: 200,
  total: 2,
  offset: 0,
  limit: 2,
  items: [
    { holder: "G1", shares: "750", ownershipBps: 7500, firstSeenLedger: 101, lastActivityLedger: 180 },
    { holder: "G2", shares: "250", ownershipBps: 2500, firstSeenLedger: 102, lastActivityLedger: 190 },
  ],
};

test("StaticHolderReader paginates reconciled ownership without changing totals", async () => {
  const result = await new StaticHolderReader({ [arka.arkaId]: page }).list(arka, {
    offset: 1,
    limit: 1,
  });
  assert.equal(result.total, 2);
  assert.equal(result.totalShares, "1000");
  assert.equal(result.items[0]?.holder, "G2");
  assert.equal(result.items[0]?.ownershipBps, 2500);
});

test("NoopHolderReader declares incomplete coverage instead of inventing holders", async () => {
  const result = await new NoopHolderReader().list(arka);
  assert.equal(result.complete, false);
  assert.equal(result.total, 0);
  assert.deepEqual(result.items, []);
});

function fixture() {
  let time=Date.parse(page.indexedAt);
  class Reader extends RpcHolderReader {
    calls=0;
    read: () => Promise<ArkaHolderPage> = async () => ({...page,indexedAt:new Date(time).toISOString()});
    protected async refresh(): Promise<ArkaHolderPage> {this.calls++;return this.read();}
  }
  const reader=new Reader({rpcUrl:'https://rpc.example',networkPassphrase:'test',archiveFile:'unused',now:()=>new Date(time)});
  return {reader,advance:(ms:number)=>{time+=ms;}};
}

test('holder fresh cache preserves verified timestamp, totals and pagination', async () => {
  const {reader,advance}=fixture();
  const first=await reader.list(arka);
  advance(4_000);
  const second=await reader.list(arka,{offset:1,limit:1});
  assert.equal(reader.calls,1);assert.equal(second.indexedAt,first.indexedAt);
  assert.equal(second.total,2);assert.equal(second.totalShares,'1000');
  assert.equal(second.items[0].holder,'G2');assert.equal(second.stale,false);
});

test('cold simultaneous holder requests share one chain read', async () => {
  const {reader}=fixture();let finish!: (value:ArkaHolderPage)=>void;
  reader.read=()=>new Promise(resolve=>{finish=resolve;});
  const a=reader.list(arka);const b=reader.list(arka,{offset:1,limit:1});
  assert.equal(reader.calls,1);finish(page);
  assert.equal((await a).items.length,2);assert.equal((await b).items[0].holder,'G2');
});

test('slow background chain refresh does not block bounded last-verified holders', async () => {
  const {reader,advance}=fixture();await reader.list(arka);advance(6_000);
  let finish!: (value:ArkaHolderPage)=>void;
  reader.read=()=>new Promise(resolve=>{finish=resolve;});
  const a=await reader.list(arka);const b=await reader.list(arka);
  assert.equal(reader.calls,2);assert.equal(a.stale,true);assert.equal(b.stale,true);
  assert.equal(a.indexedAt,page.indexedAt);assert.equal(a.totalShares,'1000');
  finish({...page,indexedAt:'2026-03-27T10:00:06.000Z'});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal((await reader.list(arka)).stale,false);
});

test('failed refresh is reported and never relabels balances as freshly verified', async () => {
  const {reader,advance}=fixture();await reader.list(arka);advance(6_000);
  reader.read=async()=>{throw new Error('RPC unavailable');};
  await reader.list(arka);await new Promise(resolve=>setImmediate(resolve));
  const result=await reader.list(arka);
  assert.equal(result.stale,true);assert.equal(result.refreshFailed,true);
  assert.equal(result.indexedAt,page.indexedAt);assert.equal(result.totalShares,'1000');
});

test('holder cache older than two minutes is not served on RPC failure', async () => {
  const {reader,advance}=fixture();await reader.list(arka);advance(120_001);
  reader.read=async()=>{throw new Error('RPC unavailable');};
  await assert.rejects(reader.list(arka),/RPC unavailable/);
});

test('share-token change invalidates cached ownership even inside fresh TTL', async () => {
  const {reader}=fixture();await reader.list(arka);
  reader.read=async()=>({...page,shareToken:'new-token'});
  const changed=await reader.list({...arka,shareToken:'new-token'});
  assert.equal(reader.calls,2);assert.equal(changed.shareToken,'new-token');
});
