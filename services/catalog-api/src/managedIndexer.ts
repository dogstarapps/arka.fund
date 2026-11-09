import { buildSnapshot } from "./catalog.js";
import { StrKey } from "@stellar/stellar-sdk";
import type { CatalogSyncRunner } from "./runners.js";
import type { HolderReader } from "./holders.js";
import { projectManagedInvestors } from "./managedProjection.js";
import { FileManagedObservationStore } from "./managedStore.js";
import { ManagedCatalogUnavailable } from "./managedTypes.js";
import type { ManagedSnapshotSource, ManagedObservation } from "./managedTypes.js";
import type { ArkaCatalogEntry, ArkaHolderPage, HolderQuery, CatalogSnapshot } from "./types.js";

export class ManagedCatalogSyncRunner implements CatalogSyncRunner {
  constructor(private readonly base: CatalogSyncRunner, private readonly source: ManagedSnapshotSource, private readonly store: FileManagedObservationStore) {}
  async run(): Promise<CatalogSnapshot> {
    const original=await this.base.run(), entries: ArkaCatalogEntry[]=[], failures=[...original.failures];let managed=false;
    for(const entry of original.arkas){
      let version: 3|null=null, codeHash: string|null=null;
      try{
        const identity=await this.source.identify(entry);codeHash=identity.codeHash;
        if(identity.kind==="legacy"){entries.push(entry);continue;}
        managed=true;
        if(identity.kind!=="v3")throw new Error("CODE_NOT_APPROVED");version=3;
        const observation=await this.source.read(entry,identity);
        if(observation.arkaId!==entry.arkaId||observation.wasmHash!==identity.codeHash||observation.ledger<identity.ledger)throw new Error("MANAGED_IDENTITY_CHANGED");
        const projection=projectManagedInvestors({...observation,fundId:entry.arkaId});
        const reserve=BigInt(observation.reservedAssets);
        const assets=entry.assets.map(asset=>{
          if(asset.assetContract!==entry.denominationContract)return asset;
          // The contract already removes fixed claims from liquid_balance. The
          // catalog exposes accounted gross cash plus its separate reserve.
          return {...asset,liquidBalance:(BigInt(asset.liquidBalance)+reserve).toString(),reservedWithdrawalBalance:reserve.toString()};
        });
        if(reserve>0n&&!assets.some(a=>a.assetContract===entry.denominationContract))throw new Error("MANAGED_DENOMINATION_MISSING");
        // A transient capability read must not rewrite financial history or make a
        // repeated, identical ledger look like a conflicting observation.
        const {depositProtectionVersion,...financialObservation}=observation;
        const record=await this.store.put(financialObservation);
        entries.push({...entry,nav:observation.nav,navUnavailableReason:observation.nav===null?"managed_nav_unavailable":null,assets,managedWithdrawals:{version:3,status:"verified",codeHash,observationId:record.id,ledger:observation.ledger,indexedAt:record.observation.observedAt,pendingShares:projection.excludedEscrowSharesRaw,reservedAssets:observation.reservedAssets,depositProtectionVersion:depositProtectionVersion===1?1:null}});
        if(observation.nav===null&&!failures.some(f=>f.arkaId===entry.arkaId))failures.push({arkaId:entry.arkaId,message:"managed_nav_unavailable",syncedAt:original.syncedAt});
      }catch{
        managed=true;entries.push({...entry,nav:null,navUnavailableReason:"managed_v3_unavailable",managedWithdrawals:{version,status:"unavailable",codeHash,unavailableReason:"managed_v3_unavailable"}});
        if(!failures.some(f=>f.arkaId===entry.arkaId))failures.push({arkaId:entry.arkaId,message:"managed_v3_unavailable",syncedAt:original.syncedAt});
      }
    }
    if(!managed)return original; // Preserve the complete legacy response, byte for byte.
    const result=buildSnapshot(entries,failures,original.syncedAt,original.assetPrices);
    result.metrics.managedDataComplete=entries.filter(e=>e.managedWithdrawals).every(e=>e.managedWithdrawals?.status==="verified");
    return result;
  }
}

