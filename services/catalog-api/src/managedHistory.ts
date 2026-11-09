import {join} from "node:path";
import {StrKey} from "@stellar/stellar-sdk";
import {DurableCatalogRepository} from "./durableCatalog.js";
import type {FileManagedObservationStore} from "./managedStore.js";
import type {ManagedReadTransport} from "./managedSource.js";
import type {ManagedRequest} from "./managedTypes.js";
const KEYS=["id","requested_shares","pending_shares","settled_shares","cancelled_shares","claimable_assets","claimed_assets","created_at","eligible_at","last_settled_at"] as const;
export function decodeManagedRequest(raw:unknown):ManagedRequest {
 if(!raw||typeof raw!=="object")throw Error("MANAGED_REQUEST_INVALID");const value=raw as Record<string,unknown>,result={owner:value.owner} as ManagedRequest;
 if(typeof result.owner!=="string"||(!StrKey.isValidEd25519PublicKey(result.owner)&&!StrKey.isValidContract(result.owner)))throw Error("MANAGED_REQUEST_INVALID");
 for(const key of KEYS){const n=String(value[key]);if(!/^(0|[1-9]\d*)$/.test(n)||BigInt(n)>170141183460469231731687303715884105727n)throw Error("MANAGED_REQUEST_INVALID");result[key]=n;}
 if(BigInt(result.id)<1n||BigInt(result.id)>18446744073709551615n||BigInt(result.requested_shares)===0n||BigInt(result.requested_shares)!==BigInt(result.pending_shares)+BigInt(result.settled_shares)+BigInt(result.cancelled_shares))throw Error("MANAGED_REQUEST_INVALID");return result;
}
export interface RequestHistoryInput {id:string;hash:string;next:bigint;ledger:number;transport:ManagedReadTransport;}
export interface ResumableManagedRequests {read(input:RequestHistoryInput):Promise<ManagedRequest[]>;}
interface RequestCheckpoint {schemaVersion:1;arkaId:string;wasmHash:string;nextStart:string;rows:ManagedRequest[];}
/** Closed requests survive RPC/storage retention; live obligations must be re-read. */
export class DurableManagedRequests implements ResumableManagedRequests {
 constructor(private readonly directory:string,private readonly network:string,private readonly pagesPerRun=8,private readonly published?:FileManagedObservationStore) {if(!Number.isSafeInteger(pagesPerRun)||pagesPerRun<1||pagesPerRun>128)throw Error("BACKFILL_PAGE_BUDGET_INVALID");}
 async read({id,hash,next,ledger,transport}:RequestHistoryInput):Promise<ManagedRequest[]> {
  if(!StrKey.isValidContract(id)||!/^[a-f0-9]{64}$/.test(hash)||next<1n||next>18446744073709551615n)throw Error("BACKFILL_BOUNDARY_INVALID");
  const repository=new DurableCatalogRepository(join(this.directory,id),this.network,id),previous=await repository.current();
  let checkpoint:RequestCheckpoint=previous?structuredClone(previous.generation.data.requests) as RequestCheckpoint:{schemaVersion:1,arkaId:id,wasmHash:hash,nextStart:"1",rows:[]};
  if(!previous&&this.published){const restored=(await this.published.history(id)).at(-1)?.observation;if(restored){if(restored.wasmHash!==hash||restored.ledger>ledger)throw Error("BACKFILL_PUBLISHED_IDENTITY_MISMATCH");checkpoint={schemaVersion:1,arkaId:id,wasmHash:hash,nextStart:String(restored.requests.length+1),rows:structuredClone(restored.requests)};}}
  if(checkpoint.schemaVersion!==1||checkpoint.arkaId!==id||checkpoint.wasmHash!==hash||!Array.isArray(checkpoint.rows)||!/^\d+$/.test(checkpoint.nextStart)||BigInt(checkpoint.nextStart)!==BigInt(checkpoint.rows.length)+1n||BigInt(checkpoint.nextStart)>next)throw Error("BACKFILL_CHECKPOINT_INVALID");
  checkpoint.rows.forEach((row,index)=>{decodeManagedRequest(row);if(BigInt(row.id)!==BigInt(index)+1n)throw Error("BACKFILL_HISTORY_GAP");});
  let pages=0;
  while(BigInt(checkpoint.nextStart)<next&&pages<this.pagesPerRun){
   const start=BigInt(checkpoint.nextStart),limit=Number(next-start>32n?32n:next-start),raw=await transport.read(id,"withdrawal_requests",[start,limit]);
   if(!Array.isArray(raw)||raw.length!==limit)throw Error("BACKFILL_HISTORY_GAP");
   const rows=raw.map(decodeManagedRequest);rows.forEach((row,index)=>{if(BigInt(row.id)!==start+BigInt(index))throw Error("BACKFILL_HISTORY_GAP");});
   checkpoint.rows.push(...rows);checkpoint.nextStart=String(start+BigInt(limit));await repository.commit({requests:checkpoint},ledger);pages++;
  }
  if(BigInt(checkpoint.nextStart)<next)throw Error("MANAGED_BACKFILL_PENDING");
  // Never infer payment or cancellation from missing live storage.
  const active=checkpoint.rows.filter(r=>BigInt(r.pending_shares)>0n||BigInt(r.claimable_assets)>0n);
  if(active.length>4096)throw Error("BACKFILL_ACTIVE_READ_BUDGET");
  for(const old of active){
   const raw=await transport.read(id,"withdrawal_requests",[BigInt(old.id),1]);if(!Array.isArray(raw)||raw.length!==1)throw Error("BACKFILL_ACTIVE_REQUEST_MISSING");const row=decodeManagedRequest(raw[0]);
   for(const key of ["id","owner","requested_shares","created_at","eligible_at"] as const)if(row[key]!==old[key])throw Error("BACKFILL_REQUEST_IDENTITY_CHANGED");
   for(const key of ["settled_shares","cancelled_shares","claimed_assets"] as const)if(BigInt(row[key])<BigInt(old[key]))throw Error("BACKFILL_STATE_REWIND");
   if(BigInt(row.pending_shares)>BigInt(old.pending_shares)||BigInt(row.claimed_assets)+BigInt(row.claimable_assets)<BigInt(old.claimed_assets)+BigInt(old.claimable_assets))throw Error("BACKFILL_STATE_REWIND");checkpoint.rows[Number(BigInt(row.id)-1n)]=row;
  }
  await repository.commit({requests:checkpoint},ledger);return structuredClone(checkpoint.rows);
 }
}
