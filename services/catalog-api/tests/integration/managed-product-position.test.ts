import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,readFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {CatalogService,FileCatalogStore,FileCatalogHistoryStore,FileIdentityStore,StaticCatalogSyncRunner,ManagedCatalogSyncRunner,FileManagedObservationStore,ManagedCatalogAccess,RpcManagedSnapshotSource,buildSnapshot,createCatalogApp} from "../../src/index.js";
import {baseEntries,identities,legacyHolders,FixtureManagedTransport,state,V3,LEGACY,INVESTOR,MANAGER,V3_HASH,LEGACY_HASH} from "../support/managedFixture.js";
async function setup(){
 const directory=await mkdtemp(join(tmpdir(),"arka-integrated-position-")),transport=new FixtureManagedTransport();
 const history=new FileCatalogHistoryStore(join(directory,"history.json")),identity=new FileIdentityStore(join(directory,"identity.json"));
 await identity.write(identities());const before=await readFile(join(directory,"identity.json"),"utf8");
 const records=new FileManagedObservationStore(join(directory,"managed.json"));
 const access=new ManagedCatalogAccess(records,()=>Date.parse(transport.observation.observedAt));
 const source=new RpcManagedSnapshotSource(transport,legacyHolders(),{legacy:[LEGACY_HASH],v3:[V3_HASH]});
 const runner=new ManagedCatalogSyncRunner(new StaticCatalogSyncRunner(()=>buildSnapshot(baseEntries(transport.observation.observedAt,transport.observation),[],transport.observation.observedAt)),source,records);
 const service=new CatalogService(new FileCatalogStore(join(directory,"snapshot.json")),history,runner,{identityStore:identity,managedWithdrawals:access});
 const app=createCatalogApp({service,readOnly:true});await service.sync();
 return {directory,transport,service,records,access,app,before};
}
test("owner position joins protected deposit capability, pending shares and reserved money from one observation",async()=>{
 const s=await setup();try{for(const [stage,ledger]of [["requested",100],["partial",110],["cancelled",120],["cancelled-paid",130]] as const){
  s.transport.observation=state(stage,ledger);await s.service.sync();
  const r=await s.app.inject({url:`/v1/arkas/${V3}/managed-position?owner=${INVESTOR}`});
  assert.equal(r.statusCode,200);assert.equal(r.headers["cache-control"],"no-store");
  const d=r.json();assert.equal(d.complete,true);assert.equal(d.stale,false);assert.equal(d.depositProtectionVersion,1);assert.equal(d.position.owner,INVESTOR);assert.equal(d.ledger,ledger);
  assert.equal(BigInt(d.position.economicSharesRaw),BigInt(d.position.freeSharesRaw)+BigInt(d.position.pendingSharesRaw));
  assert.equal(BigInt(d.position.claimableAssetsRaw),d.requests.reduce((n:bigint,r:{claimable_assets:string})=>n+BigInt(r.claimable_assets),0n));
 }assert.equal(await readFile(join(s.directory,"identity.json"),"utf8"),s.before);assert.equal((await s.records.read()).records.length,4);
 }finally{await s.app.close();}
});
test("unprotected or unavailable deposit capability never hides verified withdrawal rights",async()=>{
 for(const missing of [false,true]){const s=await setup();try{s.transport.badVersion=true;
  if(missing){const read=s.transport.read.bind(s.transport);s.transport.read=async(id,method,args)=>{if(method==="deposit_protection_version")throw Error("getter unavailable");return read(id,method,args);};}
  s.transport.observation=state("partial",110);await s.service.sync();
  const r=await s.app.inject({url:`/v1/arkas/${V3}/managed-position?owner=${INVESTOR}`});assert.equal(r.statusCode,200);
  assert.equal(r.json().depositProtectionVersion,null);assert.equal(r.json().position.claimableAssetsRaw,"200000000");
 }finally{await s.app.close();}}
});
test("reserved-only owner survives unavailable NAV and supply zero",async()=>{
 const s=await setup();try{s.transport.observation=state("reserved",140);await s.service.sync();
 const d=(await s.app.inject({url:`/v1/arkas/${V3}/managed-position?owner=${INVESTOR}`})).json();
 assert.equal(d.nav,null);assert.equal(d.position.economicSharesRaw,"0");assert.equal(d.position.claimableAssetsRaw,"1000000000");assert.equal(d.position.positionValueRaw,"1000000000");
 }finally{await s.app.close();}
});
test("a capability probe failure at the same ledger pauses deposits without rewriting or hiding withdrawal history",async()=>{
 const s=await setup();try{
  s.transport.observation=state("partial",110);await s.service.sync();
  const before=await s.records.read();
  const read=s.transport.read.bind(s.transport);
  s.transport.read=async(id,method,args)=>{if(method==="deposit_protection_version")throw Error("temporary getter failure");return read(id,method,args);};
  await s.service.sync();
  const r=await s.app.inject({url:`/v1/arkas/${V3}/managed-position?owner=${INVESTOR}`});
  assert.equal(r.statusCode,200);assert.equal(r.json().depositProtectionVersion,null);
  assert.equal(r.json().position.claimableAssetsRaw,"200000000");
  assert.deepEqual(await s.records.read(),before);
  s.transport.read=read;await s.service.sync();
  const recovered=(await s.app.inject({url:`/v1/arkas/${V3}/managed-position?owner=${INVESTOR}`})).json();
  assert.equal(recovered.depositProtectionVersion,1);assert.deepEqual(await s.records.read(),before);
 }finally{await s.app.close();}
});
test("public owner lookup filters other investors and never confers manager permissions",async()=>{
 const s=await setup();try{const d=(await s.app.inject({url:`/v1/arkas/${V3}/managed-position?owner=${MANAGER}`})).json();
 assert.deepEqual(d.requests,[]);assert.equal(d.position.positionValueRaw,"0");assert.equal(d.position.freeSharesRaw,"0");assert.equal(d.owner,MANAGER);
 for(const query of ["","?owner=secret","?owner="+INVESTOR+"&url=https://evil.example"]){assert.equal((await s.app.inject({url:`/v1/arkas/${V3}/managed-position${query}`})).statusCode,400);}
 assert.equal((await s.app.inject({url:`/v1/arkas/${LEGACY}/managed-position?owner=${INVESTOR}`})).statusCode,404);
 }finally{await s.app.close();}
});
test("unknown code or incomplete state is 503, not zero; prior history is retained",async()=>{
 const s=await setup();try{const before=await s.records.read();s.transport.badCode=true;await s.service.sync();
 const r=await s.app.inject({url:`/v1/arkas/${V3}/managed-position?owner=${INVESTOR}`});assert.equal(r.statusCode,503);assert.equal(r.json().complete,false);assert.equal(r.json().position,undefined);
 assert.deepEqual(await s.records.read(),before);assert.equal((await s.app.inject({method:"POST",url:`/v1/arkas/${V3}/managed-position?owner=${INVESTOR}`})).statusCode,405);
 }finally{await s.app.close();}
});
test("stale observations keep their original timestamp rather than claiming to be current",async()=>{
 const s=await setup();try{const arka=(await s.service.current())!.arkas.find(a=>a.arkaId===V3)!;
 const access=new ManagedCatalogAccess(s.records,()=>Date.parse(s.transport.observation.observedAt)+120001);
 const d=await access.position(arka,INVESTOR);assert.equal(d.stale,true);assert.equal(d.indexedAt,s.transport.observation.observedAt);
 }finally{await s.app.close();}
});
