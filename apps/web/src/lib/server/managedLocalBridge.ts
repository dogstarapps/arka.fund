// Server-only ephemeral TEST wallets. Never import this module from client code.
import {randomBytes,randomUUID} from 'node:crypto';
import {Account,Keypair,Transaction,TransactionBuilder} from '@stellar/stellar-sdk';
import {managedFactoryOperation,managedWithdrawalOperation} from '../managedWithdrawalOperations';
import {MANAGED_LOCAL_NETWORK,type PreparedManagedTransaction,type ManagedReceipt} from '../managedWalletFlow';
import type {ManagedActor,ManagedState,ManagedWalletAction} from '../managedWithdrawals';
const actors:ManagedActor[]=['a','b','manager','executor'];
type Ticket={prepared:PreparedManagedTransaction;action:ManagedWalletAction&{salt?:string;templateHash?:string};phase:'ready'|'executing'|'done';receipt?:ManagedReceipt};
type Store={keys:Record<ManagedActor,Keypair>;sequence:Record<ManagedActor,number>;tickets:Map<string,Ticket>;lock:Promise<unknown>};
const globalBridge=globalThis as typeof globalThis&{__arkaManagedLocalBridge?:Store};
function store():Store{
 if(process.env.ARKA_MANAGED_INTEGRATION!=='1'||process.env.ARKA_MANAGED_PREVIEW!=='1'||process.env.NEXT_PUBLIC_UX_REVIEW_PREVIEW!=='1')throw new Error('Local wallet integration is disabled.');
 return globalBridge.__arkaManagedLocalBridge??=( {keys:Object.fromEntries(actors.map(a=>[a,Keypair.random()])) as Store['keys'],sequence:{a:0,b:0,manager:0,executor:0},tickets:new Map(),lock:Promise.resolve()});
}
async function native(path:'/state'|'/configure'|'/action'|`/receipt/${string}`,body?:unknown){
 const token=process.env.ARKA_LOCAL_PREVIEW_TOKEN;if(!token)throw new Error('Local host unavailable.');
 const r=await fetch(`http://127.0.0.1:3468${path}`,{method:body?'POST':'GET',body:body?JSON.stringify(body):undefined,cache:'no-store',signal:AbortSignal.timeout(15000),headers:{'content-type':'application/json','x-arka-local-token':token}});
 if(r.status===404)return undefined;const data=await r.json();if(!r.ok&&!data.state)throw new Error('Local host rejected the request.');return data;
}
export async function managedLocalState():Promise<ManagedState>{
 const s=store();let data=await native('/state');
 if(!data?.state||data.state.network!=='none'||data.state.engine!=='wasm-factory-soroban-host')throw new Error('The factory/WASM local simulator is not running.');
 const wallets=Object.fromEntries(actors.map(a=>[a,s.keys[a].publicKey()]));
 if(actors.some(a=>data.state.wallets?.[a]!==wallets[a]))data=await native('/configure',{actors:actors.map(a=>wallets[a])});
 return data.state;
}
export function validateManagedWalletAction(v:unknown):v is ManagedWalletAction{
 if(!v||typeof v!=='object'||Array.isArray(v))return false;const a=v as Record<string,unknown>;
 const keys:Record<string,string[]>={request:['action','actor','sharesRaw'],cancel:['action','actor','id'],claim:['action','actor','id'],prepare:['action','actor','amountRaw'],settle:['action','actor'],create:['action','actor']};
 if(typeof a.action!=='string'||!Object.hasOwn(keys,a.action)||Object.keys(a).some(k=>!keys[a.action as string].includes(k)))return false;
 const raw=(x:unknown)=>typeof x==='string'&&/^[1-9]\d{0,38}$/.test(x)&&BigInt(x)<(BigInt(1)<<BigInt(127));
 switch(a.action){case'request':return ['a','b'].includes(String(a.actor))&&raw(a.sharesRaw);case'cancel':case'claim':return ['a','b'].includes(String(a.actor))&&Number.isSafeInteger(a.id)&&Number(a.id)>0;case'prepare':return ['manager','executor'].includes(String(a.actor))&&raw(a.amountRaw);case'settle':return actors.includes(a.actor as ManagedActor);case'create':return a.actor==='manager';default:return false;}
}
export async function prepareManagedLocal(action:ManagedWalletAction){
 if(!validateManagedWalletAction(action))throw new Error('Invalid local wallet action.');
 const s=store(),state=await managedLocalState();const actor=action.actor,signer=s.keys[actor].publicKey();
 const salt=action.action==='create'?randomBytes(32).toString('hex'):undefined;
 const c=state.fund!;let op;
 switch(action.action){
  case'request':op=managedWithdrawalOperation(c,{method:'request_withdrawal',owner:signer,sharesRaw:action.sharesRaw});break;
  case'cancel':case'claim':op=managedWithdrawalOperation(c,{method:action.action==='cancel'?'cancel_withdrawal':'claim_withdrawal',owner:signer,id:String(action.id)});break;
  case'prepare':op=managedWithdrawalOperation(c,{method:'prepare_withdrawal_liquidity',caller:signer,amountRaw:action.amountRaw});break;
  case'settle':op=managedWithdrawalOperation(c,{method:'settle_withdrawals',maxRequests:16});break;
  case'create':op=managedFactoryOperation(state.factory!,signer,salt!,{templateHash:state.factoryTemplateHash!,denomination:state.token!,router:state.router!,mgmtBps:0,perfBps:0,depositBps:0});break;
  default:throw new Error('This action requires the portfolio-capable Soroban transport, not the historical simulator.');
 }
 const tx=new TransactionBuilder(new Account(signer,String(s.sequence[actor])),{fee:'100',networkPassphrase:MANAGED_LOCAL_NETWORK}).addOperation(op).setTimeout(120).build();
 const p:PreparedManagedTransaction={id:randomUUID(),xdr:tx.toXDR(),networkPassphrase:MANAGED_LOCAL_NETWORK,signer,expiresAt:Number(tx.timeBounds?.maxTime??0)*1000,engineId:state.engineId!,revision:state.revision!,fund:state.fund,summary:`${action.action} · local test wallet · no real funds`};
 for(const[id,t]of s.tickets)if(t.prepared.expiresAt<Date.now()-300000)s.tickets.delete(id);
 if(s.tickets.size>=128)throw new Error('Too many local transaction drafts. Wait or restart the preview.');
 s.tickets.set(p.id,{prepared:p,action:{...action,salt,templateHash:state.factoryTemplateHash},phase:'ready'});return p;
}
export function signManagedLocal(actor:ManagedActor,xdr:string){
 const s=store(),ticket=[...s.tickets.values()].find(t=>t.action.actor===actor&&t.prepared.xdr===xdr&&t.phase==='ready');
 if(!ticket||ticket.prepared.expiresAt<=Date.now())throw new Error('The local wallet draft is missing or expired.');
 const tx=TransactionBuilder.fromXDR(xdr,MANAGED_LOCAL_NETWORK);if(!(tx instanceof Transaction)||tx.source!==s.keys[actor].publicKey())throw new Error('Unexpected wallet transaction.');
 tx.sign(s.keys[actor]);return tx.toXDR();
}
export async function managedLocalReceipt(id:string){
 if(!/^[a-f0-9-]{36}$/.test(id))throw new Error('Invalid receipt id.');const s=store(),ticket=s.tickets.get(id);
 if(ticket?.receipt)return ticket.receipt;
 const receipt=await native(`/receipt/${id}`);if(receipt?.state&&ticket){ticket.receipt=receipt;ticket.phase='done';}return receipt as ManagedReceipt|undefined;
}
export async function executeManagedLocal(id:string,signedXdr:string):Promise<ManagedReceipt>{
 const s=store();const run=async()=>{
  const t=s.tickets.get(id);if(!t)throw new Error('Unknown local transaction draft.');
  if(t.receipt)return{...t.receipt,state:await managedLocalState()};
  if(t.phase==='executing'){const r=await managedLocalReceipt(id);if(r)return r;throw new Error('Confirmation is unknown. Read the receipt before trying again.');}
  if(t.prepared.expiresAt<=Date.now())throw new Error('Transaction expired. Prepare it again.');
  const tx=TransactionBuilder.fromXDR(signedXdr,MANAGED_LOCAL_NETWORK),unsigned=TransactionBuilder.fromXDR(t.prepared.xdr,MANAGED_LOCAL_NETWORK);
  if(!(tx instanceof Transaction)||tx.source!==t.prepared.signer||tx.hash().toString('hex')!==unsigned.hash().toString('hex')||tx.signatures.length!==1||!s.keys[t.action.actor].verify(tx.hash(),tx.signatures[0].signature()))throw new Error('Signature or transaction contents do not match the approved action.');
  const state=await managedLocalState();if(state.engineId!==t.prepared.engineId||state.revision!==t.prepared.revision)throw new Error('The wallet, Arka or ledger changed. Review a fresh transaction.');
  t.phase='executing';s.sequence[t.action.actor]+=1;
  const result=await native('/action',{...t.action,operationId:id,expectedEngineId:state.engineId,expectedRevision:state.revision});
  if(!result?.state)throw new Error('Confirmation is unknown. Query the receipt.');
  t.receipt=result;t.phase='done';return result as ManagedReceipt;
 };
 const result=s.lock.then(run,run);s.lock=result.catch(()=>{});return result;
}
