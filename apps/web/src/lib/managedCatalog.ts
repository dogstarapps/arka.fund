import type {ProductFund} from './managedProduct';

import {feePreview} from '@/lib/feePreview';
const MAX=(BigInt(1)<<BigInt(127))-BigInt(1);
function fail():never{throw Error('Catalog V3 reconciliation unavailable. No holdings have been treated as zero.');}
function record(v:unknown):Record<string,unknown>{if(!v||typeof v!=='object'||Array.isArray(v))return fail();return v as Record<string,unknown>;}
function raw(v:unknown):string{if(typeof v!=='string'||!/^(0|[1-9]\d*)$/.test(v)||v.length>39||BigInt(v)>MAX)return fail();return v;}
// A historical sum is bounded by the number of individually valid i128 claims.
function paidTotal(v:unknown,count:number):string{if(typeof v!=='string'||!/^(0|[1-9]\d*)$/.test(v)||v.length>60||BigInt(v)>BigInt(count)*MAX)return fail();return v;}
function same(a:unknown,b:unknown){if(a!==b)fail();}
/** Validate the API boundary before a catalog observation can become investor UI. */
export function withManagedCatalogPosition(fund:ProductFund,owner:string,input:unknown,now=Date.now()):ProductFund{
 const d=record(input),p=record(d.position);
 same(d.schemaVersion,1);same(d.version,3);same(d.complete,true);same(d.stale,false);
 same(d.arkaId,fund.id);same(d.owner,owner);same(p.owner,owner);same(d.denominationContract,fund.token);
 if(!/^[a-f0-9]{64}$/.test(String(d.observationId))||!/^[a-f0-9]{64}$/.test(String(d.codeHash)))fail();
 const age=now-Date.parse(String(d.indexedAt));
 if(!Number.isFinite(age)||age< -10000||age>120000||!Number.isSafeInteger(d.ledger)||Number(d.ledger)<1||Math.abs(Number(d.ledger)-fund.ledger)>12)fail();
 const total=raw(d.totalShares),reserved=raw(d.reservedAssets),allPending=raw(d.pendingShares);
 const nav=d.nav===null?null:raw(d.nav);
 same(total,fund.totalShares);same(reserved,fund.queue.reserved_assets);same(allPending,fund.queue.pending_shares);
 const preview=d.feePreview===null||d.feePreview===undefined?null:feePreview(d.feePreview,total,nav!,Math.floor(Date.parse(String(d.indexedAt))/1000)),valuationTotal=preview?.total_shares_after??total;
 if(d.valuationTotalShares!==undefined)same(raw(d.valuationTotalShares),valuationTotal);
 if(fund.status){same(valuationTotal,fund.status.total_shares);same(nav,fund.status.nav);}
 else if(nav!==null)fail();
 const free=raw(p.freeSharesRaw),pending=raw(p.pendingSharesRaw),claimable=raw(p.claimableAssetsRaw);
 same(free,fund.freeShares);
 same(raw(p.economicSharesRaw),(BigInt(free)+BigInt(pending)).toString());
 const rows=d.requests;
 if(!Array.isArray(rows))return fail();
 let closedPaid=BigInt(0),history:ProductFund['withdrawalHistory'];
 if(d.requestsScope!==undefined){
  same(d.requestsScope,'active');const closed=record(d.closedRequests);
  if(rows.length>4096||!Number.isSafeInteger(closed.count)||Number(closed.count)<0||!Number.isSafeInteger(d.requestCount)||d.requestCount!==rows.length+Number(closed.count))fail();
  closedPaid=BigInt(paidTotal(closed.paidAssetsRaw,Number(closed.count)));history={observationId:String(d.observationId),codeHash:String(d.codeHash),owner,ledger:Number(d.ledger),closedCount:Number(closed.count),closedPaidAssetsRaw:closedPaid.toString()};
 }else if(d.closedRequests!==undefined||d.requestCount!==undefined)fail();
 const ids=new Set<string>();let pendingSum=BigInt(0),claimSum=BigInt(0),paidSum=BigInt(0);
 const requests=rows.map((value:unknown)=>{
  const r=record(value);same(r.owner,owner);const id=raw(r.id);
  if(id==='0'||BigInt(id)>BigInt('18446744073709551615')||ids.has(id))fail();ids.add(id);
  const requested=raw(r.requested_shares),pending=raw(r.pending_shares),settled=raw(r.settled_shares),cancelled=raw(r.cancelled_shares),claim=raw(r.claimable_assets),paid=raw(r.claimed_assets);
  if(history&&pending==='0'&&claim==='0')fail();
  if(requested==='0'||BigInt(requested)!==BigInt(pending)+BigInt(settled)+BigInt(cancelled))fail();
  pendingSum+=BigInt(pending);claimSum+=BigInt(claim);paidSum+=BigInt(paid);
  return {id,owner,pending_shares:pending,claimable_assets:claim,claimed_assets:paid,cancelled_shares:cancelled,eligible_at:raw(r.eligible_at)};
 });
 same(pendingSum.toString(),pending);same(claimSum.toString(),claimable);same((paidSum+closedPaid).toString(),paidTotal(p.paidAssetsRaw,rows.length+(history?.closedCount??0)));
 if(claimSum>BigInt(reserved)||pendingSum>BigInt(allPending))fail();
 const economic=BigInt(free)+pendingSum;
 const shareValue=nav===null?null:BigInt(valuationTotal)>BigInt(0)?economic*BigInt(nav)/BigInt(valuationTotal):BigInt(0);
 same(p.shareValueRaw,shareValue===null?null:shareValue.toString());
 same(p.positionValueRaw,shareValue===null&&economic>BigInt(0)?null:((shareValue??BigInt(0))+claimSum).toString());
 if(d.depositProtectionVersion!==1&&d.depositProtectionVersion!==null)fail();
 if(fund.readSource){if(fund.readSource.kind==='mainnet-rpc-readonly'){same(process.env.NEXT_PUBLIC_V3_MAINNET_READONLY,'1');same(fund.network,'Public Global Stellar Network ; September 2015');if(!['live','recorded-mainnet-replay'].includes(fund.readSource.verificationMode??''))fail();}else same(fund.readSource.kind,'standalone-rpc');same(fund.readSource.network,fund.network);same(fund.readSource.codeHash,d.codeHash);same(fund.readSource.capturedAt,d.indexedAt);same(fund.readSource.transactionsSubmitted,0);}
 // A catalog capability can narrow, never expand, the direct deposit guard.
 const protection=d.depositProtectionVersion===1&&fund.depositProtectionVersion===1?1:null;
 return {...fund,freeShares:free,totalShares:total,requests,requestsTruncated:false,withdrawalHistory:history,
  depositProtectionVersion:protection,catalog:{observationId:String(d.observationId),indexedAt:String(d.indexedAt),ledger:Number(d.ledger),owner,complete:true,valuationTotalShares:valuationTotal,feePreview:preview}};
}

