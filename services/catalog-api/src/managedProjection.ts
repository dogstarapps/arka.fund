import { StrKey } from "@stellar/stellar-sdk";
import type { ManagedProjectionInput, ManagedProjection, ManagedInvestor } from "./managedTypes.js";
const MAX = 170141183460469231731687303715884105727n;
function check(ok: unknown, code: string): asserts ok {if (!ok) throw new Error(code);}
function n(raw: string): bigint {
  check(typeof raw === "string" && /^(0|[1-9]\d*)$/.test(raw), "PROJECTION_AMOUNT_INVALID");
  const value = BigInt(raw);check(value <= MAX, "PROJECTION_AMOUNT_INVALID");return value;
}
const validOwner = (id: string) => typeof id === "string" && (StrKey.isValidEd25519PublicKey(id) || StrKey.isValidContract(id));
/** Canonical candidate implementation of the previously tested V3 read model. */
export function projectManagedInvestors(input: ManagedProjectionInput): ManagedProjection {
  const {fundId, totalShares, nav, reservedAssets, balances, requests, historyComplete, holdersComplete} = input;
  check(StrKey.isValidContract(fundId) && historyComplete === true && holdersComplete === true, "PROJECTION_COVERAGE_INCOMPLETE");
  check(Array.isArray(balances) && balances.length <= 32768 && Array.isArray(requests), "PROJECTION_INPUT_INVALID");
  const total=n(totalShares), reserved=n(reservedAssets), valuation=nav===null?null:n(nav), seen=new Set<string>();
  type Position = {owner: string; freeShares: bigint; pendingShares: bigint; claimableAssets: bigint; paidAssets: bigint};
  const rows=new Map<string, Position>();let escrow=0n, allShares=0n, pending=0n, claims=0n;
  const get=(id: string): Position => {
    check(validOwner(id) && id!==fundId, "PROJECTION_OWNER_INVALID");
    if(!rows.has(id)) rows.set(id,{owner:id,freeShares:0n,pendingShares:0n,claimableAssets:0n,paidAssets:0n});
    return rows.get(id)!;
  };
  for(const b of balances){check(validOwner(b.owner)&&!seen.has(b.owner),"PROJECTION_DUPLICATE_OWNER");seen.add(b.owner);const shares=n(b.shares);allShares+=shares;if(b.owner===fundId)escrow=shares;else get(b.owner).freeShares=shares;}
  const ids=new Set<string>();
  for(const r of requests){
    const id=n(r.id);check(id>0n&&id<=18446744073709551615n&&!ids.has(String(id)),"PROJECTION_REQUEST_DUPLICATE");ids.add(String(id));
    const requested=n(r.requested_shares),p=n(r.pending_shares),settled=n(r.settled_shares),cancelled=n(r.cancelled_shares),claimable=n(r.claimable_assets),paid=n(r.claimed_assets);
    check(requested>0n&&requested===p+settled+cancelled,"PROJECTION_REQUEST_ACCOUNTING");
    const row=get(r.owner);row.pendingShares+=p;row.claimableAssets+=claimable;row.paidAssets+=paid;pending+=p;claims+=claimable;
  }
  check(allShares===total&&escrow===pending&&claims===reserved,"PROJECTION_RECONCILIATION_FAILED");
  const investors: ManagedInvestor[]=[...rows.values()].filter(r=>r.freeShares+r.pendingShares+r.claimableAssets>0n).map(r=>{
    const economic=r.freeShares+r.pendingShares,shareValue=valuation===null?null:total>0n?economic*valuation/total:0n;
    return {owner:r.owner,freeSharesRaw:String(r.freeShares),pendingSharesRaw:String(r.pendingShares),economicSharesRaw:String(economic),ownershipBps:total>0n?Number(economic*10000n/total):0,claimableAssetsRaw:String(r.claimableAssets),paidAssetsRaw:String(r.paidAssets),shareValueRaw:shareValue===null?null:String(shareValue),positionValueRaw:shareValue===null&&economic>0n?null:String((shareValue??0n)+r.claimableAssets)};
  });
  return {schema:1,scope:"candidate-v3-read-model",fundId,complete:true,navAvailable:valuation!==null,denominationValuesOnly:true,investors,excludedEscrowSharesRaw:String(escrow),reservedAssetsRaw:String(reserved),historicalRequests:requests.length};
}
