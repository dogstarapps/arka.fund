import type {ManagedActor,ManagedState,ManagedWalletAction} from './managedWithdrawals';
import {MAINNET_NETWORK} from './mainnetWalletConnector';
export const MANAGED_LOCAL_NETWORK='Standalone Network ; February 2017';
export type WalletPhase='preparing'|'awaiting_signature'|'submitting'|'confirmed'|'rejected'|'unknown';
export type PreparedManagedTransaction={id:string;xdr:string;networkPassphrase:string;signer:string;expiresAt:number;feeRaw?:string;engineId:string;revision:number;summary:string;fund?:string};
export type ManagedReceipt={ok:boolean;state?:ManagedState;operationId?:string;error?:string;createdFund?:string;mintedShares?:string;requestId?:string;catalogPending?:boolean};
export interface ManagedWallet {
  getAddress():Promise<string>;
  getNetworkPassphrase():Promise<string>;
  signTransaction(xdr:string,options:{networkPassphrase:string;address:string}):Promise<string>;
}
export interface ManagedTransport {
  prepare(action:ManagedWalletAction):Promise<PreparedManagedTransaction>;
  submit(id:string,signedXdr:string):Promise<ManagedReceipt>;
  receipt(id:string):Promise<ManagedReceipt|undefined>;
}
export class ManagedActionRejected extends Error {}
export class ManagedSignatureExpired extends ManagedActionRejected {
 constructor(){super('This signing request expired. Nothing was submitted. Close the old Freighter request and review again; a new signature is required.');}
}
export class ManagedConfirmationUnknown extends Error {
 constructor(public readonly operationId:string){super(`Confirmation is unknown. Refresh the receipt before trying again; do not repeat the withdrawal. Receipt: ${operationId}`);}
}
/** No retries of a financial write after an ambiguous result. Query its receipt. */
export async function executeManagedWalletAction(action:ManagedWalletAction,wallet:ManagedWallet,transport:ManagedTransport,
  options:ExecutionOptions){
  if(process.env.NEXT_PUBLIC_MANAGED_CATALOG_READ_ONLY==='1')throw new ManagedActionRejected('Catalog integration preview is read-only. No wallet request or transaction is permitted.');
  return executeWalletAction(action,wallet,transport,options,MANAGED_LOCAL_NETWORK);
}
type ExecutionOptions={expectedAddress:string;expectedEngineId?:string;expectedRevision?:number;expectedFund?:string;onPhase?:(phase:WalletPhase)=>void;onPrepared?:(prepared:PreparedManagedTransaction)=>void;onSubmitIntent?:(prepared:PreparedManagedTransaction)=>Promise<void>|void;now?:()=>number;isCurrent?:()=>boolean};
/** Mainnet uses the same single-write/receipt flow; activation is separate. */
export async function executeMainnetWalletAction(action:ManagedWalletAction,wallet:ManagedWallet,transport:ManagedTransport,options:ExecutionOptions){
  if(process.env.NEXT_PUBLIC_MAINNET_EXECUTION_ENABLED!=='1')throw new ManagedActionRejected('Mainnet execution is disabled. Nothing was signed or submitted.');
  return executeWalletAction(action,wallet,transport,options,MAINNET_NETWORK);
}
async function executeWalletAction(action:ManagedWalletAction,wallet:ManagedWallet,transport:ManagedTransport,options:ExecutionOptions,network:string){
  const phase=options.onPhase??(()=>{}),now=options.now??Date.now;
  const check=async()=>{
    if(options.isCurrent&&!options.isCurrent())throw new ManagedActionRejected('The selected wallet or Arka changed. Review again.');
    if(await wallet.getAddress()!==options.expectedAddress)throw new ManagedActionRejected('Wallet changed. Reconnect and review the action.');
    if(await wallet.getNetworkPassphrase()!==network)throw new ManagedActionRejected(network===MANAGED_LOCAL_NETWORK?'Only the isolated local network is enabled. No mainnet transaction is allowed.':'Select Stellar mainnet before reviewing. Nothing was submitted.');
    if(options.isCurrent&&!options.isCurrent())throw new ManagedActionRejected('The selected wallet or Arka changed. Review again.');
  };
  try{
    phase('preparing');await check();const prepared=await transport.prepare(action);
    if(prepared.signer!==options.expectedAddress||prepared.networkPassphrase!==network)throw new Error('Transaction signer or network mismatch.');
    if((options.expectedEngineId!==undefined&&prepared.engineId!==options.expectedEngineId)
       ||(options.expectedRevision!==undefined&&prepared.revision!==options.expectedRevision)
       ||(options.expectedFund!==undefined&&prepared.fund!==options.expectedFund))throw new ManagedActionRejected('The Arka or ledger changed since you reviewed it. Refresh before signing.');
    if(prepared.expiresAt<=now())throw new ManagedSignatureExpired();
    await check();if(prepared.expiresAt<=now())throw new ManagedSignatureExpired();
    options.onPrepared?.(prepared);phase('awaiting_signature');
    const signed=await wallet.signTransaction(prepared.xdr,{networkPassphrase:network,address:prepared.signer});
    if(prepared.expiresAt<=now())throw new ManagedSignatureExpired();
    await check();if(prepared.expiresAt<=now())throw new ManagedSignatureExpired();
    if(!signed)throw new Error('Freighter returned no signature. Nothing was submitted.');
    // Persist only public receipt metadata before broadcast; failure to persist
    // stops the write. No signed XDR or key belongs in browser storage.
    await options.onSubmitIntent?.(prepared);await check();
    if(prepared.expiresAt<=now())throw new ManagedSignatureExpired();
    phase('submitting');let result:ManagedReceipt;
    try{result=await transport.submit(prepared.id,signed);}catch(error){
      if(error instanceof ManagedActionRejected)throw error;
      const receipt=await transport.receipt(prepared.id).catch(()=>undefined);
      if(!receipt){phase('unknown');throw new ManagedConfirmationUnknown(prepared.id);}
      result=receipt;
    }
    if(!result.ok)throw new Error(result.error||'The contract rejected this action. Your withdrawal rights are unchanged.');
    phase('confirmed');return result;
  }catch(e){if(!(e instanceof Error&&e.message.startsWith('Confirmation is unknown')))phase('rejected');throw e;}
}
/** Adapts the existing wallets kit without bypassing its preview signing guard. */
export function managedWalletFromKit(kit:{getAddress:()=>Promise<{address:string}>;signTransaction:(xdr:string,options:{networkPassphrase:string;address:string})=>Promise<{signedTxXdr:string}>},readNetwork:()=>Promise<string>):ManagedWallet{
  return {getAddress:async()=>(await kit.getAddress()).address,getNetworkPassphrase:readNetwork,
    signTransaction:async(xdr,options)=>(await kit.signTransaction(xdr,options)).signedTxXdr};
}
export async function localManagedApi(body:unknown){
 const r=await fetch('/api/managed-withdrawals-preview/wallet',{method:'POST',cache:'no-store',headers:{'content-type':'application/json','x-arka-local-preview':'1'},body:JSON.stringify(body)});
 const data=await r.json();if(!r.ok){const message=typeof data.error==='string'?data.error:'Local wallet operation failed.';throw r.status<500?new ManagedActionRejected(message):new Error(message);}return data;
}
export function localManagedTransport():ManagedTransport{return{
 prepare:async action=>(await localManagedApi({stage:'prepare',action})).prepared,
 submit:async(id,signedXdr)=>localManagedApi({stage:'execute',id,signedXdr}),
 receipt:async id=>(await localManagedApi({stage:'receipt',id})).receipt,
};}
export function localPreviewWallet(actor:ManagedActor,address:string,approve:(summary:string)=>Promise<boolean>):ManagedWallet{
 return{getAddress:async()=>address,getNetworkPassphrase:async()=>MANAGED_LOCAL_NETWORK,
  signTransaction:async(xdr,options)=>{
   if(options.address!==address||options.networkPassphrase!==MANAGED_LOCAL_NETWORK)throw new Error('Wallet/network mismatch.');
   if(!await approve('Approve this action with the ephemeral local test wallet? No real wallet or funds are used.'))throw new Error('Signature declined. Nothing was submitted.');
   return(await localManagedApi({stage:'sign',actor,xdr})).signedXdr;
  }};
}
