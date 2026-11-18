import { Address, TransactionBuilder } from '@stellar/stellar-sdk';
import { NETWORK_PASSPHRASE, ADAPTER_BLEND, ADAPTER_BALANCED, SUSHI_ADAPTER, PHOENIX_ADAPTER } from '@/lib/config';
import { assertVenueReviewUnchanged, type ProtocolId, type VenueAction, type VenueSnapshot } from './protocolLifecycle';

type Review = {protocol:ProtocolId;action:VenueAction;before:VenueSnapshot;read:()=>Promise<VenueSnapshot>};
const reviews = new Map<string, {expiresAt:number;items:Review[]}>();
function decode(xdr:string) {
  try {return TransactionBuilder.fromXDR(xdr,NETWORK_PASSPHRASE);}catch{return null;}
}
export function rememberProtocolReview(xdr:string,items:Review[]):void {
  const tx=decode(xdr);if(!tx)throw new Error('Invalid protocol review transaction.');
  const now=Date.now();for(const[key,value]of reviews)if(value.expiresAt<=now)reviews.delete(key);
  if(reviews.size>=100)throw new Error('Too many pending protocol reviews. Finish or refresh an operation.');
  const inner='innerTransaction'in tx?tx.innerTransaction:tx;
  const maxTime=Number(inner.timeBounds?.maxTime??0)*1000;
  reviews.set(tx.hash().toString('hex'),{expiresAt:maxTime>0?Math.min(now+600_000,maxTime):now+600_000,items});
}
export function assertSameReviewedTransaction(unsigned:string,signed:string):void {
  const a=decode(unsigned),b=decode(signed);
  if(!a||!b||a.hash().toString('hex')!==b.hash().toString('hex'))throw new Error('The wallet changed the reviewed transaction. Refresh and review again.');
}
export async function assertProtocolReviewCurrent(xdr:string):Promise<void> {
  const tx=decode(xdr);if(!tx)throw new Error('Invalid transaction. Refresh and review the operation again.');
  const key=tx.hash().toString('hex'),review=reviews.get(key);
  const inner='innerTransaction'in tx?tx.innerTransaction:tx;
  const sensitive=inner.operations.some(op=>op.type==='invokeHostFunction'&&op.func.switch().name==='hostFunctionTypeInvokeContract'&&(/^(rebalance|rebalance_auto|credit_supply|credit_borrow|credit_withdraw|credit_repay|blend_lend|blend_borrow|blend_withdraw|blend_repay)$/.test(op.func.invokeContract().functionName().toString())||(op.func.invokeContract().functionName().toString()==='execute'&&[ADAPTER_BLEND,ADAPTER_BALANCED,SUSHI_ADAPTER,PHOENIX_ADAPTER].includes(Address.fromScAddress(op.func.invokeContract().contractAddress()).toString()))));
  if(!review){if(sensitive)throw new Error('Protocol permissions must be checked before signing. Refresh and review the operation.');return;}
  if(review.expiresAt<=Date.now()){reviews.delete(key);throw new Error('Protocol review expired. Refresh and review again.');}
  for(const item of review.items)assertVenueReviewUnchanged(item.before,await item.read(),item.protocol,item.action,NETWORK_PASSPHRASE);
}
