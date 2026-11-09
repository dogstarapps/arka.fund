import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Keypair, StrKey } from "@stellar/stellar-sdk";
import { buildSnapshot, buildIdentityUpdateMessage, CatalogService, FileCatalogHistoryStore, FileCatalogStore, FileIdentityStore, createCatalogApp } from "../../src/index.js";

const deferred = () => { let resolve!: () => void; const promise = new Promise<void>(done => { resolve = done; }); return {promise, resolve}; };
const earlier = () => buildSnapshot([], [], "2026-11-04T00:00:00.000Z");
const later = () => buildSnapshot([], [], "2026-11-04T00:01:00.000Z");
async function fixture(run: () => Promise<ReturnType<typeof buildSnapshot>>) {
  const directory = await mkdtemp(join(process.env.ARKA_AUDIT_TEST_DIRECTORY ?? tmpdir(), "arka-service-concurrency-"));
  const store = new FileCatalogStore(join(directory, "snapshot.json"));
  const history = new FileCatalogHistoryStore(join(directory, "history.json"));
  return {directory, store, history, service: new CatalogService(store, history, {run})};
}

test("overlapping sync callers share one publication and a later sync catches up without rollback", async () => {
  const entered = deferred(), release = deferred(); let calls = 0;
  const f = await fixture(async () => { if (++calls === 1) { entered.resolve(); await release.promise; return earlier(); } return later(); });
  const first = f.service.sync(); await entered.promise;
  const overlapping = f.service.sync(); assert.equal(overlapping, first);
  release.resolve(); await Promise.all([first, overlapping]);
  assert.equal(calls, 1); assert.equal((await f.service.current())!.syncedAt, earlier().syncedAt);
  await f.service.sync();
  assert.equal(calls, 2); assert.equal((await f.service.current())!.syncedAt, later().syncedAt);
  assert.deepEqual((await f.service.history()).runs.map(x => x.syncedAt), [earlier().syncedAt, later().syncedAt]);
});

test("concurrent authorized HTTP syncs share one runner instead of racing file publications", async () => {
  const entered = deferred(), release = deferred(); let calls = 0;
  const f = await fixture(async () => { calls++; entered.resolve(); await release.promise; return later(); });
  const app = createCatalogApp({service:f.service, syncToken:"local-test-token"});
  try {
    await app.ready();
    const requests = Array.from({length:8}, () => app.inject({method:"POST", url:"/v1/sync", headers:{"x-arkafund-sync-token":"local-test-token"}}));
    await entered.promise;
    await new Promise<void>(done => setImmediate(done));
    release.resolve();
    const responses = await Promise.all(requests); assert(responses.every(r => r.statusCode === 200));
    assert.equal(calls, 1); assert.equal((await f.service.history()).runs.length, 1);
    assert.equal((await f.service.current())!.syncedAt, later().syncedAt);
  } finally { await app.close(); }
});

test("a shared runner failure is reported to every waiter and does not block the next sync", async () => {
  const entered = deferred(), release = deferred(); let calls = 0;
  const f = await fixture(async () => { if (++calls === 1) { entered.resolve(); await release.promise; throw Error("controlled-read-failure"); } return later(); });
  const one = f.service.sync(); await entered.promise; const two = f.service.sync();
  const settled = Promise.allSettled([one,two]); release.resolve();
  const results = await settled; assert(results.every(r => r.status === "rejected" && /controlled-read-failure/.test(r.reason.message)));
  assert.equal(await f.service.current(), null); await f.service.sync(); assert.equal(calls,2);
  assert.equal((await f.service.current())!.syncedAt, later().syncedAt);
});

test("publication failure clears the shared operation and permits a successful retry by the operator", async () => {
  const f = await fixture(async () => later()); const write = f.store.write.bind(f.store); let writes = 0;
  f.store.write = async value => { if (++writes === 1) throw Error("controlled-publication-failure"); await write(value); };
  const one = f.service.sync(), two = f.service.sync();
  const results = await Promise.allSettled([one,two]); assert(results.every(x => x.status === "rejected"));
  assert.equal(writes,1); assert.equal(await f.service.current(),null);
  await f.service.sync(); assert.equal(writes,2); assert.equal((await f.service.current())!.syncedAt,later().syncedAt);
});

test("independent service instances do not share a synchronization lock", async () => {
  const a = deferred(), b = deferred(), release = deferred();
  const one = await fixture(async () => { a.resolve(); await release.promise; return later(); });
  const two = await fixture(async () => { b.resolve(); await release.promise; return later(); });
  const jobs = [one.service.sync(),two.service.sync()]; await Promise.all([a.promise,b.promise]); release.resolve(); await Promise.all(jobs);
});

const owner = StrKey.encodeEd25519PublicKey(Buffer.alloc(32,51));
const fundA = StrKey.encodeContract(Buffer.alloc(32,71)), fundB = StrKey.encodeContract(Buffer.alloc(32,72));
const now = new Date("2026-11-04T00:00:00.000Z");
function request(scope:"arka"|"manager",target:string,label:string) {
  const payload = {displayName:label,nonce:"audit-concurrency-0001",issuedAt:now.toISOString()};
  // Concurrency tests stub only verification. This placeholder is not a real signature.
  return {signer:owner,message:buildIdentityUpdateMessage({scope,target,signer:owner,payload}),signature:"local-test-placeholder",payload};
}
async function identityFixture() {
  const directory = await mkdtemp(join(process.env.ARKA_AUDIT_TEST_DIRECTORY ?? tmpdir(),"arka-identity-concurrency-"));
  const store = new FileIdentityStore(join(directory,"identity.json"));
  const service = new CatalogService(new FileCatalogStore(join(directory,"snapshot.json")),new FileCatalogHistoryStore(join(directory,"history.json")),{run:async()=>earlier()},{identityStore:store,now:()=>now});
  return {store,service};
}

test("authorized concurrent profile updates preserve both records with real file persistence", async t => {
  t.mock.method(Keypair.prototype,"verify",()=>true);
  const f = await identityFixture();
  await Promise.all([f.service.updateArkaIdentity(fundA,request("arka",fundA,"First")),f.service.updateArkaIdentity(fundB,request("arka",fundB,"Second"))]);
  const archive = await f.store.read(); assert.equal(archive.arkas[fundA].displayName,"First"); assert.equal(archive.arkas[fundB].displayName,"Second");
});

test("Arka and manager updates share the same identity transaction boundary", async t => {
  t.mock.method(Keypair.prototype,"verify",()=>true);
  const f = await identityFixture();
  await Promise.all([f.service.updateArkaIdentity(fundA,request("arka",fundA,"Fund")),f.service.updateManagerIdentity(owner,request("manager",owner,"Manager"))]);
  const archive = await f.store.read(); assert.equal(archive.arkas[fundA].displayName,"Fund"); assert.equal(archive.managers[owner].displayName,"Manager");
});

test("rejected identity updates do not discard a subsequent valid mutation", async t => {
  t.mock.method(Keypair.prototype,"verify",()=>true);
  const f = await identityFixture(),bad={...request("arka",fundA,"Rejected"),message:"wrong-message"};
  const results = await Promise.allSettled([f.service.updateArkaIdentity(fundA,bad),f.service.updateArkaIdentity(fundB,request("arka",fundB,"Kept"))]);
  assert.equal(results[0].status,"rejected"); assert.equal(results[1].status,"fulfilled");
  const archive=await f.store.read(); assert.equal(archive.arkas[fundA],undefined); assert.equal(archive.arkas[fundB].displayName,"Kept");
});
