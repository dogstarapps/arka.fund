import test from "node:test";
import assert from "node:assert/strict";
import {RpcManagedSnapshotSource} from "../../src/managedSource.js";
import type {ManagedReadTransport} from "../../src/managedSource.js";
import type {ResumableManagedRequests} from "../../src/managedHistory.js";
import {FixtureManagedTransport,baseEntries,legacyHolders,state,request,V3,LEGACY_HASH,V3_HASH} from "../support/managedFixture.js";

const entry=()=>baseEntries()[1];
async function observe(transport:ManagedReadTransport,history?:ResumableManagedRequests){
 const source=new RpcManagedSnapshotSource(transport,legacyHolders(),{legacy:[LEGACY_HASH],v3:[V3_HASH]},undefined,history);
 return source.read(entry(),await source.identify(entry()));
}
function cancelledThenRequested(closed=1){
 const transport=new FixtureManagedTransport();transport.observation=state();
 transport.observation.requests=[...Array.from({length:closed},(_,i)=>request({id:String(i+1),requested_shares:"1",pending_shares:"0",cancelled_shares:"1"})),request({id:String(closed+1)})];
 return transport;
}
test("cancelled head is reconciled without changing the raw queue, reserves or immutable receipts",async()=>{
 const t=new FixtureManagedTransport();t.observation=state("cancelled");const before=structuredClone(t.observation),raw=await t.read(V3,"managed_queue_state");
 const result=await observe(t);assert.deepEqual(t.observation,before);assert.deepEqual(await t.read(V3,"managed_queue_state"),raw);
 assert.equal((raw as {head:bigint}).head,1n);assert.equal(result.reservedAssets,"200000000");assert.deepEqual(result.requests,before.requests);assert.equal(result.requests[0].claimable_assets,"200000000");
});
test("a new request after cancellation remains visible and does not get skipped",async()=>{
 const t=cancelledThenRequested(),result=await observe(t);assert.equal(result.requests.length,2);assert.equal(result.requests[1].pending_shares,"400000000");assert.equal(result.totalShares,"1000000000");assert.equal(result.balances.find(b=>b.owner===V3)!.shares,"400000000");
});
for(const count of [0,1,15,16,17,34])test(`status preview matches the exact 16-entry bound for ${count} cancelled requests`,async()=>{
 const t=cancelledThenRequested(count),raw=await t.read(V3,"managed_queue_state") as {head:bigint},status=await t.read(V3,"withdrawal_status") as {queue:{head:bigint}};
 assert.equal(raw.head,1n);assert.equal(status.queue.head,1n+BigInt(Math.min(16,count)));const result=await observe(t);assert.equal(result.requests.length,count+1);
});
test("all-cancelled history can normalize to next_id with no lost share or withdrawal rights",async()=>{
 const t=new FixtureManagedTransport();t.observation=state("cancelled-paid");const result=await observe(t);assert.equal(result.requests[0].cancelled_shares,"200000000");assert.equal(result.requests[0].claimed_assets,"200000000");assert.equal(result.totalShares,"800000000");
});
test("reserved claims stay readable when NAV/status is unavailable",async()=>{
 const t=new FixtureManagedTransport();t.observation=state("reserved");const result=await observe(t);assert.equal(result.nav,null);assert.equal(result.reservedAssets,"1000000000");assert.equal(result.requests.length,2);
});
type Queue=Record<string,unknown>;
function corruptStatus(t:FixtureManagedTransport,change:(queue:Queue)=>void){const read=t.read.bind(t);t.read=async(id,method,args)=>{const value=await read(id,method,args);if(method==="withdrawal_status"){const status=structuredClone(value) as {queue:Queue};change(status.queue);return status;}return value;};return t;}
for(const [name,change]of [
 ["backward head",(q:Queue)=>q.head=0n],
 ["skip an open obligation",(q:Queue)=>q.head=3n],
 ["unnormalized closed prefix",(q:Queue)=>q.head=1n],
 ["changed next id",(q:Queue)=>q.next_id=4n],
 ["changed pending count",(q:Queue)=>q.pending_count=0],
 ["changed pending shares",(q:Queue)=>q.pending_shares=0n],
 ["changed reserves",(q:Queue)=>q.reserved_assets=1n],
 ["missing head",(q:Queue)=>delete q.head],
 ["extra queue field",(q:Queue)=>q.extra=1n],
] as const)test(`rejects ${name} rather than masking a real queue discrepancy`,async()=>{
 await assert.rejects(observe(corruptStatus(cancelledThenRequested(),change)),/MANAGED_QUEUE_CHANGED|MANAGED_AMOUNT_INVALID/);
});
test("does not silently advance farther than the contract's 16-entry bound",async()=>{
 await assert.rejects(observe(corruptStatus(cancelledThenRequested(34),q=>q.head=35n)),/MANAGED_QUEUE_CHANGED/);
});
test("a stored head may not have skipped any still-pending obligation",async()=>{
 const t=new FixtureManagedTransport(),read=t.read.bind(t);t.read=async(id,method,args)=>{const r=await read(id,method,args);if(method==="managed_queue_state")return {...r as Queue,head:2n};if(method==="withdrawal_status")return {...r as Queue,queue:{...(r as {queue:Queue}).queue,head:2n}};return r;};
 await assert.rejects(observe(t),/MANAGED_QUEUE_CHANGED/);
});
for(const mode of ["missing","duplicate","unordered"] as const)test(`requires complete contiguous canonical history (${mode}) before normalizing`,async()=>{
 const t=cancelledThenRequested(),rows=structuredClone(t.observation.requests);const history:ResumableManagedRequests={read:async()=>mode==="missing"?rows.slice(1):mode==="duplicate"?[rows[0],rows[0]]:rows.reverse()};
 await assert.rejects(observe(t,history),/MANAGED_HISTORY_GAP/);
});
test("raw queue change during the observation is still rejected",async()=>{
 const t=cancelledThenRequested(),read=t.read.bind(t);let queues=0;t.read=async(id,method,args)=>{const r=await read(id,method,args);return method==="managed_queue_state"&&++queues===2?{...r as Queue,head:2n}:r;};
 await assert.rejects(observe(t),/MANAGED_SNAPSHOT_CHANGED/);
});
test("code change during the observation is still rejected",async()=>{
 const t=cancelledThenRequested(),instance=t.instance.bind(t);let calls=0;t.instance=async id=>({...await instance(id),wasmHash:++calls===3?"99".repeat(32):V3_HASH});await assert.rejects(observe(t),/MANAGED_SNAPSHOT_CHANGED/);
});
test("ledger drift is still rejected after legitimate head reconciliation",async()=>{
 const t=cancelledThenRequested(),guard=t.guard.bind(t);let calls=0;t.guard=async()=>({...await guard(),sequence:t.observation.ledger+(++calls===3?30:0)});await assert.rejects(observe(t),/MANAGED_LEDGER_DRIFT/);
});

test("physical cash must fund available liquidity plus every fixed reserve",async()=>{
 const t=new FixtureManagedTransport();t.observation=state("partial");const read=t.read.bind(t);
 t.read=async(id,method,args)=>method==="balance"?999999999n:read(id,method,args);
 await assert.rejects(observe(t),/MANAGED_CASH_RECONCILIATION/);
});
test("unaccounted token donations cannot inflate available cash or reserved rights",async()=>{
 const t=new FixtureManagedTransport();t.observation=state("partial");const read=t.read.bind(t);
 t.read=async(id,method,args)=>method==="balance"?1000000001n:read(id,method,args);
 const result=await observe(t);assert.equal(result.nav,"800000000");assert.equal(result.reservedAssets,"200000000");
});
