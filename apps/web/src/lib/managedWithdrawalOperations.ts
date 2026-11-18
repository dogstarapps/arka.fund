/** Unsigned ABI operations only: no RPC, wallet, key, signing or submission. */
import { Address, Contract, nativeToScVal, xdr } from '@stellar/stellar-sdk';
type OwnerRequest = { owner: string; id: string };
export type ManagedSpotStep={adapter:string;pool_id:string;asset_in:{contract:string};asset_out:{contract:string};amount_in:string;min_out:string;router_addr:string};
function wireStruct(fields:Record<string,xdr.ScVal>){return xdr.ScVal.scvMap(Object.entries(fields).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([key,val])=>new xdr.ScMapEntry({key:xdr.ScVal.scvSymbol(key),val})));}
function spotValue(step:ManagedSpotStep){
 return wireStruct({adapter:Address.fromString(step.adapter).toScVal(),pool_id:nativeToScVal(BigInt(step.pool_id),{type:'u128'}),asset_in:wireStruct({contract:Address.fromString(step.asset_in.contract).toScVal()}),asset_out:wireStruct({contract:Address.fromString(step.asset_out.contract).toScVal()}),amount_in:nativeToScVal(integer(step.amount_in,127),{type:'i128'}),min_out:nativeToScVal(integer(step.min_out,127),{type:'i128'}),router_addr:Address.fromString(step.router_addr).toScVal()});
}
export function managedSpotOperation(fund:string,manager:string,step:ManagedSpotStep){return new Contract(fund).call('rebalance',Address.fromString(manager).toScVal(),xdr.ScVal.scvVec([spotValue(step)]));}
export function managedSpotRecoveryOperation(fund:string,caller:string,step:ManagedSpotStep){return new Contract(fund).call('liquidate_withdrawal',Address.fromString(caller).toScVal(),spotValue(step));}
export function managedLiquidationPlanOperation(fund:string){return new Contract(fund).call('portfolio_liquidation_steps',nativeToScVal((BigInt(1)<<BigInt(127))-BigInt(1),{type:'i128'}));}
export function sameManagedSpotStep(a:ManagedSpotStep,b:ManagedSpotStep){return spotValue(a).toXDR('base64')===spotValue(b).toXDR('base64');}
/** withdrawal_status advances a COPY of the queue over at most 16 closed
 * requests. A greater head therefore proves bounded maintenance can progress,
 * even with no cash or newly settled shares. Missing/malformed reads fail closed. */
export function managedQueueCanAdvance(value:unknown):boolean {
 if(!value||typeof value!=='object')return false;
 const v=value as {queue?:{head?:unknown;next_id?:unknown};status?:{queue?:{head?:unknown;next_id?:unknown}}};
 const q=v.queue,s=v.status?.queue,valid=(n:unknown):n is string=>typeof n==='string'&&/^[1-9]\d{0,19}$/.test(n);
 if(!valid(q?.head)||!valid(q?.next_id)||!valid(s?.head)||s?.next_id!==q.next_id)return false;
 const head=BigInt(q.head),next=BigInt(q.next_id),advanced=BigInt(s.head);
 return next<=BigInt('18446744073709551615')&&head<next&&advanced>head&&advanced<=next&&advanced-head<=BigInt(16);
}
/** The selected contract reports actual bounded cursor progress in simulation.
 * This also covers returning an unpayable fractional request to its owner. */
export function managedSettlementCanAdvance(result:unknown,product:unknown):boolean {
 if(!result||typeof result!=='object'||!product||typeof product!=='object')return false;
 const r=result as {head_before?:unknown;head_after?:unknown;visited?:unknown},p=product as {queue?:{head?:unknown;next_id?:unknown};status?:{queue?:{head?:unknown;next_id?:unknown}}},q=p.queue,s=p.status?.queue;
 const valid=(v:unknown):v is string=>typeof v==='string'&&/^[1-9]\d{0,19}$/.test(v);
 if(!valid(q?.head)||!valid(q?.next_id)||!valid(s?.head)||s?.next_id!==q.next_id||typeof r.head_before!=='bigint'||typeof r.head_after!=='bigint'||typeof r.visited!=='number'||!Number.isInteger(r.visited)||r.visited<1||r.visited>16)return false;
 const before=BigInt(q.head),next=BigInt(q.next_id);
 return before<next&&next<=BigInt('18446744073709551615')&&BigInt(s.head)>=before&&BigInt(s.head)<=next&&BigInt(s.head)-before<=BigInt(16)&&r.head_before===before&&r.head_after>before&&r.head_after<=next&&r.head_after-before<=BigInt(r.visited);
}
export type ManagedOperation =
  | { method: 'request_withdrawal' | 'redeem_liquid'; owner: string; sharesRaw: string }
  | ({ method: 'cancel_withdrawal' | 'claim_withdrawal' } & OwnerRequest)
  | { method: 'pay_withdrawal'; id: string }
  | { method: 'prepare_withdrawal_liquidity'; caller: string; amountRaw: string }
  | { method: 'settle_withdrawals'; maxRequests: number };
