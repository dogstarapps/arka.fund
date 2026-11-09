import {StrKey} from "@stellar/stellar-sdk";
import type {ArkaCatalogEntry} from "./types.js";
/** Old evidence discovers addresses only. It never imports balances or grants coverage. */
export function mergeHistoricalHolderCandidates(archive:any,page:any,arka:ArkaCatalogEntry,now=Date.now()):{archive:any;added:number}{
 if(archive.schemaVersion!==1||!Array.isArray(archive.entries)||page.arkaId!==arka.arkaId||page.shareToken!==arka.shareToken||page.offset!==0||page.total!==page.items?.length||!Array.isArray(page.items)||page.items.length>4096||!Number.isFinite(Date.parse(page.indexedAt))||Date.parse(page.indexedAt)>now)throw Error("HISTORICAL_HOLDERS_INVALID");
 const result=structuredClone(archive),existing=result.entries.find((entry:any)=>entry.arkaId===arka.arkaId),entry=existing??{arkaId:arka.arkaId,candidates:[],lastIndexedLedger:null,coverageFromLedger:null,complete:false};
 const owners=new Set(entry.candidates.map((row:any)=>row.holder)),seen=new Set<string>();let added=0;
 for(const row of page.items){
  if(typeof row.holder!=="string"||(!StrKey.isValidEd25519PublicKey(row.holder)&&!StrKey.isValidContract(row.holder))||seen.has(row.holder)||typeof row.shares!=="string"||!/^(0|[1-9]\d*)$/.test(row.shares))throw Error("HISTORICAL_HOLDERS_INVALID");seen.add(row.holder);
  for(const key of ["firstSeenLedger","lastActivityLedger"])if(row[key]!==null&&(!Number.isSafeInteger(row[key])||row[key]<1||row[key]>page.coverageToLedger))throw Error("HISTORICAL_HOLDERS_INVALID");
  if(!owners.has(row.holder)){entry.candidates.push({holder:row.holder,firstSeenLedger:row.firstSeenLedger,lastActivityLedger:row.lastActivityLedger});owners.add(row.holder);added++;}
 }
 entry.complete=false;if(!existing)result.entries.push(entry);return {archive:result,added};
}
