/** Shared pure planner for the frontend and the one-shot local CLI. */
export function planManagedKeeper(s, limits={maxRecoveryRaw:'5000000000'}) {
 try {
  if(!['none','Standalone Network ; February 2017'].includes(s.network)||!s.engineId||!Number.isSafeInteger(s.clock)||s.clock<0)return{kind:'blocked',reason:'Unknown network or snapshot identity.'};
  const nav=BigInt(s.nav),total=BigInt(s.totalShares),pending=BigInt(s.pendingShares),capacity=BigInt(s.settleCapacity),available=BigInt(s.recoveryAvailable),needed=BigInt(s.recoveryNeeded),cap=BigInt(limits.maxRecoveryRaw);
  if([nav,total,pending,capacity,available,needed,BigInt(s.cash),BigInt(s.reserved)].some(n=>n<BigInt(0))||cap<=BigInt(0))return{kind:'blocked',reason:'Invalid accounting or keeper limits.'};
  if(pending===BigInt(0))return{kind:'wait',reason:'No pending withdrawals.'};
  if(!s.headEligibleAt||s.clock<s.headEligibleAt)return{kind:'wait',reason:'The oldest request has not reached its cutoff.',nextEligibleAt:s.headEligibleAt};
  if(nav<=BigInt(0)||total<=BigInt(0))return{kind:'blocked',reason:'No valid valuation for settlement.',alert:'NAV unavailable or zero; preserve withdrawal rights.'};
  const shares=capacity*total/nav;
  if(shares>BigInt(0)&&shares*nav/total>BigInt(0))return{kind:'settle',reason:'Settle eligible shares against existing unreserved cash.',action:{action:'settle',actor:'executor'}};
  if(!s.recoveryPublicAt||s.clock<s.recoveryPublicAt)return{kind:'wait',reason:'Only the manager can recover lending liquidity during this window.',nextEligibleAt:s.recoveryPublicAt};
  if(needed>BigInt(0)&&available>BigInt(0))return{kind:'recover',reason:'Recover only the head request’s need, within the per-action cap.',action:{action:'prepare',actor:'executor',amountRaw:[available,needed,cap].reduce((a,b)=>a<b?a:b).toString()}};
  return{kind:'blocked',reason:'No safe lending liquidity is available.',alert:'Oldest request remains pending; investigate liquidity. Do not promise a payment date.'};
 }catch{return{kind:'blocked',reason:'Malformed or incomplete keeper snapshot.'};}
}
