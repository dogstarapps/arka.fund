import { StrKey } from "@stellar/stellar-sdk";
import { buildSnapshot } from "../../src/catalog.js";
import { StaticHolderReader } from "../../src/holders.js";
import type { ArkaCatalogEntry, ArkaHolderPage, IdentityArchive } from "../../src/types.js";
import type { ManagedObservation, ManagedCodeIdentity, ManagedSnapshotSource } from "../../src/managedTypes.js";
import type { ManagedReadTransport } from "../../src/managedSource.js";
export const contract=(n: number)=>StrKey.encodeContract(Buffer.alloc(32,n));
export const wallet=(n: number)=>StrKey.encodeEd25519PublicKey(Buffer.alloc(32,n));
export const LEGACY=contract(21),V3=contract(22),TOKEN=contract(23),SHARE=contract(24),MANAGER=wallet(21),INVESTOR=wallet(22);
export const LEGACY_HASH="31".repeat(32),V3_HASH="32".repeat(32);
export const FIXTURE_AT="2026-10-16T10:00:00.000Z";
export function baseEntries(at=FIXTURE_AT,managed?:ManagedObservation): ArkaCatalogEntry[] {
  const make=(id: string,nav: string): ArkaCatalogEntry=>({arkaId:id,manager:MANAGER,curated:false,delisted:false,nav,denominationContract:TOKEN,whitelistContracts:[TOKEN],shareToken:SHARE,fees:{mgmtBps:0,perfBps:0,depositBps:0,redeemBps:0},assets:[{assetContract:TOKEN,isDenomination:true,liquidBalance:nav,collateralAmount:"0",debtAmount:"0",netManagedAmount:nav,netPositionValue:"0",marketIds:[],syncedAt:at}],syncedAt:at});
  return [make(LEGACY,"500000000"),make(V3,managed?.totalShares??"1000000000")];
}
export function request(patch: Partial<ManagedObservation["requests"][number]>={}) {
  return {id:"1",owner:INVESTOR,requested_shares:"400000000",pending_shares:"400000000",settled_shares:"0",cancelled_shares:"0",claimable_assets:"0",claimed_assets:"0",created_at:"1792144500",eligible_at:"1792144560",last_settled_at:"0",...patch};
}
export function state(stage: "requested"|"partial"|"cancelled"|"paid"|"reserved"|"cancelled-paid"="requested",ledger=100): ManagedObservation {
  const common={schemaVersion:1 as const,arkaId:V3,wasmHash:V3_HASH,ledger,observedAt:new Date(Date.parse(FIXTURE_AT)+ledger*1000).toISOString(),fromLedger:1,toLedger:ledger,historyComplete:true,holdersComplete:true};
  if(stage==="partial")return {...common,totalShares:"800000000",nav:"800000000",reservedAssets:"200000000",balances:[{owner:INVESTOR,shares:"600000000"},{owner:V3,shares:"200000000"}],requests:[request({pending_shares:"200000000",settled_shares:"200000000",claimable_assets:"200000000"})]};
  if(stage==="cancelled")return {...common,totalShares:"800000000",nav:"800000000",reservedAssets:"200000000",balances:[{owner:INVESTOR,shares:"800000000"}],requests:[request({pending_shares:"0",settled_shares:"200000000",cancelled_shares:"200000000",claimable_assets:"200000000"})]};
  if(stage==="cancelled-paid")return {...common,totalShares:"800000000",nav:"800000000",reservedAssets:"0",balances:[{owner:INVESTOR,shares:"800000000"}],requests:[request({pending_shares:"0",settled_shares:"200000000",cancelled_shares:"200000000",claimed_assets:"200000000"})]};
  if(stage==="paid")return {...common,totalShares:"600000000",nav:"600000000",reservedAssets:"0",balances:[{owner:INVESTOR,shares:"600000000"}],requests:[request({pending_shares:"0",settled_shares:"400000000",claimed_assets:"400000000"})]};
  if(stage==="reserved")return {...common,totalShares:"0",nav:null,reservedAssets:"1000000000",balances:[],requests:[request({pending_shares:"0",settled_shares:"400000000",claimable_assets:"400000000"}),request({id:"2",requested_shares:"600000000",pending_shares:"0",settled_shares:"600000000",claimable_assets:"600000000",created_at:"1792144620",eligible_at:"1792144680"})]};
  return {...common,totalShares:"1000000000",nav:"1000000000",reservedAssets:"0",balances:[{owner:INVESTOR,shares:"600000000"},{owner:V3,shares:"400000000"}],requests:[request()]};
}
export class FixtureManagedSource implements ManagedSnapshotSource {
  observation=state();fail=false;unknown=false;reads=0;legacyOnly=false;
  async identify(entry: ArkaCatalogEntry): Promise<ManagedCodeIdentity>{return {kind:this.legacyOnly||entry.arkaId===LEGACY?"legacy":this.unknown?"unknown":"v3",codeHash:entry.arkaId===LEGACY?LEGACY_HASH:V3_HASH,ledger:this.observation.ledger};}
  async read(): Promise<ManagedObservation>{this.reads++;if(this.fail)throw new Error("fixture unreadable");return structuredClone(this.observation);}
}
export function legacyHolders(at=FIXTURE_AT) {
  const page=(id: string,total: string): ArkaHolderPage=>({arkaId:id,shareToken:SHARE,totalShares:total,indexedAt:at,complete:true,coverageFromLedger:1,coverageToLedger:100,total:1,offset:0,limit:25,items:[{holder:INVESTOR,shares:total,ownershipBps:10000,firstSeenLedger:1,lastActivityLedger:100}]});
  return new StaticHolderReader({[LEGACY]:page(LEGACY,"500000000"),[V3]:page(V3,"1000000000")});
}
export function identities(at=FIXTURE_AT): IdentityArchive {
  const profile={displayName:"",description:"Preserved local fixture description",strategy:"Original strategy",riskDisclosure:"No real assets. Test data only.",targetReturn:null,avatarUrl:null,websiteUrl:"https://arka.fund",socialUrl:null,trustState:"unverified" as const,updatedAt:at,updatedBy:MANAGER};
  return {schemaVersion:1,updatedAt:at,arkas:{[LEGACY]:{...profile,arkaId:LEGACY,manager:MANAGER,displayName:"Legacy Arka · local fixture"},[V3]:{...profile,arkaId:V3,manager:MANAGER,displayName:"Managed V3 Arka · local fixture"}},managers:{[MANAGER]:{...profile,manager:MANAGER,displayName:"Fixture manager"}}};
}
export function snapshots(at=FIXTURE_AT,managed?:ManagedObservation) {return buildSnapshot(baseEntries(at,managed),[],at);}
/** Read-only fake chain transport: it cannot send, sign, mint or move assets. */
export class FixtureManagedTransport implements ManagedReadTransport {
  observation=state();calls: string[]=[];badCode=false;badVersion=false;gap=false;drift=false;
  async guard(){this.calls.push("guard");return {sequence:this.observation.ledger+(this.drift?30:0),time:Date.parse(this.observation.observedAt)/1000};}
  async instance(id: string){this.calls.push("instance");return {wasmHash:id===LEGACY?LEGACY_HASH:this.badCode?"99".repeat(32):V3_HASH,ledger:this.observation.ledger};}
  async read(id: string,method: string,args: unknown[]=[]): Promise<unknown>{
    this.calls.push(method);if(id===TOKEN&&method==="balance"&&args[0]===V3)return BigInt(this.observation.totalShares)+BigInt(this.observation.reservedAssets);
    if(id!==V3)throw new Error("No V3 getter permitted for legacy fixture.");
    const data=this.observation,q={head:1n,next_id:BigInt(data.requests.length+1),pending_shares:data.requests.reduce((sum,r)=>sum+BigInt(r.pending_shares),0n),pending_count:data.requests.filter(r=>BigInt(r.pending_shares)>0n).length,reserved_assets:BigInt(data.reservedAssets)};
    switch(method){
      case "deposit_protection_version":return this.badVersion?0:1;
      case "managed_portfolio_policy":return {auto_payout:true,routes:[]};
      case "managed_queue_state":return q;
      case "liquid_balance":return this.observation.totalShares;
      case "withdrawal_requests":return this.gap?[]:data.requests.slice(Number(args[0])-1,Number(args[0])-1+Number(args[1]));
      case "shares_of":return data.balances.find(b=>b.owner===args[0])?.shares??"0";
      case "total_shares":return data.totalShares;
      case "withdrawal_status":{
        if(data.nav===null)throw new Error("fixture NAV unavailable");
        // Match the actual WASM: status advances a bounded local copy, whereas
        // managed_queue_state returns the still-persisted cursor.
        const preview={...q};for(let visited=0;visited<16&&preview.head<preview.next_id;visited++){
          if(BigInt(data.requests[Number(preview.head-1n)].pending_shares)>0n)break;
          preview.head++;
        }
        return {nav:data.nav,queue:preview};
      }
      default:throw new Error("Getter not allowed in fixture: "+method);
    }
  }
}