/** Read-only closed history, bound to the position's immutable observation. */
export function withdrawalHistoryPage(fund:ProductFund,input:unknown,offset:number){
 const h=fund.withdrawalHistory;if(!h)return fail();const page=record(input);
 same(page.arkaId,fund.id);same(page.owner,h.owner);same(page.observationId,h.observationId);same(page.ledger,h.ledger);same(page.complete,true);same(page.total,h.closedCount);same(page.offset,offset);same(page.limit,25);same(page.order,'desc');
 same(page.codeHash,h.codeHash);
 if(!Array.isArray(page.items)||page.items.length!==Math.min(25,Math.max(0,h.closedCount-offset)))fail();
 let previous=BigInt('18446744073709551616');return page.items.map(value=>{const row=record(value);same(row.owner,h.owner);same(raw(row.pending_shares),'0');same(raw(row.claimable_assets),'0');const id=raw(row.id),requested=raw(row.requested_shares),settled=raw(row.settled_shares),cancelled=raw(row.cancelled_shares),paid=raw(row.claimed_assets);
  if(id==='0'||BigInt(id)>=previous||BigInt(id)>BigInt('18446744073709551615')||requested==='0'||BigInt(requested)!==BigInt(settled)+BigInt(cancelled))fail();previous=BigInt(id);
  return {id,owner:h.owner,pending_shares:'0',claimable_assets:'0',claimed_assets:paid,cancelled_shares:cancelled,eligible_at:raw(row.eligible_at)};
 });
}