function bounds(query: HolderQuery): {offset: number; limit: number} {
  return {offset:Number.isSafeInteger(query.offset)&&(query.offset??-1)>=0?query.offset!:0,limit:Number.isSafeInteger(query.limit)&&(query.limit??0)>0?Math.min(query.limit!,100):25};
}
export class ManagedCatalogAccess {
  constructor(private readonly store: FileManagedObservationStore, private readonly now: ()=>number=Date.now) {}
  isStale(data: ManagedObservation): boolean {const age=this.now()-Date.parse(data.observedAt);return age>120000||age< -10000;}
  async observation(arka: ArkaCatalogEntry): Promise<ManagedObservation> {
    const state=arka.managedWithdrawals;
    if(state?.status!=="verified"||state.version!==3||!state.observationId)throw new ManagedCatalogUnavailable();
    let record;try {record=await this.store.get(state.observationId);}catch{throw new ManagedCatalogUnavailable();}
    if(!record||record.observation.arkaId!==arka.arkaId||record.observation.wasmHash!==state.codeHash||record.observation.ledger!==state.ledger)throw new ManagedCatalogUnavailable();
    return record.observation;
  }
  async withdrawals(arka: ArkaCatalogEntry, query: HolderQuery={}, selection:{owner?:string;closedOnly?:boolean;observationId?:string}={}) {
    let data=await this.observation(arka),observationId=arka.managedWithdrawals!.observationId!;
    if(selection.observationId&&selection.observationId!==observationId){
      const record=await this.store.get(selection.observationId);
      if(!record||record.observation.arkaId!==arka.arkaId||record.observation.wasmHash!==data.wasmHash||record.observation.ledger>data.ledger)throw new ManagedCatalogUnavailable();
      data=record.observation;observationId=record.id;
    }
    const rows=data.requests.filter(r=>(!selection.owner||r.owner===selection.owner)&&(!selection.closedOnly||(BigInt(r.pending_shares)===0n&&BigInt(r.claimable_assets)===0n))),{offset,limit}=bounds(query);
    if(selection.closedOnly)rows.reverse();
    return {arkaId:arka.arkaId,version:3,complete:true,stale:this.isStale(data),indexedAt:data.observedAt,ledger:data.ledger,observationId,codeHash:data.wasmHash,...(selection.owner?{owner:selection.owner}:{}),...(selection.closedOnly?{order:'desc' as const}:{}),denominationContract:arka.denominationContract,reservedAssets:data.reservedAssets,total:rows.length,offset,limit,items:rows.slice(offset,offset+limit)};
  }
  /** One owner, one immutable observation. No paging joins or raw Number amounts. */
  async position(arka: ArkaCatalogEntry, owner: string, activeOnly=false) {
    if(!StrKey.isValidEd25519PublicKey(owner))throw new ManagedCatalogUnavailable("managed_owner_invalid");
    const data=await this.observation(arka);
    const projection=projectManagedInvestors({...data,fundId:arka.arkaId});
    const investor=projection.investors.find(row=>row.owner===owner);
    const requests=data.requests.filter(row=>row.owner===owner);
    const active=requests.filter(row=>BigInt(row.pending_shares)>0n||BigInt(row.claimable_assets)>0n),closed=requests.filter(row=>BigInt(row.pending_shares)===0n&&BigInt(row.claimable_assets)===0n);
    return {schemaVersion:1,version:3,arkaId:arka.arkaId,owner,complete:true,
      stale:this.isStale(data),indexedAt:data.observedAt,ledger:data.ledger,
      observationId:arka.managedWithdrawals!.observationId!,codeHash:data.wasmHash,
      coverageFromLedger:data.fromLedger,coverageToLedger:data.toLedger,creationLedger:data.creationLedger,
      denominationContract:arka.denominationContract,totalShares:data.totalShares,nav:data.nav,
      reservedAssets:data.reservedAssets,pendingShares:projection.excludedEscrowSharesRaw,
      depositProtectionVersion:arka.managedWithdrawals?.depositProtectionVersion===1?1:null,
      position:investor??{owner,freeSharesRaw:"0",pendingSharesRaw:"0",economicSharesRaw:"0",
        ownershipBps:0,claimableAssetsRaw:"0",paidAssetsRaw:requests.reduce((n,r)=>n+BigInt(r.claimed_assets),0n).toString(),
        shareValueRaw:data.nav===null?null:"0",positionValueRaw:"0"},
      requests:activeOnly?active:requests,...(activeOnly?{requestsScope:'active' as const,requestCount:requests.length,closedRequests:{count:closed.length,paidAssetsRaw:closed.reduce((sum,row)=>sum+BigInt(row.claimed_assets),0n).toString()}}:{})};
  }
  async history(arkaId: string, query: HolderQuery={}) {try{const records=await this.store.history(arkaId),{offset,limit}=bounds(query);return {arkaId,total:records.length,offset,limit,items:records.slice(offset,offset+limit)};}catch{throw new ManagedCatalogUnavailable();}}
}
export class MixedHolderReader implements HolderReader {
  constructor(private readonly legacy: HolderReader, private readonly managed: ManagedCatalogAccess) {}
  async list(arka: ArkaCatalogEntry, query: HolderQuery={}): Promise<ArkaHolderPage> {
    if(!arka.managedWithdrawals)return this.legacy.list(arka,query);
    const data=await this.managed.observation(arka),projection=projectManagedInvestors({...data,fundId:arka.arkaId});
    const items=projection.investors.map(p=>({holder:p.owner,shares:p.economicSharesRaw,ownershipBps:p.ownershipBps,firstSeenLedger:null,lastActivityLedger:null,freeShares:p.freeSharesRaw,pendingShares:p.pendingSharesRaw,claimableAssets:p.claimableAssetsRaw,paidAssets:p.paidAssetsRaw,positionValueDenomination:p.positionValueRaw})).sort((a,b)=>a.holder.localeCompare(b.holder));
    const {offset,limit}=bounds(query);
    return {arkaId:arka.arkaId,shareToken:arka.shareToken,totalShares:data.totalShares,indexedAt:data.observedAt,complete:true,stale:this.managed.isStale(data),coverageFromLedger:data.fromLedger,coverageToLedger:data.toLedger,total:items.length,offset,limit,items:items.slice(offset,offset+limit),managed:{version:3,observationId:arka.managedWithdrawals!.observationId!,nav:data.nav,denominationContract:arka.denominationContract,reservedAssets:data.reservedAssets,pendingShares:projection.excludedEscrowSharesRaw}};
  }
}
