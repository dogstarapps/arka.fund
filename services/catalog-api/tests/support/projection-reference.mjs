import assert from 'node:assert/strict';
import {sdk} from '../../review/sdk.mjs';
const check=(value,message)=>assert(value,message);
const MAX=170141183460469231731687303715884105727n;
function n(raw){check((typeof raw==='string'||typeof raw==='bigint')&&/^(0|[1-9]\d*)$/.test(String(raw)),'PROJECTION_AMOUNT_INVALID');const value=BigInt(raw);check(value<=MAX,'PROJECTION_AMOUNT_INVALID');return value;}
const owner=id=>typeof id==='string'&&(sdk.StrKey.isValidEd25519PublicKey(id)||sdk.StrKey.isValidContract(id));
// Candidate V3 read model, not a modification of the deployed catalog. A request
// moves shares into escrow: the wallet balance alone is no longer its position.
export function projectManagedInvestors({fundId,totalShares,nav,reservedAssets,balances,requests,historyComplete,holdersComplete}){
 check(sdk.StrKey.isValidContract(fundId)&&historyComplete===true&&holdersComplete===true,'PROJECTION_COVERAGE_INCOMPLETE');
 check(Array.isArray(balances)&&balances.length<=32768&&Array.isArray(requests)&&requests.length<=32768,'PROJECTION_INPUT_INVALID');
 const total=n(totalShares),reserved=n(reservedAssets),valuation=nav===null?null:n(nav),seen=new Set(),rows=new Map();let escrow=0n,allShares=0n,pending=0n,claims=0n;
 const get=id=>{check(owner(id)&&id!==fundId,'PROJECTION_OWNER_INVALID');if(!rows.has(id))rows.set(id,{owner:id,freeShares:0n,pendingShares:0n,claimableAssets:0n,paidAssets:0n});return rows.get(id);};
 for(const b of balances){check(owner(b.owner)&&!seen.has(b.owner),'PROJECTION_DUPLICATE_OWNER');seen.add(b.owner);const shares=n(b.shares);allShares+=shares;if(b.owner===fundId)escrow=shares;else get(b.owner).freeShares=shares;}
 const ids=new Set();
 for(const r of requests){const id=n(r.id);check(id>0n&&!ids.has(String(id)),'PROJECTION_REQUEST_DUPLICATE');ids.add(String(id));
  const requested=n(r.requested_shares),p=n(r.pending_shares),settled=n(r.settled_shares),cancelled=n(r.cancelled_shares),claimable=n(r.claimable_assets),paid=n(r.claimed_assets);
  check(requested>0n&&requested===p+settled+cancelled,'PROJECTION_REQUEST_ACCOUNTING');const row=get(r.owner);row.pendingShares+=p;row.claimableAssets+=claimable;row.paidAssets+=paid;pending+=p;claims+=claimable;
 }
 check(allShares===total&&escrow===pending&&claims===reserved,'PROJECTION_RECONCILIATION_FAILED');
 const investors=[...rows.values()].filter(r=>r.freeShares+r.pendingShares+r.claimableAssets>0n).map(r=>{
  const economic=r.freeShares+r.pendingShares,shareValue=valuation===null?null:total>0n?economic*valuation/total:0n;
  return {owner:r.owner,freeSharesRaw:String(r.freeShares),pendingSharesRaw:String(r.pendingShares),economicSharesRaw:String(economic),ownershipBps:total>0n?Number(economic*10000n/total):0,claimableAssetsRaw:String(r.claimableAssets),paidAssetsRaw:String(r.paidAssets),shareValueRaw:shareValue===null?null:String(shareValue),positionValueRaw:shareValue===null&&economic>0n?null:String((shareValue??0n)+r.claimableAssets)};
 });
 return {schema:1,scope:'candidate-v3-read-model',fundId,complete:true,navAvailable:valuation!==null,denominationValuesOnly:true,investors,excludedEscrowSharesRaw:String(escrow),reservedAssetsRaw:String(reserved),historicalRequests:requests.length};
}
