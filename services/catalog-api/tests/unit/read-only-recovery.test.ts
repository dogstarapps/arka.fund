import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,readFile,writeFile,stat,mkdir,unlink} from "node:fs/promises";
import {spawnSync} from "node:child_process";
import {join} from "node:path";
import {tmpdir} from "node:os";
import {Account,Contract,TransactionBuilder,Keypair} from "@stellar/stellar-sdk";
import {ReadOnlyRpcGateway,READ_NETWORK,assertReadEnvelope,DurableCatalogRepository,contentHash,collectHistoricalEvents,eventCursorLedger,DurableManagedRequests,RpcManagedSnapshotSource,RpcHolderReader,CatalogService,FileCatalogStore,FileCatalogHistoryStore,FileIdentityStore,StaticCatalogSyncRunner,ManagedCatalogSyncRunner,FileManagedObservationStore,ManagedCatalogAccess,MixedHolderReader,createCatalogApp} from "../../src/index.js";
import {V3,V3_HASH,LEGACY_HASH,INVESTOR,baseEntries,legacyHolders,FixtureManagedTransport,FixtureManagedSource,request,identities,snapshots,state} from "../support/managedFixture.js";
import {mergeHistoricalHolderCandidates} from "../../src/historicalHolders.js";
const folder=()=>mkdtemp(join(tmpdir(),"arka-read-only-recovery-"));
const transaction=(method:string)=>new TransactionBuilder(new Account(INVESTOR,"0"),{fee:"100",networkPassphrase:READ_NETWORK}).addOperation(new Contract(V3).call(method)).setTimeout(30).build();
// Cryptographic cases require the explicit contained ephemeral-key test profile.
const cryptoTest = process.env.ARKA_EPHEMERAL_SIGNATURE_TESTS === '1' ? test : test.skip;
cryptoTest("RPC gate denies sends, restores, batches, signed transactions and mutation methods before I/O",async()=>{
 let calls=0;const gate=new ReadOnlyRpcGateway(async()=>{calls++;return new Response("{}");});
 for(const method of ["sendTransaction","restoreFootprint","getTransaction","unknown"])await assert.rejects(gate.forward({jsonrpc:"2.0",id:1,method,params:{}}),/DENIED/);
 await assert.rejects(gate.forward([{jsonrpc:"2.0",id:1,method:"getHealth"}]),/BATCH/);
 for(const method of ["deposit_protected","claim_withdrawal","set_manager","request_withdrawal"])await assert.rejects(gate.forward({jsonrpc:"2.0",id:1,method:"simulateTransaction",params:{transaction:transaction(method).toXDR()}}),/GETTER_DENIED/);
 const signed=transaction("total_shares");signed.sign(Keypair.random());await assert.rejects(gate.forward({jsonrpc:"2.0",id:1,method:"simulateTransaction",params:{transaction:signed.toXDR()}}),/TRANSACTION_DENIED/);
 assert.equal(calls,0);assert.equal(gate.stats().submittedTransactions,0);
});
test("RPC gate forwards only allowlisted reads to the pinned HTTPS endpoint",async()=>{
 const targets:string[]=[];const gate=new ReadOnlyRpcGateway(async(url,init)=>{targets.push(String(url));assert.equal(init?.redirect,"error");const body=JSON.parse(String(init?.body));return new Response(JSON.stringify({jsonrpc:"2.0",id:body.id,result:{status:"healthy"}}));});
 for(const method of ["getHealth","getNetwork","getLatestLedger","getLedgerEntries","getEvents"])await gate.forward({jsonrpc:"2.0",id:1,method,params:{}});
 assertReadEnvelope({jsonrpc:"2.0",id:2,method:"simulateTransaction",params:{transaction:transaction("total_shares").toXDR()}});
 assert(targets.every(url=>url==="https://mainnet.sorobanrpc.com"));
});
test("SDK null params are accepted only for no-argument reads and 429 is retried within bounds",async()=>{
 assertReadEnvelope({jsonrpc:"2.0",id:1,method:"getHealth",params:null});assertReadEnvelope({jsonrpc:"2.0",id:1,method:"getNetwork",params:null});assert.throws(()=>assertReadEnvelope({jsonrpc:"2.0",id:1,method:"getEvents",params:null}),/PARAMS_INVALID/);
 let attempts=0;const gateway=new ReadOnlyRpcGateway(async()=>++attempts===1?new Response("",{status:429}):new Response(JSON.stringify({jsonrpc:"2.0",id:1,result:{status:"healthy"}})));
 await gateway.forward({jsonrpc:"2.0",id:1,method:"getHealth",params:null});assert.equal(attempts,2);assert.equal(gateway.stats().failures.READ_RPC_HTTP_429,1);
});
test("loopback SDK bridge rejects mutation requests without forwarding and closes cleanly",async()=>{
 let sent=0;const gate=new ReadOnlyRpcGateway(async(_url,init)=>{sent++;const body=JSON.parse(String(init?.body));return new Response(JSON.stringify({jsonrpc:"2.0",id:body.id,result:{status:"healthy"}}));});const url=await gate.listen();
 try{assert.equal((await fetch(url,{method:"POST",body:JSON.stringify({jsonrpc:"2.0",id:1,method:"sendTransaction"})})).status,403);assert.equal(sent,0);assert.equal((await fetch(url)).status,405);assert.equal((await fetch(url,{method:"POST",body:JSON.stringify({jsonrpc:"2.0",id:2,method:"getHealth"})})).status,200);assert.equal(sent,1);}finally{await gate.close();}
});
test("atomic generation publishes identity, NAV history and V3 ownership together",async()=>{
 const directory=await folder(),repo=new DurableCatalogRepository(join(directory,"repository"),READ_NETWORK,V3);
 const data={files:{identity:{name:"Original"},history:["old"],snapshot:{nav:"80"},withdrawals:{pending:"20",reserved:"20"}}};const hash=await repo.commit(data,100);data.files.identity.name="Changed outside";
 assert.equal((await repo.current())!.hash,hash);assert.equal(((await repo.current())!.generation.data.files as typeof data.files).identity.name,"Original");
 await repo.commit({files:{identity:{name:"Original"},history:["old","new"],withdrawals:{pending:"0",reserved:"40"}}},110);
 assert.deepEqual((await repo.chain((await repo.current())!.hash)).map(item=>item.generation.ledger),[110,100]);
});
test("crash after writing an object leaves the old complete generation published",async()=>{
 const directory=await folder(),repo=new DurableCatalogRepository(join(directory,"repository"),READ_NETWORK,V3),first=await repo.commit({claims:"20",identity:"unchanged"},100);
 await assert.rejects(repo.commit({claims:"0",identity:"uncommitted"},110,"after-object"),/INJECTED_CRASH/);const restarted=new DurableCatalogRepository(repo.directory,READ_NETWORK,V3);assert.equal((await restarted.current())!.hash,first);assert.equal((await restarted.current())!.generation.data.claims,"20");await restarted.commit({claims:"10",identity:"unchanged"},120);assert.equal((await restarted.current())!.generation.sequence,2);
});
test("backup restores every generation to a new directory without modifying the source",async()=>{
 const directory=await folder(),repo=new DurableCatalogRepository(join(directory,"repository"),READ_NETWORK,V3);await repo.commit({names:["Noah’s Ark"],history:[1],claims:"20"},100);const hash=await repo.commit({names:["Noah’s Ark"],history:[1,2],claims:"10"},110),file=join(directory,"backup.json"),backup=await repo.backup(file),pointer=await readFile(join(repo.directory,"CURRENT.json"),"utf8");
 const recovered=await DurableCatalogRepository.restore(file,backup.hash,join(directory,"recovered"),READ_NETWORK,V3);assert.equal((await recovered.current())!.hash,hash);assert.deepEqual((await recovered.current())!.generation.data.history,[1,2]);assert.equal((await recovered.chain(hash)).length,2);assert.equal(await readFile(join(repo.directory,"CURRENT.json"),"utf8"),pointer);
 await assert.rejects(DurableCatalogRepository.restore(file,backup.hash,repo.directory,READ_NETWORK,V3),/TARGET_EXISTS/);
});
test("bad backup digest, wrong network and missing parent cannot be restored",async()=>{
 const directory=await folder(),repo=new DurableCatalogRepository(join(directory,"repository"),READ_NETWORK,V3);await repo.commit({claims:"20"},100);await repo.commit({claims:"10"},110);const file=join(directory,"backup.json"),backup=await repo.backup(file);
 await assert.rejects(DurableCatalogRepository.restore(file,"00".repeat(32),join(directory,"wrong-hash"),READ_NETWORK,V3),/HASH_MISMATCH/);
 await assert.rejects(DurableCatalogRepository.restore(file,backup.hash,join(directory,"wrong-network"),"testnet",V3),/BACKUP_INVALID/);
 const body=JSON.parse(await readFile(file,"utf8"));body.objects.pop();const incomplete=JSON.stringify(body);const malformed=join(directory,"incomplete.json");await writeFile(malformed,incomplete);await assert.rejects(DurableCatalogRepository.restore(malformed,contentHash(incomplete),join(directory,"missing-parent"),READ_NETWORK,V3),/CHAIN_INCOMPLETE/);await assert.rejects(stat(join(directory,"missing-parent")),{code:"ENOENT"});
});
test("generation corruption is not overwritten and ledger rewinds are rejected",async()=>{
 const directory=await folder(),repo=new DurableCatalogRepository(join(directory,"repository"),READ_NETWORK,V3),hash=await repo.commit({claims:"20"},100);await assert.rejects(repo.commit({claims:"0"},99),/LEDGER_REWIND/);const object=join(repo.directory,"objects",hash+".json");await writeFile(object,"corrupt");await assert.rejects(repo.current(),/HASH_MISMATCH/);await assert.rejects(repo.commit({claims:"0"},110),/HASH_MISMATCH/);assert.equal(await readFile(object,"utf8"),"corrupt");
});
test("concurrent local commits retain all generations on the sole writer",async()=>{
 const directory=await folder(),repo=new DurableCatalogRepository(join(directory,"repository"),READ_NETWORK,V3);await Promise.all([repo.commit({n:1},100),repo.commit({n:2},101),repo.commit({n:3},102)]);assert.deepEqual((await repo.chain((await repo.current())!.hash)).map(r=>r.generation.data.n),[3,2,1]);
});
test("historical event pagination resumes saved cursors after restart",async()=>{
 let checkpoint:any,calls=0;const transport={events:async(_start:number,_end:number,cursor:string|null)=>{calls++;return cursor?{events:[],cursor:null,scannedThrough:20}:{events:[{id:"event-1",ledger:10},{id:"event-2",ledger:11}],cursor:"next",scannedThrough:9};}};
 const first=await collectHistoricalEvents({network:READ_NETWORK,contracts:[V3],fromLedger:10,oldestLedger:10,latestLedger:20,transport,maxPages:1,pageSize:2},async s=>{checkpoint=s;});assert.equal(first.complete,false);assert.equal(first.scannedThrough,9);assert.equal(first.cursor,"next");
 const resumed=await collectHistoricalEvents({network:READ_NETWORK,contracts:[V3],fromLedger:10,oldestLedger:10,latestLedger:20,transport,previous:JSON.parse(JSON.stringify(checkpoint)),pageSize:2},async()=>{});assert.equal(resumed.complete,true);assert.equal(resumed.events.length,2);assert.equal(resumed.scannedThrough,20);assert.equal(calls,2);
});
test("RPC retention gaps are explicit and never turn into a complete lifetime history",async()=>{
 const transport={events:async(_start:number,end:number)=>({events:[],cursor:null,scannedThrough:end})},state=await collectHistoricalEvents({network:READ_NETWORK,contracts:[V3],fromLedger:1,oldestLedger:50,latestLedger:100,transport},async()=>{});assert.deepEqual(state.gap,{from:1,to:49});assert.equal(state.scannedThrough,100);assert.equal(state.complete,false);const later=await collectHistoricalEvents({network:READ_NETWORK,contracts:[V3],fromLedger:1,oldestLedger:60,latestLedger:110,previous:state,transport},async()=>{});assert.deepEqual(later.gap,{from:1,to:49});assert.equal(later.complete,false);
});
test("new retention gap while offline is detected rather than skipping missing ledgers",async()=>{
 const transport={events:async(_start:number,end:number)=>({events:[],cursor:null,scannedThrough:end})},state=await collectHistoricalEvents({network:READ_NETWORK,contracts:[V3],fromLedger:10,oldestLedger:10,latestLedger:20,transport},async()=>{});const later=await collectHistoricalEvents({network:READ_NETWORK,contracts:[V3],fromLedger:10,oldestLedger:25,latestLedger:30,previous:state,transport},async()=>{});assert.deepEqual(later.gap,{from:21,to:24});assert.equal(later.complete,false);
});
test("stalled cursors and conflicting historical events fail closed",async()=>{
 const input={network:READ_NETWORK,contracts:[V3],fromLedger:10,oldestLedger:10,latestLedger:20,pageSize:1};await assert.rejects(collectHistoricalEvents({...input,transport:{events:async()=>({events:[{id:"same",ledger:10}],cursor:"stuck",scannedThrough:9})}},async()=>{}),/CURSOR_STALLED/);
 let calls=0;await assert.rejects(collectHistoricalEvents({...input,transport:{events:async()=>({events:[{id:"same",ledger:calls++?11:10}],cursor:String(calls),scannedThrough:9})}},async()=>{}),/EVENT_CONFLICT/);
});
test("managed request backfill resumes instead of starting again from request one",async()=>{
 const directory=await folder(),rows=Array.from({length:100},(_,i)=>request({id:String(i+1),pending_shares:"0",cancelled_shares:"400000000"})),starts:number[]=[];
 const transport:any={read:async(_id:string,_method:string,args:unknown[])=>{const start=Number(args[0]);starts.push(start);return rows.slice(start-1,start-1+Number(args[1]));}};
 await assert.rejects(new DurableManagedRequests(directory,READ_NETWORK,1).read({id:V3,hash:V3_HASH,next:101n,ledger:100,transport}),/BACKFILL_PENDING/);
 const result=await new DurableManagedRequests(directory,READ_NETWORK,8).read({id:V3,hash:V3_HASH,next:101n,ledger:110,transport});assert.equal(result.length,100);assert.deepEqual(starts,[1,33,65,97]);
});
test("cached terminal requests survive expiry but missing live obligations block publication",async()=>{
 const directory=await folder();let missing=false,reads=0;const transport:any={read:async()=>{reads++;return missing?[]:[request({pending_shares:"0",cancelled_shares:"400000000"})];}};
 const store=new DurableManagedRequests(directory,READ_NETWORK);await store.read({id:V3,hash:V3_HASH,next:2n,ledger:100,transport});missing=true;reads=0;assert.equal((await store.read({id:V3,hash:V3_HASH,next:2n,ledger:110,transport})).length,1);assert.equal(reads,0);
 const other=await folder();missing=false;transport.read=async()=>missing?[]:[request()];await new DurableManagedRequests(other,READ_NETWORK).read({id:V3,hash:V3_HASH,next:2n,ledger:100,transport});missing=true;await assert.rejects(new DurableManagedRequests(other,READ_NETWORK).read({id:V3,hash:V3_HASH,next:2n,ledger:110,transport}),/ACTIVE_REQUEST_MISSING/);
});
test("managed history cannot cross a contract upgrade or change a recorded owner",async()=>{
 const directory=await folder();let owner=INVESTOR;const transport:any={read:async()=>[request({owner})]};const store=new DurableManagedRequests(directory,READ_NETWORK);await store.read({id:V3,hash:V3_HASH,next:2n,ledger:100,transport});await assert.rejects(store.read({id:V3,hash:"99".repeat(32),next:2n,ledger:110,transport}),/CHECKPOINT_INVALID/);owner=baseEntries()[1].manager;await assert.rejects(store.read({id:V3,hash:V3_HASH,next:2n,ledger:110,transport}),/IDENTITY_CHANGED/);
});
test("resumable request history is used by the actual V3 source with reconciliation",async()=>{
 const directory=await folder(),transport=new FixtureManagedTransport(),source=new RpcManagedSnapshotSource(transport,legacyHolders(),{legacy:[LEGACY_HASH],v3:[V3_HASH]},undefined,new DurableManagedRequests(directory,READ_NETWORK));const arka=baseEntries()[1],identity=await source.identify(arka),observation=await source.read(arka,identity);assert.equal(observation.historyComplete,true);assert.equal(observation.requests[0].owner,INVESTOR);assert.equal(observation.totalShares,"1000000000");
});
test("a killed local writer restarts from the last published generation",async()=>{
 const directory=await folder(),repo=new DurableCatalogRepository(join(directory,"repository"),READ_NETWORK,V3),first=await repo.commit({reserved:"20",name:"Original"},100);
 const source="import {DurableCatalogRepository} from "+JSON.stringify(new URL("../../src/index.js",import.meta.url).href)+";const r=new DurableCatalogRepository("+JSON.stringify(repo.directory)+","+JSON.stringify(READ_NETWORK)+","+JSON.stringify(V3)+");try{await r.commit({reserved:\"0\",name:\"unpublished\"},110,\"after-object\");}catch{process.kill(process.pid,\"SIGKILL\");}";
 const child=spawnSync(process.execPath,["--import","./scripts/no-network.mjs","--input-type=module","-e",source],{cwd:process.cwd(),encoding:"utf8",timeout:15000});assert.equal(child.signal,"SIGKILL");assert.equal((await new DurableCatalogRepository(repo.directory,READ_NETWORK,V3).current())!.hash,first);assert.equal((await repo.current())!.generation.data.reserved,"20");
});
test("a missing publication pointer does not silently reinitialize archived generations",async()=>{
 const directory=await folder(),repo=new DurableCatalogRepository(join(directory,"repository"),READ_NETWORK,V3);await repo.commit({name:"Original"},100);await unlink(join(repo.directory,"CURRENT.json"));await assert.rejects(repo.current(),/POINTER_MISSING/);await assert.rejects(repo.commit({name:"Replacement"},110),/POINTER_MISSING/);
});
test("restored mixed API keeps legacy names, NAV history and V3 pending/claimable ownership",async()=>{
 const directory=await folder(),managed=new FileManagedObservationStore(join(directory,"managed.v3.json")),fixture=new FixtureManagedSource(),runner=new ManagedCatalogSyncRunner(new StaticCatalogSyncRunner(snapshots()),fixture,managed),repo=new DurableCatalogRepository(join(directory,"repository"),READ_NETWORK,V3);
 const requested=await runner.run();await repo.commit({files:{"snapshot.json":requested,"identity.json":identities(),"history.json":{schemaVersion:3,retentionLimit:365,runs:[requested]},"managed.v3.json":JSON.parse(await readFile(join(directory,"managed.v3.json"),"utf8"))}},100);
 fixture.observation=state("partial",110);const partial=await runner.run();const files={"snapshot.json":partial,"identity.json":identities(),"history.json":{schemaVersion:3,retentionLimit:365,runs:[requested,partial]},"managed.v3.json":JSON.parse(await readFile(join(directory,"managed.v3.json"),"utf8"))};await repo.commit({files},110);const backupFile=join(directory,"backup.json"),backup=await repo.backup(backupFile),restored=await DurableCatalogRepository.restore(backupFile,backup.hash,join(directory,"restored"),READ_NETWORK,V3),current=(await restored.current())!;
 const view=join(directory,"view");await mkdir(view);for(const [name,body]of Object.entries(current.generation.data.files as Record<string,unknown>))await writeFile(join(view,name),JSON.stringify(body));
 const access=new ManagedCatalogAccess(new FileManagedObservationStore(join(view,"managed.v3.json"))),service=new CatalogService(new FileCatalogStore(join(view,"snapshot.json")),new FileCatalogHistoryStore(join(view,"history.json")),new StaticCatalogSyncRunner(partial),{identityStore:new FileIdentityStore(join(view,"identity.json")),holderReader:new MixedHolderReader(legacyHolders(),access),managedWithdrawals:access}),app=createCatalogApp({service,readOnly:true});
 try{const catalog=(await app.inject({url:"/v1/arkas"})).json();assert.equal(catalog.total,2);assert(catalog.items.some((row:any)=>row.identity.displayName==="Legacy Arka · local fixture"));const holder=(await app.inject({url:"/v1/arkas/"+V3+"/holders"})).json().items[0];assert.equal(holder.pendingShares,"200000000");assert.equal(holder.claimableAssets,"200000000");assert.equal(holder.positionValueDenomination,"1000000000");assert.equal((await app.inject({url:"/v1/arkas/"+V3+"/withdrawals/history"})).json().total,2);assert.equal((await service.history()).runs.length,2);assert.equal((await app.inject({method:"POST",url:"/v1/sync"})).statusCode,405);}finally{await app.close();}
});
test("more than 4096 terminal requests can be retained without rescanning expired storage",async()=>{
 const directory=await folder(),rows=Array.from({length:4097},(_,index)=>request({id:String(index+1),pending_shares:"0",cancelled_shares:"400000000"})),repo=new DurableCatalogRepository(join(directory,V3),READ_NETWORK,V3);
 await repo.commit({requests:{schemaVersion:1,arkaId:V3,wasmHash:V3_HASH,nextStart:"4098",rows}},100);
 let reads=0;const transport:any={read:async()=>{reads++;throw Error("expired fixture");}};const recovered=await new DurableManagedRequests(directory,READ_NETWORK).read({id:V3,hash:V3_HASH,next:4098n,ledger:110,transport});assert.equal(recovered.length,4097);assert.equal(reads,0);
});
test("a missing request page cannot advance a durable backfill checkpoint",async()=>{
 const directory=await folder(),transport:any={read:async()=>[request({id:"2"})]};await assert.rejects(new DurableManagedRequests(directory,READ_NETWORK).read({id:V3,hash:V3_HASH,next:2n,ledger:100,transport}),/HISTORY_GAP/);assert.equal(await new DurableCatalogRepository(join(directory,V3),READ_NETWORK,V3).current(),null);
});
test("empty RPC pages advance only to the cursor watermark, not to the requested head",async()=>{
 let calls=0;const transport={events:async()=>({events:[],cursor:"cursor-"+(++calls),scannedThrough:calls===1?19:30})};const first=await collectHistoricalEvents({network:READ_NETWORK,contracts:[V3],fromLedger:10,oldestLedger:10,latestLedger:30,transport,maxPages:1},async()=>{});assert.equal(first.complete,false);assert.equal(first.scannedThrough,19);const resumed=await collectHistoricalEvents({network:READ_NETWORK,contracts:[V3],fromLedger:10,oldestLedger:10,latestLedger:30,previous:first,transport},async()=>{});assert.equal(resumed.complete,true);assert.equal(resumed.scannedThrough,30);
});
test("RPC event cursor decoding respects partial ledgers and sentinel boundaries",()=>{
 assert.equal(eventCursorLedger("0278637519451455487-4294967295",64986312),64875352);assert.equal(eventCursorLedger(String((10n<<32n)|4294967295n)+"-4294967295",20),10);assert.equal(eventCursorLedger(String((10n<<32n)|1n)+"-3",20),9);assert.throws(()=>eventCursorLedger("invalid",20),/CURSOR_INVALID/);
});
test("legacy holder event discovery also continues past empty 10000-ledger RPC windows",async()=>{
 const directory=await folder(),reader=new RpcHolderReader({rpcUrl:"http://127.0.0.1:9999",allowHttp:true,networkPassphrase:READ_NETWORK,archiveFile:join(directory,"holders.json")});let calls=0;
 (reader as any).server={getEvents:async()=>({events:[],latestLedger:30,cursor:String((BigInt(++calls===1?19:30)<<32n)|4294967295n)+"-4294967295"})};
 const result=await (reader as any).fetchEvents([V3],10,30);assert.equal(calls,2);assert.equal(result.truncated,false);
});
test("legacy holder discovery cannot label an unvisited range complete when its page budget ends",async()=>{
 const directory=await folder(),reader=new RpcHolderReader({rpcUrl:"http://127.0.0.1:9999",allowHttp:true,networkPassphrase:READ_NETWORK,archiveFile:join(directory,"holders.json"),maxPages:1});
 (reader as any).server={getEvents:async()=>({events:[],latestLedger:30,cursor:String((19n<<32n)|4294967295n)+"-4294967295"})};const result=await (reader as any).fetchEvents([V3],10,30);assert.equal(result.truncated,true);
});
test("historical evidence seeds addresses but never imports stale balances or advances coverage",async()=>{
 const arka=baseEntries()[1],page=await legacyHolders().list(arka),archive={schemaVersion:1,entries:[{arkaId:V3,candidates:[],lastIndexedLedger:100,coverageFromLedger:90,complete:true}]},before=structuredClone(archive),result=mergeHistoricalHolderCandidates(archive,page,arka);
 assert.deepEqual(archive,before);assert.equal(result.added,1);assert.equal(result.archive.entries[0].complete,false);assert.equal(result.archive.entries[0].lastIndexedLedger,100);assert.equal(result.archive.entries[0].coverageFromLedger,90);assert.equal(result.archive.entries[0].candidates[0].shares,undefined);assert.equal(result.archive.entries[0].candidates[0].holder,INVESTOR);
 assert.throws(()=>mergeHistoricalHolderCandidates(archive,{...page,shareToken:V3},arka),/INVALID/);assert.throws(()=>mergeHistoricalHolderCandidates(archive,{...page,indexedAt:"2999-01-01T00:00:00Z"},arka),/INVALID/);
});
test("restored published V3 observations rehydrate lost request checkpoints without expired storage",async()=>{
 const directory=await folder(),published=new FileManagedObservationStore(join(directory,"managed.v3.json"));await published.put(state("paid",100));const repo=new DurableCatalogRepository(join(directory,"repository"),READ_NETWORK,V3);await repo.commit({archive:JSON.parse(await readFile(join(directory,"managed.v3.json"),"utf8"))},100);const file=join(directory,"backup.json"),backup=await repo.backup(file),restored=await DurableCatalogRepository.restore(file,backup.hash,join(directory,"restored"),READ_NETWORK,V3),archive=(await restored.current())!.generation.data.archive;
 const publishedFile=join(directory,"recovered-managed.json");await writeFile(publishedFile,JSON.stringify(archive));let reads=0;const transport:any={read:async()=>{reads++;throw Error("expired terminal storage");}},history=new DurableManagedRequests(join(directory,"new-request-checkpoints"),READ_NETWORK,8,new FileManagedObservationStore(publishedFile)),rows=await history.read({id:V3,hash:V3_HASH,next:2n,ledger:110,transport});assert.equal(rows.length,1);assert.equal(rows[0].claimed_assets,"400000000");assert.equal(reads,0);
});

test("Sushi and lifecycle read ABI never admits protocol mutations",()=>{
 for(const method of ["venue_registry","venue_config","is_allowed","is_auto_allowed","is_exit_allowed","factory","get_pool","fee","token0","token1","is_paused","pool_route","quote_exact_input","managed_routes","is_caller"])assertReadEnvelope({jsonrpc:"2.0",id:1,method:"simulateTransaction",params:{transaction:transaction(method).toXDR()}});
 for(const method of ["swap","execute","set_caller","set_pool_route","set_venue_status","rebalance_auto"])assert.throws(()=>assertReadEnvelope({jsonrpc:"2.0",id:1,method:"simulateTransaction",params:{transaction:transaction(method).toXDR()}}),/GETTER_DENIED/);
});
