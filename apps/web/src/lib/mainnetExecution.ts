/** Client execution adapter. Disabled until both deployment settings approve it.
 * The review backend remains read/simulate-only; it never signs or broadcasts. */
import {Keypair,StrKey,Transaction,TransactionBuilder,rpc} from '@stellar/stellar-sdk';
import {MAINNET_NETWORK,mainnetGateway,prepareMainnetWalletReview,type ConnectorGateway,type MainnetIntent,type MainnetProfile,type MainnetReview} from './mainnetWalletConnector';
import {ManagedActionRejected,type ManagedReceipt,type ManagedTransport,type ManagedWallet} from './managedWalletFlow';
import type {ManagedWalletAction} from './managedWithdrawals';
export const NOAH_V2='CCP7X4UYFSUNXWRUH7W25RQMEQEHXFIYHNHVGAYAGGOOHPMPJKZGOGPW';
export const mainnetExecutionRequested=()=>process.env.NEXT_PUBLIC_MAINNET_EXECUTION_ENABLED==='1';
export function mainnetExecutionAvailable(profile:MainnetProfile){return mainnetExecutionRequested()&&profile.mainnetApproved===true&&profile.executionEnabled===true&&profile.network===MAINNET_NETWORK&&/^[a-f0-9]{64}$/.test(profile.releaseId)&&/^[a-f0-9]{64}$/.test(profile.codeHash);}
export function mainnetIntent(fund:string,action:ManagedWalletAction):MainnetIntent{
 if(!StrKey.isValidContract(fund)||fund===NOAH_V2)throw new ManagedActionRejected('This Arka is not enabled for managed mainnet execution.');
 const value={...action} as Omit<ManagedWalletAction,'actor'>&{actor?:unknown};delete value.actor;
 if('id'in value){const{id,...rest}=value;return{...rest,fund,requestId:String(id)};}
 return{...value,fund};
}
/** Confirmation remains available after execution is disabled or the page reloads. */
export async function readExecutionReceipt(id:string,source:string,fund:string,gateway=mainnetGateway()):Promise<ManagedReceipt|undefined>{
 if(!/^[a-f0-9]{64}$/.test(id)||!StrKey.isValidEd25519PublicKey(source)||!StrKey.isValidContract(fund)||fund===NOAH_V2)throw Error('Invalid receipt context.');
 const result=await gateway.receipt(id,source);
 if(result.id!==id||result.confirmationOnly!==true||result.canRetrySubmission!==false)throw Error('Confirmation unavailable. Nothing was resent.');
 if(result.status==='unknown')return undefined;
 if(!['confirmed','failed','catalog-pending','reconciled'].includes(result.status))throw Error('Unrecognized confirmation. Keep the receipt.');
 const proof=result.receipt??result;
 if(proof.id!==id||proof.source!==source||proof.fund!==fund||proof.network!==MAINNET_NETWORK||proof.publicSignatureVerified!==true)throw Error('Receipt identity could not be verified. Keep the receipt.');
 return{ok:result.status!=='failed',operationId:id,catalogPending:result.status==='confirmed'||result.status==='catalog-pending',error:result.status==='failed'?'Transaction failed on-chain. Review its result before preparing a new action.':undefined};
}
export function createMainnetExecutionTransport(options:{fund:string;walletAddress:string;wallet:ManagedWallet;profile:MainnetProfile;gateway?:ConnectorGateway;serverFactory?:(url:string)=>rpc.Server;now?:()=>number;isCurrent?:()=>boolean}):ManagedTransport{
 const {fund,walletAddress,wallet,profile}=options,gateway=options.gateway??mainnetGateway(),now=options.now??Date.now;
 mainnetIntent(fund,{action:'settle',actor:'executor'});
 if(!mainnetExecutionAvailable(profile))throw new ManagedActionRejected('Mainnet execution is disabled. Nothing was signed or submitted.');
 const endpoint=new URL(profile.endpoint??'');
 if(endpoint.protocol!=='https:'||endpoint.username||endpoint.password||endpoint.search||endpoint.hash)throw new ManagedActionRejected('Unverified mainnet RPC configuration.');
 if(!StrKey.isValidEd25519PublicKey(walletAddress)||!gateway.profile||!gateway.recheck)throw new ManagedActionRejected('Mainnet execution configuration is incomplete.');
 const server=options.serverFactory?.(endpoint.href)??new rpc.Server(endpoint.href),drafts=new Map<string,MainnetReview>();
 async function context(){if(options.isCurrent&&!options.isCurrent())throw new ManagedActionRejected('The selected Arka changed. Review again.');if(await wallet.getAddress()!==walletAddress||await wallet.getNetworkPassphrase()!==MAINNET_NETWORK)throw new ManagedActionRejected('Wallet or network changed. Review again.');if(options.isCurrent&&!options.isCurrent())throw new ManagedActionRejected('The selected Arka changed. Review again.');}
 return{
  prepare:async action=>{
   await context();const current=await gateway.profile!();
   if(!mainnetExecutionAvailable(current)||current.releaseId!==profile.releaseId||current.codeHash!==profile.codeHash||current.endpoint!==profile.endpoint)throw new ManagedActionRejected('Mainnet execution configuration changed. Review again.');
   const review=await prepareMainnetWalletReview(wallet,mainnetIntent(fund,action),profile,gateway,now);
   if(review.mode!=='live')throw new ManagedActionRejected('A recorded review cannot be executed.');
   drafts.set(review.id,review);return{id:review.id,xdr:review.unsignedEnvelope,networkPassphrase:MAINNET_NETWORK,signer:walletAddress,expiresAt:review.expiresAt,feeRaw:review.totalFeeRaw,engineId:'mainnet-reviewed',revision:review.ledger,summary:action.action,fund};
  },
  submit:async(id,encoded)=>{
   const review=drafts.get(id);if(!review||review.expiresAt<=now())throw new ManagedActionRejected('Review expired or unknown.');
   let transaction:Transaction;
   try{
    await context();const tx=TransactionBuilder.fromXDR(encoded,MAINNET_NETWORK);
    if(!(tx instanceof Transaction)||tx.source!==walletAddress||tx.hash().toString('hex')!==id||tx.signatures.length!==1||!Keypair.fromPublicKey(walletAddress).verify(tx.hash(),tx.signatures[0].signature()))throw Error('Wallet response differs from the reviewed transaction.');
    const current=await gateway.profile!();
    if(!mainnetExecutionAvailable(current)||current.releaseId!==review.releaseId||current.codeHash!==review.codeHash||current.endpoint!==profile.endpoint)throw Error('Mainnet execution configuration changed.');
    const checked=await gateway.recheck!(id,walletAddress);
    if(checked.valid!==true||checked.canSubmit!==false||checked.id!==id||checked.source!==walletAddress||checked.fund!==fund||checked.network!==MAINNET_NETWORK||checked.releaseId!==review.releaseId||checked.codeHash!==review.codeHash)throw Error('Pre-submit review changed.');
    if((await server.getNetwork()).passphrase!==MAINNET_NETWORK)throw Error('RPC network changed.');
    await context();if(review.expiresAt<=now())throw Error('Review expired.');transaction=tx;
   }catch(error){throw new ManagedActionRejected(error instanceof Error?error.message:'Pre-submit checks failed. Nothing was submitted.');}
   // Consume before the single write. Every ambiguous result is confirmation-only.
   if(options.isCurrent&&!options.isCurrent())throw new ManagedActionRejected('The selected Arka changed. Nothing was submitted.');
   drafts.delete(id);const sent=await server.sendTransaction(transaction);
   if(sent.status==='ERROR')throw new ManagedActionRejected('RPC rejected the transaction. No automatic retry will be made.');
   if(sent.hash!==id)throw Error('Submission response is uncertain. Check confirmation only.');
   const receipt=await readExecutionReceipt(id,walletAddress,fund,gateway);
   if(!receipt)throw Error('Confirmation is unknown. Check the receipt only.');return receipt;
  },
  receipt:id=>readExecutionReceipt(id,walletAddress,fund,gateway),
 };
}