function integer(s: string, bits: number) {
  if (typeof s !== 'string' || !/^[1-9]\d*$/.test(s) || s.length > 39) throw new Error('A positive raw integer string is required.');
  const v = BigInt(s);
  if (v >= BigInt(1) << BigInt(bits)) throw new Error('Integer overflow.');
  return v;
}
export function managedDepositOperation(fund:string,owner:string,asset:string,amountRaw:string,minSharesRaw:string){
 return new Contract(fund).call('deposit_protected',Address.fromString(owner).toScVal(),wireStruct({contract:Address.fromString(asset).toScVal()}),nativeToScVal(integer(amountRaw,127),{type:'i128'}),nativeToScVal(integer(minSharesRaw,127),{type:'i128'}));
}
export function managedDepositQuoteOperation(fund:string,asset:string,amountRaw:string){
 return new Contract(fund).call('quote_deposit',wireStruct({contract:Address.fromString(asset).toScVal()}),nativeToScVal(integer(amountRaw,127),{type:'i128'}));
}
export function managedApproveOperation(fund:string,owner:string,asset:string,amountRaw:string,expirationLedger:number){
 const amount=amountRaw==='0'?BigInt(0):integer(amountRaw,127);
 if(!Number.isSafeInteger(expirationLedger)||expirationLedger<=0||expirationLedger>0xffffffff)throw Error('Invalid allowance expiry.');
 return new Contract(asset).call('approve',Address.fromString(owner).toScVal(),Address.fromString(fund).toScVal(),nativeToScVal(amount,{type:'i128'}),nativeToScVal(expirationLedger,{type:'u32'}));
}

export function managedFactoryOperation(factory:string,manager:string,saltHex:string,config:{templateHash:string;denomination:string;router:string;mgmtBps:number;perfBps:number;depositBps:number}) {
  if(!/^[a-f0-9]{64}$/i.test(saltHex))throw new Error('Creation salt must contain 32 bytes.');
  if(!/^[a-f0-9]{64}$/i.test(config.templateHash))throw new Error('A reviewed template hash is required.');
  for(const bps of [config.mgmtBps,config.perfBps,config.depositBps])if(!Number.isInteger(bps)||bps<0||bps>10000)throw new Error('Invalid creation fees.');
  const fields={template_hash:nativeToScVal(Buffer.from(config.templateHash,'hex'),{type:'bytes'}),denomination:Address.fromString(config.denomination).toScVal(),router:Address.fromString(config.router).toScVal(),
    mgmt_bps:nativeToScVal(config.mgmtBps,{type:'i32'}),perf_bps:nativeToScVal(config.perfBps,{type:'i32'}),deposit_bps:nativeToScVal(config.depositBps,{type:'i32'})};
  const value=xdr.ScVal.scvMap(Object.entries(fields).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,val])=>new xdr.ScMapEntry({key:xdr.ScVal.scvSymbol(k),val})));
  return new Contract(factory).call('create_managed',nativeToScVal(Buffer.from(saltHex,'hex'),{type:'bytes'}),Address.fromString(manager).toScVal(),value);
}
export function managedWithdrawalOperation(fund: string, input: ManagedOperation) {
  const c = new Contract(fund);
  switch (input.method) {
    case 'request_withdrawal': case 'redeem_liquid': return c.call(input.method,Address.fromString(input.owner).toScVal(),nativeToScVal(integer(input.sharesRaw,127),{type:'i128'}));
    case 'pay_withdrawal': return c.call(input.method,nativeToScVal(integer(input.id,64),{type:'u64'}));
    case 'cancel_withdrawal': case 'claim_withdrawal': return c.call(input.method,Address.fromString(input.owner).toScVal(),nativeToScVal(integer(input.id,64),{type:'u64'}));
    case 'prepare_withdrawal_liquidity': return c.call(input.method,Address.fromString(input.caller).toScVal(),nativeToScVal(integer(input.amountRaw,127),{type:'i128'}));
    case 'settle_withdrawals':
      if (!Number.isInteger(input.maxRequests) || input.maxRequests<1 || input.maxRequests>16) throw new Error('Batch size must be between 1 and 16.');
      return c.call(input.method,nativeToScVal(input.maxRequests,{type:'u32'}));
    default: throw new Error('Unsupported managed withdrawal method.');
  }
}
