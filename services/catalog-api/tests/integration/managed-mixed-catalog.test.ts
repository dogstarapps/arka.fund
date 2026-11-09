import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,readFile,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import {pathToFileURL} from "node:url";
import {CatalogService,FileCatalogStore,FileCatalogHistoryStore,FileIdentityStore,StaticCatalogSyncRunner,createCatalogApp,ManagedCatalogSyncRunner,FileManagedObservationStore,ManagedCatalogAccess,MixedHolderReader,RpcManagedSnapshotSource,projectManagedInvestors,buildSnapshot} from "../../src/index.js";
import {baseEntries,snapshots,identities,state,FixtureManagedSource,FixtureManagedTransport,legacyHolders,LEGACY,V3,INVESTOR,MANAGER,V3_HASH,LEGACY_HASH,FIXTURE_AT,contract} from "../support/managedFixture.js";
import type {ManagedObservation,ManagedSnapshotSource} from "../../src/managedTypes.js";
async function setup({readOnly=false,rawSource=false,legacyOnly=false}={}){
 const directory=await mkdtemp(join(tmpdir(),"arka-mixed-catalog-"));
 const identityFile=join(directory,"identity.json"),historyFile=join(directory,"history.json"),snapshotFile=join(directory,"snapshot.json");
 const history=new FileCatalogHistoryStore(historyFile);await history.append(snapshots("2026-10-14T10:00:00.000Z"));await history.append(snapshots("2026-10-15T10:00:00.000Z"));
 const identity=new FileIdentityStore(identityFile);await identity.write(identities());
 const identityBefore=await readFile(identityFile,"utf8"),historyBefore=(await history.read()).runs;
 const managedStore=new FileManagedObservationStore(join(directory,"managed.v3.json"));
 const fixture=new FixtureManagedSource(),transport=new FixtureManagedTransport(),holders=legacyHolders();
 fixture.legacyOnly=legacyOnly;
 const source=rawSource?new RpcManagedSnapshotSource(transport,holders,{legacy:[LEGACY_HASH],v3:[V3_HASH]}):fixture;
 const runner=new ManagedCatalogSyncRunner(new StaticCatalogSyncRunner(()=>snapshots((rawSource?transport.observation:fixture.observation).observedAt,rawSource?transport.observation:fixture.observation)),source,managedStore);
 const access=new ManagedCatalogAccess(managedStore,()=>Date.parse((rawSource?transport.observation:fixture.observation).observedAt)),store=new FileCatalogStore(snapshotFile);
 const service=new CatalogService(store,history,runner,{identityStore:identity,holderReader:new MixedHolderReader(holders,access),managedWithdrawals:access,now:()=>new Date(FIXTURE_AT)});
 const app=createCatalogApp({service,readOnly});await service.sync();
 return {directory,identityFile,historyFile,snapshotFile,identityBefore,historyBefore,history,store,managedStore,fixture,transport,source,service,app};
}
test("mixed catalog serves names, manager profile, legacy holders and real integrated V3 projection",async()=>{
 const s=await setup();try{
  const catalog=(await s.app.inject({url:"/v1/arkas?limit=100"})).json();assert.equal(catalog.total,2);assert.equal(catalog.items.find((a: {arkaId:string})=>a.arkaId===LEGACY).identity.displayName,"Legacy Arka · local fixture");
  const v3=catalog.items.find((a: {arkaId:string})=>a.arkaId===V3);assert.equal(v3.identity.displayName,"Managed V3 Arka · local fixture");assert.equal(v3.managedWithdrawals.version,3);
  const holders=(await s.app.inject({url:`/v1/arkas/${V3}/holders`})).json();assert.equal(holders.total,1);assert.equal(holders.items[0].holder,INVESTOR);assert.equal(holders.items[0].shares,"1000000000");assert.equal(holders.items[0].pendingShares,"400000000");assert.equal(holders.items[0].ownershipBps,10000);assert(!holders.items.some((h:{holder:string})=>h.holder===V3));
  const old=(await s.app.inject({url:`/v1/arkas/${LEGACY}/holders`})).json();assert.equal(old.managed,undefined);assert.equal(old.items[0].shares,"500000000");
  const manager=(await s.app.inject({url:`/v1/managers/${MANAGER}/identity`})).json();assert.equal(manager.displayName,"Fixture manager");
  const withdrawals=(await s.app.inject({url:`/v1/arkas/${V3}/withdrawals`})).json();assert.equal(withdrawals.total,1);assert.equal(withdrawals.items[0].owner,INVESTOR);
 }finally{await s.app.close();}
});
test("V3 sync appends history and does not rewrite any profile bytes or old runs",async()=>{
 const s=await setup();try{assert.equal(await readFile(s.identityFile,"utf8"),s.identityBefore);const after=(await s.history.read()).runs;assert.equal(after.length,3);for(const run of s.historyBefore)assert(after.some(r=>JSON.stringify(r)===JSON.stringify(run)));assert.equal((await s.managedStore.read()).records.length,1);await s.service.sync();assert.equal((await s.managedStore.read()).records.length,1);assert.equal(await readFile(s.identityFile,"utf8"),s.identityBefore);}finally{await s.app.close();}
});
test("requested, partial settlement, cancellation and paid stages retain immutable V3 histories",async()=>{
 const s=await setup();try{
  s.fixture.observation=state("partial",110);await s.service.sync();let result=(await s.app.inject({url:`/v1/arkas/${V3}/holders`})).json();assert.equal(result.items[0].shares,"800000000");assert.equal(result.items[0].claimableAssets,"200000000");assert.equal(result.items[0].positionValueDenomination,"1000000000");
  const arka=(await s.app.inject({url:`/v1/arkas/${V3}`})).json();assert.equal(arka.nav,"800000000");assert.equal(arka.assets[0].liquidBalance,"1000000000");assert.equal(arka.assets[0].netManagedAmount,"800000000");assert.equal(arka.assets[0].reservedWithdrawalBalance,"200000000");
  s.fixture.observation=state("cancelled",120);await s.service.sync();result=(await s.app.inject({url:`/v1/arkas/${V3}/holders`})).json();assert.equal(result.items[0].pendingShares,"0");assert.equal(result.items[0].freeShares,"800000000");
  s.fixture.observation=state("cancelled-paid",130);await s.service.sync();result=(await s.app.inject({url:`/v1/arkas/${V3}/holders`})).json();assert.equal(result.items[0].shares,"800000000");assert.equal(result.items[0].paidAssets,"200000000");assert.equal(result.items[0].positionValueDenomination,"800000000");
  const records=(await s.app.inject({url:`/v1/arkas/${V3}/withdrawals/history`})).json();assert.equal(records.total,4);assert.equal(records.items[0].observation.requests[0].pending_shares,"400000000");assert.equal(await readFile(s.identityFile,"utf8"),s.identityBefore);
 }finally{await s.app.close();}
});
test("reserved claimant remains in holder list with zero shares when NAV is unavailable",async()=>{
 const s=await setup();try{s.fixture.observation=state("reserved",150);await s.service.sync();const response=await s.app.inject({url:`/v1/arkas/${V3}/holders`});assert.equal(response.statusCode,200);const r=response.json();assert.equal(r.totalShares,"0");assert.equal(r.total,1);assert.equal(r.items[0].shares,"0");assert.equal(r.items[0].claimableAssets,"1000000000");assert.equal(r.items[0].positionValueDenomination,"1000000000");assert.equal(r.managed.nav,null);const metrics=(await s.app.inject({url:"/v1/metrics"})).json();assert.equal(metrics.navComplete,false);}finally{await s.app.close();}
});
test("unreadable V3 state is explicit 503, not an empty investor list, with history preserved",async()=>{
 const s=await setup();try{const before=await s.managedStore.read();s.fixture.fail=true;await s.service.sync();const list=(await s.app.inject({url:"/v1/arkas"})).json();assert.equal(list.total,2);assert.equal(list.items.find((a:{arkaId:string})=>a.arkaId===V3).identity.displayName,"Managed V3 Arka · local fixture");for(const path of ["holders","withdrawals"]){const r=await s.app.inject({url:`/v1/arkas/${V3}/${path}`});assert.equal(r.statusCode,503);assert.equal(r.json().complete,false);assert.equal(r.json().items,undefined);}assert.deepEqual(await s.managedStore.read(),before);assert.equal((await s.app.inject({url:`/v1/arkas/${V3}/withdrawals/history`})).json().total,1);assert.equal((await s.app.inject({url:`/v1/arkas/${LEGACY}/holders`})).statusCode,200);}finally{await s.app.close();}
});
test("unknown code cannot fall back to legacy holders or probe V3 methods",async()=>{
 const s=await setup();try{s.fixture.unknown=true;s.fixture.reads=0;await s.service.sync();assert.equal(s.fixture.reads,0);const r=await s.app.inject({url:`/v1/arkas/${V3}/holders`});assert.equal(r.statusCode,503);const arka=(await s.app.inject({url:`/v1/arkas/${V3}`})).json();assert.equal(arka.managedWithdrawals.version,null);}finally{await s.app.close();}
});
test("a source cannot switch identity, supply or reserve ownership during ingestion",async()=>{
 for(const change of [(o:ManagedObservation)=>o.arkaId=LEGACY,(o:ManagedObservation)=>o.wasmHash="99".repeat(32),(o:ManagedObservation)=>o.totalShares="1",(o:ManagedObservation)=>o.reservedAssets="1",(o:ManagedObservation)=>o.historyComplete=false]){const s=await setup();try{s.fixture.observation=state("requested",200);change(s.fixture.observation);await s.service.sync();assert.equal((await s.app.inject({url:`/v1/arkas/${V3}/holders`})).statusCode,503);assert.equal((await s.managedStore.read()).records.length,1);}finally{await s.app.close();}}
});
test("corrupt or foreign archive cannot be overwritten, and produces no fabricated balance",async()=>{
 const s=await setup();try{const path=join(s.directory,"managed.v3.json");await writeFile(path,JSON.stringify({schemaVersion:1,kind:"legacy-identities",records:[]}));const before=await readFile(path,"utf8");await s.service.sync();assert.equal(await readFile(path,"utf8"),before);assert.equal((await s.app.inject({url:`/v1/arkas/${V3}/holders`})).statusCode,503);assert.equal(await readFile(s.identityFile,"utf8"),s.identityBefore);}finally{await s.app.close();}
});
test("restart loads persisted V3 state and profiles without a resync or transaction",async()=>{
 const s=await setup();try{const access=new ManagedCatalogAccess(new FileManagedObservationStore(join(s.directory,"managed.v3.json")));const service=new CatalogService(new FileCatalogStore(s.snapshotFile),new FileCatalogHistoryStore(s.historyFile),new StaticCatalogSyncRunner(snapshots()),{identityStore:new FileIdentityStore(s.identityFile),holderReader:new MixedHolderReader(legacyHolders(),access),managedWithdrawals:access});const app=createCatalogApp({service,readOnly:true});try{const r=(await app.inject({url:`/v1/arkas/${V3}/holders`})).json();assert.equal(r.items[0].pendingShares,"400000000");assert.equal((await app.inject({url:`/v1/arkas/${V3}/identity`})).json().displayName,"Managed V3 Arka · local fixture");}finally{await app.close();}}finally{await s.app.close();}
});
test("preview rejects sync, profile editing and other mutations even with valid headers",async()=>{
 const s=await setup({readOnly:true});try{const before=await readFile(s.identityFile,"utf8");for(const [method,url]of [["POST","/v1/sync"],["PUT",`/v1/arkas/${V3}/identity`],["PUT",`/v1/managers/${MANAGER}/identity`],["DELETE","/v1/arkas"]]){const r=await s.app.inject({method:method as "POST",url,headers:{"x-arkafund-sync-token":"secret"},payload:{}});assert.equal(r.statusCode,405);}assert.equal(await readFile(s.identityFile,"utf8"),before);}finally{await s.app.close();}
});
test("actual RPC getter adapter feeds mixed indexer with no mutation method",async()=>{
 const s=await setup({rawSource:true});try{const r=(await s.app.inject({url:`/v1/arkas/${V3}/holders`})).json();assert.equal(r.items[0].shares,"1000000000");assert(s.transport.calls.includes("shares_of"));assert(s.transport.calls.includes("withdrawal_requests"));assert(!s.transport.calls.some(k=>/send|sign|transfer|deposit_protected/.test(k)));assert.equal((await s.app.inject({url:`/v1/arkas/${LEGACY}/holders`})).statusCode,200);}finally{await s.app.close();}
});
test("RPC adapter preserves reserved claims without NAV and rejects incomplete holder coverage",async()=>{
 const s=await setup({rawSource:true});try{s.transport.observation=state("reserved",200);await s.service.sync();let r=await s.app.inject({url:`/v1/arkas/${V3}/holders`});assert.equal(r.statusCode,200);assert.equal(r.json().items[0].claimableAssets,"1000000000");s.transport.gap=true;s.transport.observation=state("requested",210);await s.service.sync();r=await s.app.inject({url:`/v1/arkas/${V3}/holders`});assert.equal(r.statusCode,503);}finally{await s.app.close();}
});
test("immutable sidecar rejects rewinds and conflicting states at one ledger",async()=>{
 const s=await setup();try{await assert.rejects(s.managedStore.put(state("partial",99)),/NONMONOTONIC/);await assert.rejects(s.managedStore.put(state("partial",100)),/NONMONOTONIC/);await s.managedStore.put({...state(),observedAt:"2026-10-16T12:00:00.000Z"});assert.equal((await s.managedStore.read()).records.length,1);}finally{await s.app.close();}
});
test("API paginates V3 holders and requests without changing the historical archive",async()=>{
 const s=await setup();try{const r=(await s.app.inject({url:`/v1/arkas/${V3}/withdrawals?offset=1&limit=1`})).json();assert.equal(r.total,1);assert.deepEqual(r.items,[]);const h=(await s.app.inject({url:`/v1/arkas/${V3}/holders?offset=1&limit=1`})).json();assert.equal(h.total,1);assert.deepEqual(h.items,[]);assert.equal((await s.managedStore.read()).records.length,1);}finally{await s.app.close();}
});
test("legacy API responses retain the frozen synthetic R4 contract exactly",async()=>{
 const s=await setup({legacyOnly:true});
 const golden=JSON.parse(await readFile(resolve('tests/support/r4-legacy-golden.json'),'utf8'));
 try{for(const row of golden.responses){const r=await s.app.inject({url:row.url});assert.equal(r.statusCode,row.status,row.url);assert.deepEqual(r.json(),row.body,row.url);}assert.equal(s.fixture.reads,0);}finally{await s.app.close();}
});
test("integrated TypeScript projection matches the original tested model on every fixture stage",async()=>{
 const prototype=await import(pathToFileURL(resolve("tests/support/projection-reference.mjs")).href);
 for(const stage of ["requested","partial","cancelled","cancelled-paid","reserved","paid"] as const){const data={...state(stage),fundId:V3};assert.deepEqual(projectManagedInvestors(data),prototype.projectManagedInvestors(data),stage);}
});
test("reserves are excluded from V3 portfolio weights and combined dashboard contributions",async()=>{
 const s=await setup();try{
  s.fixture.observation=state("partial",110);await s.service.sync();
  const portfolio=(await s.app.inject({url:"/v1/arkas/"+V3+"/portfolio"})).json();assert.equal(portfolio.totalNavContribution,"800000000");assert.equal(portfolio.items[0].navContribution,"800000000");assert.equal(portfolio.items[0].weightBps,10000);
  const composition=(await s.app.inject({url:"/v1/dashboard/composition"})).json();assert.equal(composition.totalNav,"1300000000");assert.equal(composition.items[0].navContribution,"1300000000");
 }finally{await s.app.close();}
});
test("stale V3 observations retain their original timestamp and are labelled stale",async()=>{
 const s=await setup();try{
  const access=new ManagedCatalogAccess(s.managedStore,()=>Date.parse(s.fixture.observation.observedAt)+120001);
  const arka=(await s.service.current())!.arkas.find(a=>a.arkaId===V3)!;
  const reader=new MixedHolderReader(legacyHolders(),access),page=await reader.list(arka);
  assert.equal(page.stale,true);assert.equal(page.indexedAt,s.fixture.observation.observedAt);assert.equal(page.items[0].pendingShares,"400000000");
 }finally{await s.app.close();}
});
test("new managed endpoints are represented in the candidate OpenAPI contract",async()=>{
 const s=await setup();try{const doc=(await s.app.inject({url:"/openapi.json"})).json();assert(doc.paths["/v1/arkas/{id}/withdrawals"]);assert(doc.paths["/v1/arkas/{id}/withdrawals/history"]);assert(doc.components.schemas.ArkaHolder.properties.pendingShares);}finally{await s.app.close();}
});
test("test/preview containment refuses mainnet and the existing local Soroban node before connecting",()=>{
 assert.throws(()=>fetch("https://mainnet.sorobanrpc.com"),/NETWORK_BLOCKED/);
 assert.throws(()=>fetch("http://127.0.0.1:8000/rpc"),/NETWORK_BLOCKED/);
});
test("withdrawal histories cannot change an owner, erase requests, reopen shares or reverse payments",async()=>{
 for(const change of [(o:ManagedObservation)=>o.requests[0].owner=MANAGER,(o:ManagedObservation)=>{o.requests[0].requested_shares="500000000";o.requests[0].pending_shares="300000000";o.balances=[{owner:INVESTOR,shares:"500000000"},{owner:V3,shares:"300000000"}];},(o:ManagedObservation)=>{o.requests=[];o.balances=[{owner:INVESTOR,shares:o.totalShares}];o.reservedAssets="0";},(o:ManagedObservation)=>{o.requests[0].settled_shares="0";o.requests[0].pending_shares="400000000";o.requests[0].claimable_assets="0";o.reservedAssets="0";o.balances=[{owner:INVESTOR,shares:"400000000"},{owner:V3,shares:"400000000"}];}]){
  const s=await setup();try{await s.managedStore.put(state("partial",110));const next=state("partial",120);change(next);await assert.rejects(s.managedStore.put(next),/MANAGED_/);assert.equal((await s.managedStore.read()).records.length,2);}finally{await s.app.close();}
 }
 const s=await setup();try{await s.managedStore.put(state("paid",110));const next=state("requested",120);await assert.rejects(s.managedStore.put(next),/STATE_REWOUND/);assert.equal((await s.managedStore.read()).records.length,2);}finally{await s.app.close();}
});
test("concurrent append calls on the sole writer preserve every observation",async()=>{
 const s=await setup();try{await Promise.all([s.managedStore.put(state("partial",110)),s.managedStore.put(state("cancelled",120)),s.managedStore.put(state("cancelled-paid",130))]);assert.equal((await s.managedStore.read()).records.length,4);}finally{await s.app.close();}
});
test("six synthetic legacy identities including Noah remain V2 while adding a fictitious V3 Arka",async()=>{
 const file=resolve("tests/support/legacy-identities.synthetic.json"),before=await readFile(file,"utf8"),recorded=JSON.parse(before);
 assert.equal(recorded.counts.legacy,6);assert.equal(recorded.catalogIdentity.complete,true);
 const directory=await mkdtemp(join(tmpdir(),"arka-recorded-identities-")),identity=new FileIdentityStore(join(directory,"identity.json")),archive=identities(recorded.observedAt);
 const existingIds=new Set<string>();const existingManagers=new Set<string>();
 const entries=recorded.funds.map((fund: {id:string;catalogIdentity:{manager:string;arkaProfile:object;managerProfile:object}})=>{
  const manager=fund.catalogIdentity.manager;existingIds.add(fund.id);existingManagers.add(manager);
  archive.arkas[fund.id]={...archive.arkas[LEGACY],...fund.catalogIdentity.arkaProfile,arkaId:fund.id,manager,updatedBy:manager};
  archive.managers[manager]={...archive.managers[MANAGER],...fund.catalogIdentity.managerProfile,manager,updatedBy:manager};
  // Financial values are fixtures, NOT a replay or new valuation of mainnet funds.
  return {...baseEntries()[0],arkaId:fund.id,manager,curated:(fund.catalogIdentity.arkaProfile as {trustState?:string}).trustState==="curated"};
 });
 assert.equal(existingManagers.size,2);delete archive.arkas[LEGACY];await identity.write(archive);
 const identityBefore=await readFile(join(directory,"identity.json"),"utf8"),history=new FileCatalogHistoryStore(join(directory,"history.json"));
 const oldRun=buildSnapshot(entries,[],"2026-10-15T10:00:00.000Z");await history.append(oldRun);const historyBefore=(await history.read()).runs;
 const managedStore=new FileManagedObservationStore(join(directory,"managed.v3.json")),access=new ManagedCatalogAccess(managedStore),source:ManagedSnapshotSource={identify:async entry=>({kind:existingIds.has(entry.arkaId)?"legacy":"v3",codeHash:existingIds.has(entry.arkaId)?LEGACY_HASH:V3_HASH,ledger:100}),read:async entry=>{assert.equal(entry.arkaId,V3);return state();}};
 const combined=new StaticCatalogSyncRunner(()=>buildSnapshot([...entries,baseEntries()[1]],[],FIXTURE_AT));
 const service=new CatalogService(new FileCatalogStore(join(directory,"snapshot.json")),history,new ManagedCatalogSyncRunner(combined,source,managedStore),{identityStore:identity,holderReader:new MixedHolderReader(legacyHolders(),access),managedWithdrawals:access});
 const app=createCatalogApp({service,readOnly:true});
 try{await service.sync();const catalog=(await app.inject({url:"/v1/arkas?limit=100"})).json();assert.equal(catalog.total,7);
  for(const fund of recorded.funds){const row=catalog.items.find((a:{arkaId:string})=>a.arkaId===fund.id);assert(row);assert.equal(row.managedWithdrawals,undefined);for(const [key,value]of Object.entries(fund.catalogIdentity.arkaProfile))assert.deepEqual(row.identity[key],value);const manager=(await app.inject({url:"/v1/managers/"+fund.catalogIdentity.manager+"/identity"})).json();for(const [key,value]of Object.entries(fund.catalogIdentity.managerProfile))assert.deepEqual(manager[key],value);}
  assert(catalog.items.some((a:{identity:{displayName:string}})=>a.identity.displayName==="Noah’s Ark"));
  assert.equal(await readFile(join(directory,"identity.json"),"utf8"),identityBefore);for(const run of historyBefore)assert((await history.read()).runs.some(r=>JSON.stringify(r)===JSON.stringify(run)));assert.equal((await managedStore.read()).records.length,1);assert.equal(await readFile(file,"utf8"),before);
 }finally{await app.close();}
});
